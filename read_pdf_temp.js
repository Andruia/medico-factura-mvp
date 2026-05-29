const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('Documentacion varia SRI_facturador.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(function(error) {
    console.error("Error reading PDF:", error);
});
