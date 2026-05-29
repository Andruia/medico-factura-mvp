"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function guardarCertificadoAction(data: {
    archivoBase64: string,
    passwordEncriptada: string,
    ruc: string,
    fechaVencimiento: Date
}) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "No autorizado" }
    }

    try {
        // En producción, deberíamos guardar el archivo en disco/S3 y guardar solo el path.
        // Para este MVP, guardaremos el Base64 directamente en el campo 'firmaElectronicaPath' (aunque el nombre sea confuso)
        // OJO: Base64 puede ser grande para un String de PG si no es TEXT. Prisma String es TEXT por defecto en PG.

        await prisma.medicoProfile.upsert({
            where: { userId: session.user.id },
            create: {
                userId: session.user.id,
                ruc: data.ruc, // Guardamos el RUC detectado
                firmaElectronicaPath: data.archivoBase64,
                firmaPassword: data.passwordEncriptada,
                // Defaults requeridos
                nombreComercial: "Consultorio Médico",
                direccion: "Sin dirección",
                telefono: "",
            },
            update: {
                ruc: data.ruc, // Actualizamos el RUC si cambia
                firmaElectronicaPath: data.archivoBase64,
                firmaPassword: data.passwordEncriptada,
            }
        })

        revalidatePath("/medico/configuracion")
        revalidatePath("/medico/certificados")

        return { success: true }
    } catch (error: any) {
        console.error("Error guardando certificado:", error)
        return { success: false, error: "Error al guardar en base de datos: " + error.message }
    }
}
