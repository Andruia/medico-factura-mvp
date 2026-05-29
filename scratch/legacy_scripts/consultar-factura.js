// Script para consultar el estado de autorización de una factura específica
// Uso: node consultar-factura.js <facturaId>

const { PrismaClient } = require('@prisma/client')
const axios = require('axios')
const https = require('https')

const prisma = new PrismaClient()

async function consultarAutorizacion(facturaId) {
    try {
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
            console.error("❌ Factura no encontrada")
            return
        }

        console.log(`\n📋 Consultando factura: ${factura.numeroFactura}`)
        console.log(`🔑 Clave de acceso: ${factura.claveAcceso}`)
        console.log(`📊 Estado actual: ${factura.estado}\n`)

        if (!factura.claveAcceso) {
            console.error("❌ Factura sin clave de acceso")
            return
        }

        // Configurar endpoint
        const ambiente = factura.medico.ambiente?.toLowerCase() === "pruebas" ? "pruebas" : "produccion"
        const endpointAutorizacion = ambiente === "pruebas"
            ? "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"
            : "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"

        console.log(`🌐 Consultando SRI (${ambiente})...`)

        // SOAP envelope
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

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            timeout: 30000
        })

        // Consultar
        const authResponse = await axios.post(endpointAutorizacion, soapAuthEnvelope, {
            headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "" },
            httpsAgent,
            timeout: 30000
        })

        const authData = authResponse.data
        console.log("\n📥 Respuesta SRI completa:")
        console.log("=".repeat(80))
        console.log(authData)
        console.log("=".repeat(80))

        // Parsear
        let nuevoEstado = factura.estado
        let numeroAutorizacion = factura.numeroAutorizacion
        let mensajeError = factura.mensajeError

        if (authData.includes("<estado>AUTORIZADO</estado>")) {
            nuevoEstado = "AUTORIZADO"
            const matchNum = authData.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/)
            numeroAutorizacion = matchNum ? matchNum[1] : factura.claveAcceso
            console.log("\n✅ FACTURA AUTORIZADA")
            console.log(`📝 Número de autorización: ${numeroAutorizacion}`)
        } else if (authData.includes("<numeroComprobantes>0</numeroComprobantes>")) {
            console.log("\n⏳ FACTURA AÚN EN PROCESAMIENTO")
            console.log("El SRI no ha terminado de procesar el comprobante")
        } else if (authData.includes("<estado>NO AUTORIZADO</estado>")) {
            nuevoEstado = "RECHAZADO"
            const mensajes = authData.match(/<mensaje>([\s\S]*?)<\/mensaje>/g)
            if (mensajes) {
                mensajeError = mensajes.map(m => m.replace(/<[^>]*>?/gm, '').trim()).join(" | ")
            }
            console.log("\n❌ FACTURA RECHAZADA")
            console.log(`💬 Mensaje: ${mensajeError}`)
        }

        // Actualizar si cambió
        if (nuevoEstado !== factura.estado) {
            await prisma.factura.update({
                where: { id: facturaId },
                data: {
                    estado: nuevoEstado,
                    numeroAutorizacion,
                    mensajeError
                }
            })
            console.log(`\n💾 Estado actualizado en base de datos: ${factura.estado} → ${nuevoEstado}`)
        } else {
            console.log(`\n📊 Estado sin cambios: ${nuevoEstado}`)
        }

    } catch (error) {
        console.error("\n❌ Error:", error.message)
    } finally {
        await prisma.$disconnect()
    }
}

// Ejecutar
const facturaId = process.argv[2]
if (!facturaId) {
    console.error("❌ Uso: node consultar-factura.js <facturaId>")
    process.exit(1)
}

consultarAutorizacion(facturaId)
