import { NextRequest, NextResponse } from "next/server"
import { CertificateManager } from "@/lib/sri/certificate-manager"
import { auth } from "@/auth"

export async function POST(request: NextRequest) {
    console.log("🚀 [API Route] POST /api/medico/validar-certificado called")

    try {
        console.log("🔍 [API Route] Checking authentication...")
        const session = await auth()
        if (!session?.user) {
            console.log("❌ [API Route] Authentication failed: No user session")
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
        }
        console.log("✅ [API Route] Authentication successful")

        console.log("🔍 [API Route] Parsing FormData...")
        const formData = await request.formData()
        const file = formData.get("archivo") as File
        const password = formData.get("password") as string

        if (!file || !password) {
            console.log("❌ [API Route] Missing file or password")
            return NextResponse.json({ success: false, error: "Archivo y contraseña requeridos" }, { status: 400 })
        }

        console.log(`📂 [API Route] File received: ${file.name}, Size: ${file.size} bytes`)

        // Convert File to Base64
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString("base64")

        // Validate using CertificateManager
        console.log("⏳ [API Route] Validating certificate...")
        const validacion = await CertificateManager.validateCertificate(base64, password)
        console.log("🔄 [API Route] Validation result:", validacion.valid ? "Valid" : "Invalid")

        if (!validacion.valid) {
            return NextResponse.json({ success: false, error: validacion.error || "Certificado inválido" }, { status: 400 })
        }

        const encryptedPassword = CertificateManager.encryptPassword(password)

        return NextResponse.json({
            success: true,
            data: {
                ...validacion.info,
                archivoBase64: base64,
                passwordEncriptada: encryptedPassword
            }
        })

    } catch (error) {
        console.error("❌ [API Route] Exception:", error)
        return NextResponse.json({
            success: false,
            error: "Error interno: " + (error instanceof Error ? error.message : String(error))
        }, { status: 500 })
    }
}
