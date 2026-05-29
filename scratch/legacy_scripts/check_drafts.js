
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDrafts() {
    try {
        const drafts = await prisma.factura.findMany({
            where: { estado: 'BORRADOR' },
            select: { id: true, pacienteId: true, userId: true, secuencial: true, createdAt: true }
        });
        console.log('--- DB DRAFTS CHECK ---');
        console.log(JSON.stringify(drafts, null, 2));
        console.log('-----------------------');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDrafts();
