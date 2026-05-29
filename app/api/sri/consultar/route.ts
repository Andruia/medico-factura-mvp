import { NextResponse } from "next/server"
import axios from "axios"
import https from "https"

export async function POST(req: Request) {
  try {
    const { claveAcceso, endpoint } = await req.json()

    if (!claveAcceso || !endpoint) {
      return NextResponse.json({ success: false, error: "Faltan datos (claveAcceso o endpoint)" }, { status: 400 })
    }

    const soapEnvelope = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
         <soapenv:Header/>
         <soapenv:Body>
            <ec:autorizacionComprobante>
               <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
            </ec:autorizacionComprobante>
         </soapenv:Body>
      </soapenv:Envelope>
    `.trim()

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    })

    console.log("🔍 Consultando SRI:", claveAcceso)

    const response = await axios.post(endpoint, soapEnvelope, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: "",
      },
      httpsAgent,
    })

    return NextResponse.json({
      success: true,
      xmlResponse: response.data
    })

  } catch (error: any) {
    console.error("Error en API /sri/consultar:", error.message)
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 },
    )
  }
}
