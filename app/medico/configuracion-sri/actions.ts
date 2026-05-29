"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { ConfiguracionSRI } from "@/lib/sri/types"

export async function saveSRIConfigAction(config: Partial<ConfiguracionSRI>) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "No autorizado" }
    }

    try {
        const medico = await prisma.medicoProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!medico) {
            return { success: false, error: "Perfil de médico no encontrado" }
        }

        await prisma.medicoProfile.update({
            where: { id: medico.id },
            data: {
                ruc: config.ruc,
                razonSocial: config.razonSocial,
                nombreComercial: config.nombreComercial,
                direccionMatriz: config.direccionMatriz, // Support UI field name
                contribuyenteEspecial: config.contribuyenteEspecial,
                obligadoContabilidad: config.obligadoContabilidad,
                ambiente: config.ambiente?.toUpperCase() || "PRUEBAS",

                // SMTP Setup
                smtpServidor: config.configuracionEmail?.servidor,
                smtpPuerto: config.configuracionEmail?.puerto,
                smtpUsuario: config.configuracionEmail?.usuario,
                smtpPassword: config.configuracionEmail?.password,
                smtpSsl: config.configuracionEmail?.ssl
            }
        })

        revalidatePath("/medico/configuracion-sri")
        return { success: true }
    } catch (error) {
        console.error("Error saving SRI config:", error)
        return { success: false, error: "Error al guardar la configuración en la base de datos" }
    }
}

export async function getSRIConfigAction() {
    const session = await auth()
    if (!session?.user?.id) return null

    try {
        const medico = await prisma.medicoProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!medico) return null

        return {
            ambiente: medico.ambiente.toLowerCase() as "pruebas" | "produccion",
            ruc: medico.ruc,
            razonSocial: medico.razonSocial || "",
            nombreComercial: medico.nombreComercial || "",
            direccionMatriz: medico.direccionMatriz || "",
            contribuyenteEspecial: medico.contribuyenteEspecial || "",
            obligadoContabilidad: medico.obligadoContabilidad,
            configuracionEmail: {
                servidor: medico.smtpServidor || "smtp.gmail.com",
                puerto: medico.smtpPuerto || 587,
                usuario: medico.smtpUsuario || "",
                password: medico.smtpPassword || "",
                ssl: medico.smtpSsl
            }
        }
    } catch (error) {
        console.error("Error getting SRI config:", error)
        return null
    }
}
