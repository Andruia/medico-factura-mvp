"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import axios from "axios"
import https from "https"

export async function consultarAutorizacionAction(facturaId: string) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return { success: false, error: "No autenticado" }
        }

        // Obtener factura
        const factura = await prisma.factura.findUnique({
            where: { id: facturaId },
            include: {
                medico: {
                    include: {
                        puntoEmision: true
                    }
                }
            }
        })

        if (!factura) {
            return { success: false, error: "Factura no encontrada" }
        }

        if (factura.medicoId !== session.user.id) {
            return { success: false, error: "No autorizado" }
        }

        if (!factura.claveAcceso) {
            return { success: false, error: "Factura sin clave de acceso" }
        }

        // Configurar endpoint según ambiente
        const ambiente = factura.medico.ambiente?.toLowerCase() === "pruebas" ? "pruebas" : "produccion"
        const endpointAutorizacion = ambiente === "pruebas"
            ? "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"
            : "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"

        // Crear SOAP envelope
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

        // Configurar HTTPS agent
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            timeout: 30000
        })

        console.log(`🔍 Consultando autorización para factura ${factura.numeroFactura} (${factura.claveAcceso})`)

        // Consultar al SRI
        const authResponse = await axios.post(endpointAutorizacion, soapAuthEnvelope, {
            headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "" },
            httpsAgent,
            timeout: 30000
        })

        const authData = authResponse.data
        console.log("📥 Respuesta SRI Autorización:", authData)

        // Parsear respuesta
        let estado = factura.estado
        let numeroAutorizacion = factura.numeroAutorizacion
        let fechaAutorizacion = factura.fechaAutorizacion
        let mensajeError = factura.mensajeError

        if (authData.includes("<estado>AUTORIZADO</estado>")) {
            // AUTORIZADO
            estado = "AUTORIZADO"
            const matchNum = authData.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/)
            numeroAutorizacion = matchNum ? matchNum[1] : factura.claveAcceso
            const matchFecha = authData.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/)
            fechaAutorizacion = matchFecha ? new Date(matchFecha[1]) : new Date()
            mensajeError = null

            console.log("✅ Factura AUTORIZADA por el SRI")
        } else if (authData.includes("<numeroComprobantes>0</numeroComprobantes>") || authData.includes("EN PROCESO") || authData.includes("RECIBIDA")) {
            // AÚN EN PROCESO
            estado = "RECIBIDA"
            mensajeError = "El SRI aún está procesando el comprobante. Intente nuevamente en unos minutos."
            console.log("⏳ Factura aún en procesamiento")
        } else if (authData.includes("<estado>NO AUTORIZADO</estado>")) {
            // RECHAZADO
            estado = "RECHAZADO"
            const mensajes = authData.match(/<mensaje>([\s\S]*?)<\/mensaje>/g)
            if (mensajes) {
                mensajeError = mensajes.map((m: string) => m.replace(/<[^>]*>?/gm, '').trim()).join(" | ")
            } else {
                mensajeError = "No autorizado por el SRI (sin mensaje específico)"
            }
            console.log("❌ Factura RECHAZADA por el SRI:", mensajeError)
        } else {
            // ESTADO DESCONOCIDO
            console.warn("⚠️ Respuesta SRI no reconocida")
            return {
                success: false,
                error: "Respuesta del SRI no reconocida. Intente nuevamente más tarde."
            }
        }

        // Actualizar factura en base de datos
        await prisma.factura.update({
            where: { id: facturaId },
            data: {
                estado,
                numeroAutorizacion,
                fechaAutorizacion,
                mensajeError
            }
        })

        return {
            success: true,
            estado,
            numeroAutorizacion,
            fechaAutorizacion: fechaAutorizacion?.toISOString(),
            mensajeError
        }

    } catch (error: any) {
        console.error("Error consultando autorización:", error)
        return {
            success: false,
            error: error.message || "Error consultando autorización"
        }
    }
}
