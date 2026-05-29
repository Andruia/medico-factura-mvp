// Script para resetear el secuencial de facturas a 1
// ADVERTENCIA: Esto eliminará TODAS las facturas del usuario

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function resetSecuencial(userId) {
    try {
        console.log("\n🔄 Iniciando reset de secuencial...\n")

        // 1. Obtener información del usuario
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true }
        })

        if (!user) {
            console.error("❌ Usuario no encontrado")
            return
        }

        console.log(`👤 Usuario: ${user.name} (${user.email})`)

        // 2. Contar facturas actuales
        const facturaCount = await prisma.factura.count({
            where: { userId }
        })

        console.log(`📊 Facturas encontradas: ${facturaCount}`)

        if (facturaCount === 0) {
            console.log("✅ No hay facturas para eliminar")
        } else {
            // 3. Eliminar todas las facturas (cascade eliminará items, pagos, info adicional)
            console.log("\n🗑️  Eliminando facturas...")
            const deleted = await prisma.factura.deleteMany({
                where: { userId }
            })
            console.log(`✅ ${deleted.count} facturas eliminadas`)
        }

        // 4. Resetear secuencial en PuntoEmisionConfig
        const medico = await prisma.medicoProfile.findUnique({
            where: { userId },
            include: { puntosEmision: true }
        })

        if (!medico) {
            console.log("⚠️  Perfil de médico no encontrado")
        } else if (!medico.puntosEmision || medico.puntosEmision.length === 0) {
            console.log("⚠️  Punto de emisión no configurado")
        } else {
            const puntoEmision = medico.puntosEmision[0] // Tomar el primero
            console.log(`\n📍 Punto de emisión actual:`)
            console.log(`   Establecimiento: ${puntoEmision.establecimiento}`)
            console.log(`   Punto: ${puntoEmision.puntoEmision}`)
            console.log(`   Secuencial actual: ${puntoEmision.ultimoSecuencial}`)

            // Resetear a 1
            await prisma.puntoEmisionConfig.update({
                where: { id: puntoEmision.id },
                data: { ultimoSecuencial: 1 }
            })

            console.log(`✅ Secuencial reseteado a: 1`)
        }

        // 5. Limpiar archivos XML/PDF (opcional)
        console.log("\n📁 Limpieza de archivos:")
        const publicDir = path.join(process.cwd(), 'public', 'facturas')

        if (fs.existsSync(publicDir)) {
            const files = fs.readdirSync(publicDir)
            let xmlCount = 0
            let pdfCount = 0

            files.forEach(file => {
                const filePath = path.join(publicDir, file)
                if (file.endsWith('.xml')) {
                    fs.unlinkSync(filePath)
                    xmlCount++
                } else if (file.endsWith('.pdf')) {
                    fs.unlinkSync(filePath)
                    pdfCount++
                }
            })

            console.log(`   🗑️  ${xmlCount} archivos XML eliminados`)
            console.log(`   🗑️  ${pdfCount} archivos PDF eliminados`)
        } else {
            console.log("   ℹ️  Directorio de facturas no existe")
        }

        console.log("\n✅ Reset completado exitosamente!")
        console.log("🎯 La próxima factura tendrá el secuencial: 000000001\n")

    } catch (error) {
        console.error("\n❌ Error durante el reset:", error.message)
        console.error(error)
    } finally {
        await prisma.$disconnect()
    }
}

// Obtener userId del argumento o usar el primero disponible
async function main() {
    const userId = process.argv[2]

    if (!userId) {
        console.log("📋 Buscando usuarios disponibles...\n")
        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true }
        })

        if (users.length === 0) {
            console.error("❌ No hay usuarios en la base de datos")
            await prisma.$disconnect()
            return
        }

        console.log("Usuarios encontrados:")
        users.forEach((u, i) => {
            console.log(`${i + 1}. ${u.name} (${u.email}) - ID: ${u.id}`)
        })

        console.log("\n💡 Uso: node reset-secuencial.js <userId>")
        console.log(`   Ejemplo: node reset-secuencial.js ${users[0].id}`)

        await prisma.$disconnect()
        return
    }

    await resetSecuencial(userId)
}

main()
