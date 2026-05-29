"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { XMLGenerator } from "@/lib/sri/xml-generator"
import { ClaveAccesoGenerator } from "@/lib/sri/clave-acceso"
import { CertificateManager } from "@/lib/sri/certificate-manager"
import { SRIClient } from "@/lib/sri/sri-client"
import axios from "axios"
import https from "https"
import { revalidatePath } from "next/cache"

export async function emitirFacturaAction(data: {
    pacienteId: string,
    items: any[],
    totales: any,
    formasPago?: any[],
    infoAdicional?: any[]
}) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "No autorizado" }

    try {
        // 1. Obtener datos del médico y configuración
        const medico = await prisma.medicoProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!medico || !medico.firmaElectronicaPath || !medico.firmaPassword) {
            return { success: false, error: "Firma electrónica no configurada" }
        }

        const paciente = await prisma.paciente.findUnique({
            where: { id: data.pacienteId }
        })

        if (!paciente) return { success: false, error: "Paciente no encontrado" }

        // 2. Generar Secuencial Transaccional
        const config = await (prisma as any).puntoEmisionConfig.upsert({
            where: {
                medicoId_establecimiento_puntoEmision: {
                    medicoId: medico.id,
                    establecimiento: (medico as any).establecimiento || "001",
                    puntoEmision: (medico as any).puntoEmision || "001"
                }
            },
            update: { ultimoSecuencial: { increment: 1 } },
            create: {
                medicoId: medico.id,
                establecimiento: (medico as any).establecimiento || "001",
                puntoEmision: (medico as any).puntoEmision || "001",
                ultimoSecuencial: 1
            }
        })
        const secuencial = config.ultimoSecuencial.toString().padStart(9, "0")

        // 3. Generar Clave de Acceso
        const fechaEmision = new Date()
        const codigoNumerico = Math.floor(10000000 + Math.random() * 90000000).toString()

        // Validar RUC rigurosamente antes de usarlo
        const rucMedico = (medico.ruc || "").trim();
        if (!rucMedico || rucMedico.length !== 13) {
            return {
                success: false,
                error: `El RUC del médico es inválido (${rucMedico.length} dígitos). Debe tener exactamente 13 dígitos. Verifique su perfil.`
            }
        }

        const claveAcceso = ClaveAccesoGenerator.generate(
            fechaEmision,
            "01", // Factura
            rucMedico,
            (medico as any).ambiente?.toLowerCase() === "pruebas" ? "1" : "2",
            `${(medico as any).establecimiento}${(medico as any).puntoEmision}`,
            secuencial,
            codigoNumerico,
            "1"
        )

        // 4. Guardar Factura como PENDIENTE_ENVIO para procesamiento asíncrono
        const factura = await (prisma as any).factura.create({
            data: {
                userId: session.user.id,
                pacienteId: paciente.id,
                claveAcceso: claveAcceso,
                secuencial: secuencial,
                estado: "PENDIENTE_ENVIO",
                subtotal: data.totales.subtotal,
                iva: data.totales.iva,
                total: data.totales.total,
                items: {
                    create: data.items.map((item: any) => {
                        const tarifa = item.ivaTarifa !== undefined ? parseInt(item.ivaTarifa) : 12;
                        const base = (item.cantidad * item.precioUnitario) - (item.descuento || 0);
                        const impuesto = base * (tarifa / 100);
                        return {
                            codigoPrincipal: item.codigoPrincipal || null,
                            descripcion: item.descripcion,
                            cantidad: item.cantidad,
                            precioUnitario: item.precioUnitario,
                            descuento: item.descuento || 0,
                            precioTotal: item.cantidad * item.precioUnitario,
                            ivaTarifa: tarifa,
                            impuestoValor: impuesto
                        };
                    })
                },
                formasPago: {
                    create: (data.formasPago || [{ codigo: "01", total: data.totales.total }]).map((fp: any) => ({
                        codigo: fp.codigo,
                        total: fp.total,
                        plazo: fp.plazo ? Number(fp.plazo) : null,
                        unidadTiempo: fp.unidadTiempo || null
                    }))
                },
                infoAdicional: {
                    create: (data.infoAdicional || []).map((ia: any) => ({
                        nombre: ia.nombre,
                        valor: ia.valor
                    }))
                }
            }
        })

        // Marcar atención como completada para el médico actual
        await (prisma as any).atencionMedica.updateMany({
            where: {
                pacienteId: paciente.id,
                medicoId: session.user.id,
                estado: "PENDIENTE"
            },
            data: { estado: "COMPLETADO" }
        })

        revalidatePath("/medico/dashboard")
        return {
            success: true,
            facturaId: factura.id,
            estado: "PENDIENTE_ENVIO"
        }

    } catch (error: any) {
        console.error("Error crítico emitiendo factura:", error)
        return { success: false, error: error.message || "Error interno del servidor" }
    }
}
export async function consultarEstadoFacturaAction(facturaId: string) {
    console.log("🔍 [consultarEstadoFacturaAction] Iniciando consulta para factura:", facturaId)

    const session = await auth()
    if (!session?.user?.id) {
        console.log("❌ [consultarEstadoFacturaAction] No autorizado")
        return { success: false, error: "No autorizado" }
    }

    try {
        const factura = await prisma.factura.findUnique({
            where: { id: facturaId },
            include: { user: true }
        })

        if (!factura || factura.userId !== session.user.id) {
            console.log("❌ [consultarEstadoFacturaAction] Factura no encontrada o no autorizada")
            return { success: false, error: "Factura no encontrada" }
        }

        console.log(`📋 [consultarEstadoFacturaAction] Factura encontrada. Estado actual: ${factura.estado}`)

        if (factura.estado === "AUTORIZADO" || factura.estado === "RECHAZADO") {
            console.log(`✅ [consultarEstadoFacturaAction] Factura ya procesada: ${factura.estado}`)
            return { success: true, estado: factura.estado, yaProcesada: true }
        }

        // Consultar SRI
        const medico = await (prisma as any).medicoProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!medico) {
            console.log("❌ [consultarEstadoFacturaAction] Perfil de médico no encontrado")
            return { success: false, error: "Perfil no encontrado" }
        }

        console.log(`🌐 [consultarEstadoFacturaAction] Consultando SRI en ambiente: ${medico.ambiente}`)

        const endpointAutorizacion = medico.ambiente?.toLowerCase() === "pruebas"
            ? "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"
            : "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline";

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

        const httpsAgent = new https.Agent({ rejectUnauthorized: false })

        console.log(`📡 [consultarEstadoFacturaAction] Enviando petición al SRI...`)
        const authResponse = await axios.post(endpointAutorizacion, soapAuthEnvelope, {
            headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "" },
            httpsAgent
        })

        const authData = authResponse.data
        console.log("📥 [consultarEstadoFacturaAction] Respuesta SRI recibida:", authData.substring(0, 500))

        if (authData.includes("<estado>AUTORIZADO</estado>")) {
            console.log("✅ [consultarEstadoFacturaAction] Factura AUTORIZADA")
            const matchNum = authData.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/)
            const matchFecha = authData.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/)

            await prisma.factura.update({
                where: { id: facturaId },
                data: {
                    estado: "AUTORIZADO",
                    numeroAutorizacion: matchNum ? matchNum[1] : (factura.claveAcceso || ""),
                    fechaAutorizacion: matchFecha ? new Date(matchFecha[1]) : new Date()
                }
            })
            return { success: true, estado: "AUTORIZADO" }
        } else if (authData.includes("<estado>RECHAZADO</estado>") || authData.includes("<estado>NO AUTORIZADO</estado>")) {
            console.log("❌ [consultarEstadoFacturaAction] Factura RECHAZADA")
            const mensajes = authData.match(/<mensaje>([\s\S]*?)<\/mensaje>/g)
            const error = mensajes ? mensajes.map((m: string) => m.replace(/<[^>]*>?/gm, '').trim()).join(" | ") : "Rechazada por SRI"

            await prisma.factura.update({
                where: { id: facturaId },
                data: {
                    estado: "RECHAZADO",
                    mensajeError: error
                }
            })
            return { success: true, estado: "RECHAZADO", error }
        }

        console.log("⏳ [consultarEstadoFacturaAction] Factura aún en procesamiento")
        return { success: true, estado: factura.estado || "RECIBIDA", pendiente: true }

    } catch (error: any) {
        console.error("❌ [consultarEstadoFacturaAction] Error:", error.message)
        return { success: false, error: error.message }
    }
}
