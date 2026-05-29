
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getClave() {
    try {
        const invoice = await prisma.factura.findFirst({
            where: { secuencial: '000000018' },
            select: { claveAcceso: true }
        });
        console.log("CLAVE_ACCESO:" + invoice.claveAcceso);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getClave();
