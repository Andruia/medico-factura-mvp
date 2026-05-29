
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getInvoiceError() {
    try {
        const invoice = await prisma.factura.findFirst({
            where: { secuencial: '000000018' }
        });

        console.log("=== DIAGNÓSTICO FACTURA 000000018 ===\n");
        console.log("ID:", invoice.id);
        console.log("Estado Actual:", invoice.estado);
        console.log("Clave de Acceso:", invoice.claveAcceso);
        console.log("\n--- MENSAJE DE ERROR ---");
        console.log(invoice.mensajeError || "(Sin mensaje de error)");
        console.log("\n--- FECHAS ---");
        console.log("Creada:", invoice.createdAt);
        console.log("Actualizada:", invoice.updatedAt);

    } catch (e) {
        console.error("ERROR:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

getInvoiceError();
