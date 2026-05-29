"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function getBorradorFacturaAction(pacienteId: string) {
    const session = await auth()

    if (!session?.user?.id) return null

    try {
        const borrador = await (prisma as any).factura.findFirst({
            where: {
                userId: session.user.id,
                pacienteId: pacienteId,
                estado: "BORRADOR"
            },
            include: {
                items: true,
                formasPago: true,
                infoAdicional: true
            },
            orderBy: {
                updatedAt: 'desc'
            }
        })

        if (!borrador) return null

        return {
            id: borrador.id,
            items: (borrador as any).items.map((item: any) => ({
                id: item.id,
                descripcion: item.descripcion,
                cantidad: Number(item.cantidad),
                precioUnitario: Number(item.precioUnitario),
                descuento: Number(item.descuento),
                ivaTarifa: Number(item.ivaTarifa || 0),
                codigoPrincipal: item.codigoPrincipal
            })),
            formasPago: (borrador as any).formasPago.map((fp: any) => ({
                id: fp.id,
                codigo: fp.codigo,
                total: Number(fp.total),
                plazo: Number(fp.plazo || 0),
                unidadTiempo: fp.unidadTiempo || 'Dias'
            })),
            infoAdicional: (borrador as any).infoAdicional.map((ia: any) => ({
                id: ia.id,
                nombre: ia.nombre,
                valor: ia.valor
            }))
        }

    } catch (error) {
        console.error("Error obteniendo borrador:", error)
        return null
    }
}
