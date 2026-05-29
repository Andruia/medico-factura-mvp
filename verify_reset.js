
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyReset() {
    try {
        const facturas = await prisma.factura.count();
        const puntoConfig = await prisma.puntoEmisionConfig.findFirst();

        console.log("\n═══ VERIFICACIÓN POST-RESETEO ═══\n");
        console.log("✅ Facturas en BD:", facturas);
        console.log("✅ Próximo Secuencial:", String((puntoConfig?.ultimoSecuencial || 0) + 1).padStart(9, '0'));
        console.log("\n═══════════════════════════════════\n");

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

verifyReset();
