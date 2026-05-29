
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getFullInvoice() {
    try {
        const invoice = await prisma.factura.findFirst({
            where: { secuencial: '000000018' },
            select: {
                id: true,
                secuencial: true,
                claveAcceso: true,
                estado: true,
                mensajeError: true,
                xmlGenerado: true,
                createdAt: true
            }
        });

        console.log("=== FACTURA 000000018 ===");
        console.log("ID:", invoice.id);
        console.log("Estado:", invoice.estado);
        console.log("Clave de Acceso:", invoice.claveAcceso);
        console.log("Mensaje Error:", invoice.mensajeError);
        console.log("Fecha Creación:", invoice.createdAt);
        console.log("XML Generado:", invoice.xmlGenerado ? "SÍ" : "NO");

        if (invoice.xmlGenerado) {
            const fs = require('fs');
            fs.writeFileSync('factura_018.xml', invoice.xmlGenerado);
            console.log("\n✅ XML guardado en 'factura_018.xml'");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getFullInvoice();
