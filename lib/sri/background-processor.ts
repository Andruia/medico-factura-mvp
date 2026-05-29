import { prisma } from "@/lib/prisma"
import { FiscalAdapter } from "./fiscal-adapter"
import { mapFacturaToSriPayload } from "./fiscal-mapper"
import type { MedicoProfileData } from "./fiscal-mapper"

/**
 * BackgroundProcessor – Procesa facturas en lote con control de concurrencia.
 * 
 * REFACTORIZACIÓN (Adapter Pattern):
 * - ANTES: Generaba XML → Firmaba XAdES localmente → Enviaba SOAP directo al SRI.
 * - AHORA: Mapea datos → Delega a FiscalAdapter (API externa NestJS) → Actualiza DB.
 * 
 * Lo que NO cambió:
 * - processAllPending() → misma interfaz pública
 * - Control de concurrencia con FOR UPDATE SKIP LOCKED
 * - Lógica de lote (3 facturas por ciclo)
 * - Estados: PENDIENTE_ENVIO → RECIBIDO_SRI / AUTORIZADO / RECHAZADO
 * - El cron endpoint sigue invocando processAllPending() sin cambios
 * 
 * Lo que SÍ cambió:
 * - sendPendingInvoices: usa FiscalAdapter.emitirFactura() en vez de SOAP/XAdES
 * - Errores retriable → vuelven a PENDIENTE_ENVIO para retry en próximo ciclo
 * - Errores terminal → RECHAZADO
 * - Se eliminó generateAndSignXML (lógica migrada a fiscal-mapper.ts)
 * - Se eliminó checkReceivedInvoices (la API externa cubre ciclo completo)
 */
export class BackgroundProcessor {
    /**
     * Procesa lotes de facturas pendientes de envío.
     * Este método es el que será invocado por el Cron Job externo.
     * 
     * Interfaz pública preservada para compatibilidad con:
     * - app/api/cron/process-sri/route.ts
     */
    static async processAllPending(): Promise<{ processedCount: number; errors: string[] }> {
        const errors: string[] = []
        let processedCount = 0

        try {
            // Procesar envío de facturas PENDIENTES via API fiscal externa
            const sentCount = await this.sendPendingInvoices(errors)
            processedCount += sentCount

            // Consultar autorización de facturas ya recibidas por el SRI
            // (para facturas que la API devolvió como RECIBIDO_SRI en un ciclo anterior)
            const authorizedCount = await this.checkReceivedInvoices(errors)
            processedCount += authorizedCount

        } catch (error: any) {
            console.error("[Processor] Error crítico en BackgroundProcessor:", error.message)
            errors.push(error.message)
        }

        return { processedCount, errors }
    }

    /**
     * Toma facturas en PENDIENTE_ENVIO, las bloquea con FOR UPDATE SKIP LOCKED,
     * y las envía a la API fiscal externa para firma + envío al SRI.
     * 
     * Cambio clave respecto a la versión anterior:
     * - Ya no genera XML ni firma localmente.
     * - Delega a FiscalAdapter.emitirFactura() que llama a la API NestJS.
     * - Los errores retriable (red, timeout, 5xx) devuelven la factura a
     *   PENDIENTE_ENVIO para que el próximo ciclo del cron la reintente.
     */
    private static async sendPendingInvoices(errors: string[]): Promise<number> {
        let count = 0

        // Obtenemos un lote de facturas de forma segura para evitar concurrencia
        // PostgreSQL: FOR UPDATE SKIP LOCKED
        const lockedFacturas: any[] = await prisma.$transaction(async (tx) => {
            const pending: any[] = await tx.$queryRaw`
                SELECT f.id 
                FROM "Factura" f
                WHERE f.estado = 'PENDIENTE_ENVIO'
                ORDER BY f."createdAt" ASC
                LIMIT 3
                FOR UPDATE SKIP LOCKED
            `
            
            if (pending.length === 0) return []

            // Marcamos las facturas con un mensaje de transición para evitar
            // que otro cron las procese si la transacción actual termina
            const ids = pending.map(p => p.id)
            
            await tx.$executeRaw`
                UPDATE "Factura"
                SET "mensajeError" = 'Procesando envío vía API fiscal...'
                WHERE id = ANY(${ids})
            `

            return pending
        })

        if (lockedFacturas.length === 0) return 0

        console.log(`[Processor] Iniciando envío de ${lockedFacturas.length} facturas pendientes vía API fiscal externa...`)

        for (const locked of lockedFacturas) {
            try {
                // Obtener datos detallados de la factura con todas las relaciones
                const factura = await prisma.factura.findUnique({
                    where: { id: locked.id },
                    include: {
                        paciente: true,
                        items: true,
                        formasPago: true,
                        infoAdicional: true,
                        user: {
                            include: {
                                medicoProfile: true
                            }
                        }
                    }
                })

                if (!factura) continue

                const medico = factura.user.medicoProfile
                if (!medico || !medico.firmaElectronicaPath || !medico.firmaPassword) {
                    throw new Error("Médico no configurado o sin firma electrónica.")
                }

                // Mapear datos Prisma al payload de la API fiscal externa
                const payload = mapFacturaToSriPayload(factura as any, medico as MedicoProfileData)

                // Enviar a la API fiscal externa (firma + envío SRI delegados)
                const result = await FiscalAdapter.emitirFactura(payload)

                if (result.success && result.estado === "AUTORIZADO") {
                    // Factura autorizada directamente por el SRI
                    await prisma.factura.update({
                        where: { id: factura.id },
                        data: {
                            estado: "AUTORIZADO",
                            numeroAutorizacion: result.numeroAutorizacion || null,
                            fechaAutorizacion: result.fechaAutorizacion || new Date(),
                            mensajeError: null
                        }
                    })
                    count++
                    console.log(`[Processor] Factura ${factura.secuencial} AUTORIZADA directamente.`)

                } else if (result.success && result.estado === "RECIBIDO_SRI") {
                    // Recibida por SRI, pendiente de autorización (se consultará en próximo ciclo)
                    await prisma.factura.update({
                        where: { id: factura.id },
                        data: {
                            estado: "RECIBIDO_SRI",
                            mensajeError: result.mensajes.join(" | ") || "Recibido por SRI, esperando autorización..."
                        }
                    })
                    count++
                    console.log(`[Processor] Factura ${factura.secuencial} RECIBIDA por SRI, esperando autorización.`)

                } else if (result.retriable) {
                    // Error transitorio (red, timeout, 5xx) → volver a PENDIENTE_ENVIO
                    // para que el próximo ciclo del cron la reintente
                    await prisma.factura.update({
                        where: { id: factura.id },
                        data: {
                            estado: "PENDIENTE_ENVIO",
                            mensajeError: `Reintentando: ${result.mensajes.join(", ")}`
                        }
                    })
                    console.warn(`[Processor] Factura ${factura.secuencial} → retry (error transitorio): ${result.mensajes.join(", ")}`)

                } else {
                    // Error terminal (RECHAZADO por SRI, datos inválidos, 4xx) → RECHAZADO
                    await prisma.factura.update({
                        where: { id: factura.id },
                        data: {
                            estado: "RECHAZADO",
                            mensajeError: `Rechazado: ${result.mensajes.join(" | ")}`
                        }
                    })
                    console.error(`[Processor] Factura ${factura.secuencial} RECHAZADA: ${result.mensajes.join(" | ")}`)
                }

            } catch (error: any) {
                console.error(`[Processor] Error procesando factura ${locked.id}:`, error.message)
                errors.push(`Envío Factura ${locked.id}: ${error.message}`)

                // Error inesperado no clasificado → RECHAZADO por seguridad
                await prisma.factura.update({
                    where: { id: locked.id },
                    data: {
                        estado: "RECHAZADO",
                        mensajeError: `Error inesperado: ${error.message}`
                    }
                })
            }
        }

        return count
    }

    /**
     * Consulta el estado de autorización para facturas en RECIBIDO_SRI.
     * 
     * Este método se mantiene para cubrir el caso donde la API externa devuelve
     * RECIBIDO_SRI (el SRI aceptó el comprobante pero aún no lo autorizó).
     * En el próximo ciclo del cron, se re-envía a la API externa para consultar.
     * 
     * Si la API externa cubre el ciclo completo (recepción + autorización en una
     * sola llamada), este método podría simplificarse en una futura iteración.
     */
    private static async checkReceivedInvoices(errors: string[]): Promise<number> {
        let count = 0

        const receivedInvoices = await prisma.factura.findMany({
            where: { estado: "RECIBIDO_SRI" },
            orderBy: { updatedAt: "asc" },
            take: 3,
            include: {
                paciente: true,
                items: true,
                formasPago: true,
                infoAdicional: true,
                user: {
                    include: {
                        medicoProfile: true
                    }
                }
            }
        })

        if (receivedInvoices.length === 0) return 0

        console.log(`[Processor] Consultando autorización para ${receivedInvoices.length} facturas recibidas...`)

        for (const factura of receivedInvoices) {
            try {
                const medico = factura.user.medicoProfile
                if (!medico || !medico.firmaElectronicaPath || !medico.firmaPassword) {
                    throw new Error("Médico no configurado.")
                }

                // Re-enviar a la API fiscal para que consulte la autorización
                const payload = mapFacturaToSriPayload(factura as any, medico as MedicoProfileData)
                const result = await FiscalAdapter.emitirFactura(payload)

                if (result.success && result.estado === "AUTORIZADO") {
                    await prisma.factura.update({
                        where: { id: factura.id },
                        data: {
                            estado: "AUTORIZADO",
                            numeroAutorizacion: result.numeroAutorizacion || null,
                            fechaAutorizacion: result.fechaAutorizacion || new Date(),
                            mensajeError: null
                        }
                    })
                    count++
                    console.log(`[Processor] Factura ${factura.secuencial} AUTORIZADA por SRI.`)

                } else if (result.estado === "RECHAZADO" && !result.retriable) {
                    await prisma.factura.update({
                        where: { id: factura.id },
                        data: {
                            estado: "RECHAZADO",
                            mensajeError: `Autorización falló: ${result.mensajes.join(" | ")}`
                        }
                    })
                    console.log(`[Processor] Factura ${factura.secuencial} RECHAZADA durante autorización.`)

                } else {
                    // Sigue en procesamiento o error transitorio → no cambiar estado
                    console.log(`[Processor] Factura ${factura.secuencial} sigue en procesamiento en el SRI...`)
                }

            } catch (error: any) {
                console.error(`[Processor] Error consultando factura ${factura.id}:`, error.message)
                errors.push(`Consulta Factura ${factura.id}: ${error.message}`)
            }
        }

        return count
    }
}
