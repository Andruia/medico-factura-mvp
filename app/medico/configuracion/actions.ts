"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function getConfiguracionAction() {
    const session = await auth()

    if (!session?.user?.id) {
        return null
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { medicoProfile: true }
    })

    if (!user || !user.medicoProfile) {
        return null
    }

    // Combine user info and profile info
    return {
        nombre: user.name,
        email: user.email,
        ruc: user.medicoProfile.ruc, // ADDED
        telefono: user.medicoProfile.telefono || "",
        especialidad: user.medicoProfile.especialidad || "",
        numeroLicencia: user.medicoProfile.numeroLicencia || "",

        nombreConsultorio: user.medicoProfile.nombreComercial || "",
        direccionConsultorio: user.medicoProfile.direccion || "",
        telefonoConsultorio: "", // Note: Schema only has one phone, mapped to profile.telefono

        notificacionesPacientes: user.medicoProfile.notificacionesPacientes,
        notificacionesFacturas: user.medicoProfile.notificacionesFacturas,
        notificacionesReportes: user.medicoProfile.notificacionesReportes,
        emailNotificaciones: user.medicoProfile.emailNotificaciones,
        smsNotificaciones: user.medicoProfile.smsNotificaciones,

        ivaDefecto: user.medicoProfile.ivaDefecto,
        monedaDefecto: user.medicoProfile.monedaDefecto,
        formatoFactura: user.medicoProfile.formatoFactura,

        tiempoExpiracionQR: user.medicoProfile.tiempoExpiracionQR,
        limitePacientesQR: user.medicoProfile.limitePacientesQR,
        ambiente: user.medicoProfile.ambiente || "pruebas"
    }
}

export async function updateConfiguracionAction(data: any) {
    const session = await auth()

    if (!session?.user?.id) {
        return { success: false, error: "No autorizado" }
    }

    try {
        // Update User (Name)
        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: data.nombre,
                email: data.email
            }
        })

        // Update or Create MedicoProfile
        await prisma.medicoProfile.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                ruc: data.ruc || "PENDIENTE-" + Date.now(), // Use provided RUC or fallback
                telefono: data.telefono,
                especialidad: data.especialidad,
                numeroLicencia: data.numeroLicencia,
                nombreComercial: data.nombreConsultorio,
                direccion: data.direccionConsultorio,

                notificacionesPacientes: data.notificacionesPacientes,
                notificacionesFacturas: data.notificacionesFacturas,
                notificacionesReportes: data.notificacionesReportes,
                emailNotificaciones: data.emailNotificaciones,
                smsNotificaciones: data.smsNotificaciones,

                ivaDefecto: data.ivaDefecto,
                monedaDefecto: data.monedaDefecto,
                formatoFactura: data.formatoFactura,

                tiempoExpiracionQR: data.tiempoExpiracionQR,
                limitePacientesQR: data.limitePacientesQR,
                ambiente: data.ambiente
            },
            update: {
                ruc: data.ruc, // ALLOW UPDATE
                telefono: data.telefono,
                especialidad: data.especialidad,
                numeroLicencia: data.numeroLicencia,
                nombreComercial: data.nombreConsultorio,
                direccion: data.direccionConsultorio,

                notificacionesPacientes: data.notificacionesPacientes,
                notificacionesFacturas: data.notificacionesFacturas,
                notificacionesReportes: data.notificacionesReportes,
                emailNotificaciones: data.emailNotificaciones,
                smsNotificaciones: data.smsNotificaciones,

                ivaDefecto: data.ivaDefecto,
                monedaDefecto: data.monedaDefecto,
                formatoFactura: data.formatoFactura,

                tiempoExpiracionQR: data.tiempoExpiracionQR,
                limitePacientesQR: data.limitePacientesQR,
                ambiente: data.ambiente
            }
        })

        revalidatePath("/medico/configuracion")
        return { success: true }
    } catch (error) {
        console.error("Error updating config:", error)
        return { success: false, error: "Error al guardar la configuración" }
    }
}
