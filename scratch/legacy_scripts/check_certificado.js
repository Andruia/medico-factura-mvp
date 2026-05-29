
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCertificado() {
    try {
        // Obtener el perfil del médico
        const medicos = await prisma.medicoProfile.findMany();

        console.log("\n═══ CONFIGURACIÓN DE CERTIFICADO ═══\n");

        medicos.forEach(medico => {
            console.log(`Médico ID: ${medico.id}`);
            console.log(`Usuario ID: ${medico.userId}`);
            console.log(`Nombre Comercial: ${medico.nombreComercial || "(Sin nombre)"}`);
            console.log(`\n📜 FIRMA ELECTRÓNICA:`);
            console.log(`  - Archivo (.p12): ${medico.firmaElectronicaPath ? "✅ CONFIGURADO" : "❌ NO CONFIGURADO"}`);
            console.log(`  - Contraseña: ${medico.firmaPassword ? "✅ CONFIGURADO" : "❌ NO CONFIGURADO"}`);
            console.log(`\n📍 DATOS SRI:`);
            console.log(`  - RUC: ${medico.ruc || "❌ NO CONFIGURADO"}`);
            console.log(`  - Ambiente: ${medico.ambiente || "❌ NO CONFIGURADO"}`);
            console.log(`  - Establecimiento: ${medico.establecimiento || "❌ NO CONFIGURADO"}`);
            console.log(`  - Punto Emisión: ${medico.puntoEmision || "❌ NO CONFIGURADO"}`);
            console.log("\n" + "=".repeat(50) + "\n");
        });

    } catch (e) {
        console.error("ERROR:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkCertificado();
