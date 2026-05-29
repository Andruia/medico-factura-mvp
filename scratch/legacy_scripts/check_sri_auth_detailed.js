
const axios = require('axios');
const https = require('https');
const fs = require('fs');

const CLAVE_ACCESO = "0602202601100217266400120010010000000188861029119";
const URL = "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl";

const soapEnvelope = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
   <soapenv:Header/>
   <soapenv:Body>
      <ec:autorizacionComprobante>
         <claveAccesoComprobante>${CLAVE_ACCESO}</claveAccesoComprobante>
      </ec:autorizacionComprobante>
   </soapenv:Body>
</soapenv:Envelope>
`;

async function checkAuth() {
    try {
        console.log("=== CONSULTANDO SRI ===");
        console.log("Clave de Acceso: " + CLAVE_ACCESO);

        const response = await axios.post(URL, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': ''
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 15000
        });

        console.log("\n=== RESPUESTA SRI ===");
        console.log("Status HTTP:", response.status);
        console.log("\n=== XML COMPLETO ===");
        console.log(response.data);

        // Guardar en archivo para análisis
        fs.writeFileSync('sri_response.xml', response.data);
        console.log("\n✅ Respuesta guardada en 'sri_response.xml'");

        // Intentar parsear estado
        if (response.data.includes('AUTORIZADO')) {
            console.log("\n🟢 ESTADO: AUTORIZADO");
        } else if (response.data.includes('NO AUTORIZADO')) {
            console.log("\n🔴 ESTADO: NO AUTORIZADO (RECHAZADO)");
        } else if (response.data.includes('EN PROCESAMIENTO')) {
            console.log("\n🟡 ESTADO: EN PROCESAMIENTO");
        } else {
            console.log("\n⚪ ESTADO: DESCONOCIDO - Revisar XML");
        }

    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
        if (error.response) {
            console.log("Response Status:", error.response.status);
            console.log("Response Data:", error.response.data);
        }
    }
}

checkAuth();
