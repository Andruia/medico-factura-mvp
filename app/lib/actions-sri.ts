"use server"

import { CertificateManager } from "@/lib/sri/certificate-manager"
import { auth } from "@/auth"

export async function validarCertificadoAction(formData: FormData) {
    console.log("🚀 [ServerAction] STARTE: validarCertificadoAction has been called")
    try {
        console.log("🔍 [ServerAction] Checking authentication...")
        const session = await auth()
        if (!session?.user) {
            console.log("❌ [ServerAction] Authentication failed: No user session")
            return { success: false, error: "No autorizado" }
        }
        console.log("✅ [ServerAction] Authentication successful")

        console.log("🔍 [ServerAction] Extracting form data...")
        const file = formData.get("archivo") as File
        const password = formData.get("password") as string

        if (!file) console.log("❌ [ServerAction] File is missing")
        if (!password) console.log("❌ [ServerAction] Password is missing")

        if (!file || !password) {
            return { success: false, error: "Archivo y contraseña requeridos" }
        }

        console.log(`📂 [ServerAction] File received: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`)

        // Convert File to Base64
        console.log("⏳ [ServerAction] Converting file to ArrayBuffer...")
        const arrayBuffer = await file.arrayBuffer()
        console.log("⏳ [ServerAction] Converting ArrayBuffer to Buffer...")
        const buffer = Buffer.from(arrayBuffer)
        console.log("⏳ [ServerAction] Converting Buffer to Base64...")
        const base64 = buffer.toString("base64")
        console.log(`✅ [ServerAction] Base64 conversion complete. String length: ${base64.length}`)

        // Validate using the existing manager (Server Side)
        console.log("⏳ [ServerAction] Calling CertificateManager.validateCertificate...")
        const validacion = await CertificateManager.validateCertificate(base64, password)
        console.log("🔄 [ServerAction] Validation result received:", JSON.stringify(validacion, null, 2))

        if (!validacion.valid) {
            console.log("❌ [ServerAction] Certificate validation failed")
            return { success: false, error: validacion.error || "Certificado inválido" }
        }

        console.log("🔐 [ServerAction] Encrypting password for storage...")
        const encryptedPassword = CertificateManager.encryptPassword(password)
        console.log("✅ [ServerAction] Password encrypted")

        console.log("🎉 [ServerAction] Process completed successfully. Returning data.")
        return {
            success: true,
            data: {
                ...validacion.info,
                archivoBase64: base64,
                passwordEncriptada: encryptedPassword
            }
        }

    } catch (error) {
        console.error("❌ [ServerAction] CRITICAL EXCEPTION:", error)
        return { success: false, error: "Error interno procesando certificado: " + (error instanceof Error ? error.message : String(error)) }
    }
}
