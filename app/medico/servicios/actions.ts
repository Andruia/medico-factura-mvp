"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getServiciosAction() {
    const session = await auth()

    if (!session?.user?.id) return []

    const medicoProfile = await prisma.medicoProfile.findUnique({
        where: { userId: session.user.id }
    })

    if (!medicoProfile) return []

    try {
        const servicios = await prisma.productoServicio.findMany({
            where: { medicoId: medicoProfile.id },
            orderBy: { nombre: 'asc' }
        })
        return servicios.map(s => ({
            ...s,
            precioUnitario: Number(s.precioUnitario)
        }))
    } catch (error) {
        console.error("Error fetching services:", error)
        return []
    }
}

export async function saveServicioAction(data: any) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "No autorizado" }

    const medicoProfile = await prisma.medicoProfile.findUnique({
        where: { userId: session.user.id }
    })

    if (!medicoProfile) return { success: false, error: "Perfil no encontrado" }

    if (!data.nombre || !data.precioUnitario) {
        return { success: false, error: "Nombre y precio son obligatorios" }
    }

    try {
        const servicioData = {
            medicoId: medicoProfile.id,
            nombre: data.nombre.trim(),
            precioUnitario: parseFloat(data.precioUnitario),
            codigoPrincipal: data.codigoPrincipal?.trim() || null,
            codigoAuxiliar: data.codigoAuxiliar?.trim() || null,
            descripcion: data.descripcion?.trim() || null,
            ivaTarifa: data.ivaTarifa !== undefined ? parseInt(data.ivaTarifa) : 12,
        }

        if (data.id) {
            // Update
            await prisma.productoServicio.update({
                where: { id: data.id },
                data: servicioData
            })
        } else {
            // Create
            await prisma.productoServicio.create({
                data: servicioData
            })
        }

        revalidatePath("/medico/servicios")
        return { success: true }
    } catch (error) {
        console.error("Error saving service:", error)
        return { success: false, error: "Error al guardar el servicio" }
    }
}

export async function deleteServicioAction(id: string) {
    const session = await auth()
    if (!session?.user?.email) return { success: false, error: "No autorizado" }

    try {
        await prisma.productoServicio.delete({
            where: { id }
        })
        revalidatePath("/medico/servicios")
        return { success: true }
    } catch (error) {
        console.error("Error deleting service:", error)
        return { success: false, error: "Error al eliminar" }
    }
}
