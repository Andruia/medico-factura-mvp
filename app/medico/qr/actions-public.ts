"use server"

import { prisma } from "@/lib/prisma"

export async function getMedicoPublicInfoAction(medicoId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: medicoId },
            include: { medicoProfile: true }
        })

        if (!user || user.role !== "MEDICO") {
            return null
        }

        return {
            nombre: user.name || "Médico",
            especialidad: user.medicoProfile?.especialidad || "Medicina General",
            consultorio: user.medicoProfile?.nombreComercial || "Consultorio Médico"
        }
    } catch (error) {
        console.error("Error fetching medico public info:", error)
        return null
    }
}
