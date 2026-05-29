
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function resetTestEnvironment() {
    try {
        console.log("\n╔═══════════════════════════════════════════════════════════╗");
        console.log("║  🧹 LIMPIEZA DE AMBIENTE DE PRUEBAS - FACTURACIÓN SRI   ║");
        console.log("╚═══════════════════════════════════════════════════════════╝\n");

        // 1. Mostrar estado actual
        const facturas = await prisma.factura.count();
        const puntoConfig = await prisma.puntoEmisionConfig.findFirst();

        console.log("📊 ESTADO ACTUAL:");
        console.log("  - Facturas en BD:", facturas);
        console.log("  - Último Secuencial:", puntoConfig?.ultimoSecuencial || 0);
        console.log("");

        // 2. Confirmar acción
        const confirm = await question("⚠️  ¿Deseas ELIMINAR todas las facturas y RESETEAR el contador? (sí/no): ");

        if (confirm.toLowerCase() !== 'sí' && confirm.toLowerCase() !== 'si') {
            console.log("\n❌ Operación cancelada.");
            rl.close();
            await prisma.$disconnect();
            return;
        }

        console.log("\n🚀 Iniciando limpieza...\n");

        // 3. Eliminar facturas y datos relacionados
        console.log("🗑️  Paso 1/4: Eliminando información adicional de facturas...");
        const deletedInfo = await prisma.facturaInfoAdicional.deleteMany({});
        console.log(`   ✅ ${deletedInfo.count} registros eliminados`);

        console.log("🗑️  Paso 2/4: Eliminando formas de pago...");
        const deletedPagos = await prisma.facturaFormaPago.deleteMany({});
        console.log(`   ✅ ${deletedPagos.count} registros eliminados`);

        console.log("🗑️  Paso 3/4: Eliminando ítems de facturas...");
        const deletedItems = await prisma.facturaItem.deleteMany({});
        console.log(`   ✅ ${deletedItems.count} registros eliminados`);

        console.log("🗑️  Paso 4/4: Eliminando facturas...");
        const deletedFacturas = await prisma.factura.deleteMany({});
        console.log(`   ✅ ${deletedFacturas.count} facturas eliminadas`);

        // 4. Resetear contador
        console.log("\n🔄 Reseteando contador de secuencial...");

        if (puntoConfig) {
            await prisma.puntoEmisionConfig.update({
                where: { id: puntoConfig.id },
                data: { ultimoSecuencial: 0 }
            });
            console.log("   ✅ Contador reseteado a 0");
        } else {
            console.log("   ⚠️  No se encontró configuración de punto de emisión");
        }

        // 5. Verificar resultado
        console.log("\n📊 ESTADO FINAL:");
        const facturasFinales = await prisma.factura.count();
        const puntoConfigFinal = await prisma.puntoEmisionConfig.findFirst();
        console.log("  - Facturas en BD:", facturasFinales);
        console.log("  - Último Secuencial:", puntoConfigFinal?.ultimoSecuencial || 0);

        console.log("\n✨ ¡LIMPIEZA COMPLETADA!\n");
        console.log("📝 Próxima factura será: 000000001\n");

    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
    } finally {
        rl.close();
        await prisma.$disconnect();
    }
}

resetTestEnvironment();
