
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getInvoiceDetails() {
    try {
        const invoice = await prisma.factura.findFirst({
            where: { secuencial: '000000018' },
            select: {
                id: true,
                secuencial: true,
                claveAcceso: true,
                estado: true,
                mensajeError: true,
                createdAt: true
            }
        });
        console.log(JSON.stringify(invoice, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getInvoiceDetails();
