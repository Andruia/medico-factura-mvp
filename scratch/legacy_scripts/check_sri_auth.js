
const axios = require('axios');
const https = require('https');

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
        console.log("Checking SRI Authorization for: " + CLAVE_ACCESO);
        const response = await axios.post(URL, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': ''
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }), // For dev/test env
            timeout: 10000
        });

        console.log("Status: " + response.status);
        console.log("Data: " + response.data);
    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.log("Response Data:", error.response.data);
        }
    }
}

checkAuth();
