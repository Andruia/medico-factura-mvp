import { NextResponse } from "next/server"
import axios from "axios"
import https from "https"

export async function POST(req: Request) {
  try {
    const { xml, endpoint } = await req.json()

    if (!xml || !endpoint) {
      return NextResponse.json({ success: false, error: "Faltan datos (xml o endpoint)" }, { status: 400 })
    }

    // Construir SOAP Envelope para RecepcionComprobantesOffline (Batch / Offline method)
    // El SRI espera que el XML firmado venga en Base64 dentro de <xml>
    // Referencia: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl

    const xmlBase64 = Buffer.from(xml).toString('base64');

    const soapEnvelope = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
         <soapenv:Header/>
         <soapenv:Body>
            <ec:recepcionComprobantes>
               <xml>${xmlBase64}</xml>
            </ec:recepcionComprobantes>
         </soapenv:Body>
      </soapenv:Envelope>
    `.trim()

    // Configurar Agente HTTPS para ignorar errores de certificados del SRI (común en pruebas)
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    })

    console.log("🚀 Enviando a SRI:", endpoint)

    // Enviar a SRI
    const response = await axios.post(endpoint, soapEnvelope, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: "",
      },
      httpsAgent,
    })

    // Retornamos la respuesta XML cruda para que el cliente la parsee si es necesario,
    // o podríamos parsearla aquí. Para mantenerlo simple, devolvemos success true
    // si el status es 200 y el cuerpo no tiene Faults.

    const responseData = response.data

    if (responseData.includes("RespuestaSolicitud")) {
      // TODO: Parsear XML de respuesta real para extraer 'estado'
      // Por ahora asumimos éxito de recepción técnica si llegamos aquí
      return NextResponse.json({
        success: true,
        estado: "RECIBIDA",
        xmlResponse: responseData
      })
    }

    return NextResponse.json({
      success: false,
      error: "Respuesta inesperada del SRI",
      xmlResponse: responseData
    })

  } catch (error: any) {
    console.error("Error en API /sri/enviar:", error.message)
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 },
    )
  }
}
