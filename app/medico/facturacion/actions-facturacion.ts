"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ClaveAccesoGenerator } from "@/lib/sri/clave-acceso"
import { FiscalAdapter } from "@/lib/sri/fiscal-adapter"
import { getFiscalFeatureFlags } from "@/lib/config/fiscal-config"
import { revalidatePath } from "next/cache"

// ============================================================================
// emitirFacturaAction
// ============================================================================

/**
 * Server Action: Crea una factura en estado PENDIENTE_ENVIO.
 * El envío real al SRI se hace asíncronamente via BackgroundProcessor + Cron.
 * 
 * Esta action NO toca firma ni envío. Solo:
 * 1. Valida sesión y datos
 * 2. Genera secuencial y clave de acceso
 * 3. Persiste en DB como PENDIENTE_ENVIO
 */
export async function emitirFacturaAction(data: {
    pacienteId: string
    items: Array<{
        codigoPrincipal?: string
        descripcion: string
        cantidad: number
        precioUnitario: number
        descuento?: number
        ivaTarifa?: number
    }>
    totales: {
        subtotal: number
        iva: number
        total: number
    }
    formasPago?: Array<{
        codigo: string
        total: number
        plazo?: number
        unidadTiempo?: string
    }>
    infoAdicional?: Array<{
        nombre: string
        valor: string
    }>
}) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "No autorizado" }

    try {
        // 1. Obtener datos del médico y configuración
        const medico = await prisma.medicoProfile.findUnique({
            where: { userId: session.user.id },
        })

        if (!medico || !medico.firmaElectronicaPath || !medico.firmaPassword) {
            return { success: false, error: "Firma electrónica no configurada. Configure su certificado .p12 en la sección de configuración." }
        }

        const paciente = await prisma.paciente.findUnique({
            where: { id: data.pacienteId },
        })

        if (!paciente) return { success: false, error: "Paciente no encontrado" }

        // 2. Validar items
        if (!data.items || data.items.length === 0) {
            return { success: false, error: "Debe incluir al menos un item en la factura" }
        }

        // 3. Generar Secuencial Transaccional (atomic upsert)
        const config = await prisma.puntoEmisionConfig.upsert({
            where: {
                medicoId_establecimiento_puntoEmision: {
                    medicoId: medico.id,
                    establecimiento: medico.establecimiento || "001",
                    puntoEmision: medico.puntoEmision || "001",
                },
            },
            update: { ultimoSecuencial: { increment: 1 } },
            create: {
                medicoId: medico.id,
                establecimiento: medico.establecimiento || "001",
                puntoEmision: medico.puntoEmision || "001",
                ultimoSecuencial: 1,
            },
        })
        const secuencial = config.ultimoSecuencial.toString().padStart(9, "0")

        // 4. Generar Clave de Acceso
        const fechaEmision = new Date()
        const codigoNumerico = Math.floor(10000000 + Math.random() * 90000000).toString()

        // Validar RUC
        const rucMedico = (medico.ruc || "").trim()
        if (!rucMedico || rucMedico.length !== 13) {
            return {
                success: false,
                error: `El RUC del médico es inválido (${rucMedico.length} dígitos). Debe tener exactamente 13 dígitos. Verifique su perfil.`,
            }
        }

        const claveAcceso = ClaveAccesoGenerator.generate(
            fechaEmision,
            "01", // Factura
            rucMedico,
            medico.ambiente?.toLowerCase() === "pruebas" ? "1" : "2",
            `${medico.establecimiento || "001"}${medico.puntoEmision || "001"}`,
            secuencial,
            codigoNumerico,
            "1",
        )

        // 5. Guardar Factura como PENDIENTE_ENVIO
        const factura = await prisma.factura.create({
            data: {
                userId: session.user.id,
                pacienteId: paciente.id,
                claveAcceso,
                secuencial,
                estado: "PENDIENTE_ENVIO",
                subtotal: data.totales.subtotal,
                iva: data.totales.iva,
                total: data.totales.total,
                items: {
                    create: data.items.map((item) => {
                        const tarifa = item.ivaTarifa !== undefined ? item.ivaTarifa : 12
                        const base = (item.cantidad * item.precioUnitario) - (item.descuento || 0)
                        const impuesto = base * (tarifa / 100)
                        return {
                            codigoPrincipal: item.codigoPrincipal || null,
                            descripcion: item.descripcion,
                            cantidad: item.cantidad,
                            precioUnitario: item.precioUnitario,
                            descuento: item.descuento || 0,
                            precioTotal: item.cantidad * item.precioUnitario,
                            ivaTarifa: tarifa,
                            impuestoValor: impuesto,
                        }
                    }),
                },
                formasPago: {
                    create: (data.formasPago || [{ codigo: "01", total: data.totales.total }]).map((fp) => ({
                        codigo: fp.codigo,
                        total: fp.total,
                        plazo: fp.plazo ? Number(fp.plazo) : null,
                        unidadTiempo: fp.unidadTiempo || null,
                    })),
                },
                infoAdicional: {
                    create: (data.infoAdicional || []).map((ia) => ({
                        nombre: ia.nombre,
                        valor: ia.valor,
                    })),
                },
            },
        })

        // 6. Marcar atención como completada
        await prisma.atencionMedica.updateMany({
            where: {
                pacienteId: paciente.id,
                medicoId: session.user.id,
                estado: "PENDIENTE",
            },
            data: { estado: "COMPLETADO" },
        })

        revalidatePath("/medico/dashboard")
        revalidatePath("/medico/facturacion")

        return {
            success: true,
            facturaId: factura.id,
            claveAcceso,
            secuencial,
            estado: "PENDIENTE_ENVIO",
            message: "Factura creada exitosamente. Se procesará automáticamente en el próximo ciclo.",
        }

    } catch (error: any) {
        console.error("[emitirFacturaAction] Error crítico:", error)

        // Manejar errores de constraint único (clave de acceso duplicada)
        if (error?.code === "P2002") {
            return {
                success: false,
                error: "Error de concurrencia al generar la factura. Por favor, intente nuevamente.",
            }
        }

        return { success: false, error: error.message || "Error interno del servidor" }
    }
}

// ============================================================================
// consultarEstadoFacturaAction
// ============================================================================

/**
 * Server Action: Consulta el estado actual de una factura.
 * Si la factura está en RECIBIDO_SRI, consulta la API fiscal externa para
 * obtener el estado actualizado.
 */
export async function consultarEstadoFacturaAction(facturaId: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "No autorizado" }
    }

    try {
        const factura = await prisma.factura.findUnique({
            where: { id: facturaId },
            select: {
                id: true,
                estado: true,
                claveAcceso: true,
                numeroAutorizacion: true,
                fechaAutorizacion: true,
                mensajeError: true,
                userId: true,
                secuencial: true,
            },
        })

        if (!factura || factura.userId !== session.user.id) {
            return { success: false, error: "Factura no encontrada" }
        }

        // Si ya tiene estado terminal, retornar directamente
        if (factura.estado === "AUTORIZADO" || factura.estado === "RECHAZADO") {
            return {
                success: true,
                estado: factura.estado,
                numeroAutorizacion: factura.numeroAutorizacion,
                fechaAutorizacion: factura.fechaAutorizacion?.toISOString(),
                mensajeError: factura.mensajeError,
                yaProcesada: true,
            }
        }

        // Si está en RECIBIDO_SRI y hay clave de acceso, intentar consultar via API fiscal
        const flags = getFiscalFeatureFlags()

        if (factura.estado === "RECIBIDO_SRI" && factura.claveAcceso && flags.useFiscalAPI) {
            try {
                const result = await FiscalAdapter.consultarAutorizacion(factura.claveAcceso)

                if (result.success && result.estado === "AUTORIZADO") {
                    // Actualizar en DB
                    await prisma.factura.update({
                        where: { id: facturaId },
                        data: {
                            estado: "AUTORIZADO",
                            numeroAutorizacion: result.numeroAutorizacion || factura.claveAcceso || "",
                            fechaAutorizacion: result.fechaAutorizacion || new Date(),
                            mensajeError: null,
                        },
                    })

                    revalidatePath("/medico/facturacion")
                    return { success: true, estado: "AUTORIZADO" }
                }

                if (!result.success && result.estado === "RECHAZADO") {
                    const errorMsg = result.mensajes.join(" | ") || "Rechazada por SRI"
                    await prisma.factura.update({
                        where: { id: facturaId },
                        data: {
                            estado: "RECHAZADO",
                            mensajeError: errorMsg,
                        },
                    })

                    revalidatePath("/medico/facturacion")
                    return { success: true, estado: "RECHAZADO", error: errorMsg }
                }

                // Sigue en procesamiento
                return {
                    success: true,
                    estado: factura.estado,
                    pendiente: true,
                    message: "La factura sigue en procesamiento en el SRI.",
                }

            } catch (apiError: any) {
                // Si la API fiscal falla, no bloquear la consulta
                console.warn(`[consultarEstadoFacturaAction] Error consultando API fiscal: ${apiError.message}`)
            }
        }

        // Fallback: consultar via SOAP directo (legacy) o retornar estado actual
        if (factura.estado === "RECIBIDO_SRI" && factura.claveAcceso && !flags.useFiscalAPI) {
            return await consultarSRIDirecto(facturaId, factura)
        }

        // Retornar estado actual sin consultar externamente
        return {
            success: true,
            estado: factura.estado,
            mensajeError: factura.mensajeError,
            pendiente: factura.estado === "PENDIENTE_ENVIO" || factura.estado === "RECIBIDO_SRI",
        }

    } catch (error: any) {
        console.error("[consultarEstadoFacturaAction] Error:", error.message)
        return { success: false, error: error.message }
    }
}

// ============================================================================
// Legacy SOAP helper (solo cuando FISCAL_USE_EXTERNAL_API=false)
// ============================================================================

async function consultarSRIDirecto(facturaId: string, factura: any) {
    const medico = await prisma.medicoProfile.findFirst({
        where: { userId: factura.userId },
    })

    if (!medico) return { success: false, error: "Perfil no encontrado" }

    const axios = (await import("axios")).default
    const https = await import("https")
    const httpsAgent = new https.Agent({ rejectUnauthorized: false })

    const endpointAutorizacion = medico.ambiente?.toLowerCase() === "pruebas"
        ? "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"
        : "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"

    const soapAuthEnvelope = `
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
            <soapenv:Header/>
            <soapenv:Body>
                <ec:autorizacionComprobante>
                    <claveAccesoComprobante>${factura.claveAcceso}</claveAccesoComprobante>
                </ec:autorizacionComprobante>
            </soapenv:Body>
        </soapenv:Envelope>
    `.trim()

    const authResponse = await axios.post(endpointAutorizacion, soapAuthEnvelope, {
        headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "" },
        httpsAgent,
        timeout: 15000,
    })

    const authData = authResponse.data

    if (authData.includes("<estado>AUTORIZADO</estado>")) {
        const matchNum = authData.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/)
        const matchFecha = authData.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/)

        await prisma.factura.update({
            where: { id: facturaId },
            data: {
                estado: "AUTORIZADO",
                numeroAutorizacion: matchNum ? matchNum[1] : (factura.claveAcceso || ""),
                fechaAutorizacion: matchFecha ? new Date(matchFecha[1]) : new Date(),
                mensajeError: null,
            },
        })
        return { success: true, estado: "AUTORIZADO" }

    } else if (authData.includes("<estado>RECHAZADO</estado>") || authData.includes("<estado>NO AUTORIZADO</estado>")) {
        const mensajes = authData.match(/<mensaje>([\s\S]*?)<\/mensaje>/g)
        const error = mensajes
            ? mensajes.map((m: string) => m.replace(/<[^>]*>?/gm, "").trim()).join(" | ")
            : "Rechazada por SRI"

        await prisma.factura.update({
            where: { id: facturaId },
            data: { estado: "RECHAZADO", mensajeError: error },
        })
        return { success: true, estado: "RECHAZADO", error }
    }

    return { success: true, estado: factura.estado || "RECIBIDO_SRI", pendiente: true }
}
