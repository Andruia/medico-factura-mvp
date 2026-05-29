// Script para guardar el último XML firmado generado
// Esto te permitirá probarlo manualmente en el facturador del SRI

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function guardarUltimoXML() {
    try {
        console.log("\n🔍 Buscando última factura...\n")

        // Obtener la última factura con XML
        const factura = await prisma.factura.findFirst({
            where: {
                xmlPath: { not: null }
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: {
                    select: { name: true, email: true }
                }
            }
        })

        if (!factura) {
            console.log("❌ No se encontró ninguna factura con XML")
            return
        }

        console.log(`📋 Factura encontrada:`)
        console.log(`   Usuario: ${factura.user.name} (${factura.user.email})`)
        console.log(`   Secuencial: ${factura.secuencial}`)
        console.log(`   Clave de acceso: ${factura.claveAcceso}`)
        console.log(`   Estado: ${factura.estado}`)
        console.log(`   XML Path: ${factura.xmlPath}\n`)

        let xmlContent = "";

        if (factura.xmlPath && factura.xmlPath.trim().startsWith('<?xml')) {
            console.log("📄 XML detectado en base de datos (contenido directo)");
            xmlContent = factura.xmlPath;
        } else if (factura.xmlPath) {
            // Es un path
            const xmlFullPath = path.join(process.cwd(), factura.xmlPath)
            if (fs.existsSync(xmlFullPath)) {
                console.log(`📂 Leyendo XML desde archivo: ${xmlFullPath}`);
                xmlContent = fs.readFileSync(xmlFullPath, 'utf-8')
            } else {
                console.log(`❌ Archivo XML no encontrado en la ruta: ${xmlFullPath}`)
                return
            }
        } else {
            console.log("❌ La factura no tiene XML guardado")
            return
        }

        // Guardar en la raíz del proyecto para evitar errores de ruta en Windows
        const fileName = `factura_${factura.secuencial}_${factura.claveAcceso}.xml`
        const outputPath = path.join(process.cwd(), fileName)

        fs.writeFileSync(outputPath, xmlContent, 'utf-8')

        console.log(`✅ XML guardado exitosamente en:`)
        console.log(`   ${outputPath}\n`)
        console.log(`📝 Puedes usar este archivo para:`)
        console.log(`   1. Probarlo en el facturador gratuito del SRI`)
        console.log(`   2. Validarlo con herramientas de validación XML`)
        console.log(`   3. Compararlo con XMLs que sí funcionan\n`)

        // Mostrar primeros 1000 caracteres del XML
        console.log(`📄 Primeros 1000 caracteres del XML:`)
        console.log("=".repeat(80))
        console.log(xmlContent.substring(0, 1000))
        console.log("=".repeat(80))

    } catch (error) {
        console.error("\n❌ Error:", error.message)
    } finally {
        await prisma.$disconnect()
    }
}

guardarUltimoXML()
