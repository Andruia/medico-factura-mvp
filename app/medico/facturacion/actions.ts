"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function guardarFacturaBorradorAction(data: {
    pacienteId: string,
    items: any[],
    totales: any,
    formasPago?: any[],
    infoAdicional?: any[]
}) {
    const session = await auth()

    if (!session?.user?.id) {
        return { success: false, error: "No autorizado" }
    }

    try {
        // 1. Limpiar borradores anteriores del mismo paciente para evitar duplicados
        await (prisma as any).factura.deleteMany({
            where: {
                userId: session.user.id,
                pacienteId: data.pacienteId,
                estado: "BORRADOR"
            }
        })

        // 2. Crear nuevo borrador
        const factura = await prisma.factura.create({
            data: {
                userId: session.user.id,
                pacienteId: data.pacienteId,
                secuencial: "000000000",
                subtotal: data.totales.subtotal,
                iva: data.totales.iva,
                total: data.totales.total,
                estado: "BORRADOR",
                items: {
                    create: data.items.map((item: any) => {
                        const tarifa = item.ivaTarifa !== undefined ? parseInt(item.ivaTarifa) : 12;
                        const base = (item.cantidad * item.precioUnitario) - (item.descuento || 0);
                        const impuesto = base * (tarifa / 100);
                        return {
                            codigoPrincipal: item.codigoPrincipal || null,
                            descripcion: item.descripcion,
                            cantidad: item.cantidad,
                            precioUnitario: item.precioUnitario,
                            descuento: item.descuento || 0,
                            precioTotal: item.cantidad * item.precioUnitario,
                            ivaTarifa: tarifa,
                            impuestoValor: impuesto
                        }
                    })
                },
                formasPago: {
                    create: (data.formasPago || []).map((fp: any) => ({
                        codigo: fp.codigo,
                        total: fp.total,
                        plazo: fp.plazo ? Number(fp.plazo) : null,
                        unidadTiempo: fp.unidadTiempo || null
                    }))
                },
                infoAdicional: {
                    create: (data.infoAdicional || []).map((ia: any) => ({
                        nombre: ia.nombre,
                        valor: ia.valor
                    }))
                }
            }
        })

        // NOTA: No marcamos la atención como completada al guardar borrador.
        // Solo se completa cuando se EMITE la factura final.

        revalidatePath("/medico/dashboard")
        return { success: true, facturaId: factura.id }

    } catch (error) {
        console.error("Error guardando borrador:", error)
        return { success: false, error: "Error al guardar el borrador" }
    }
}

export async function deleteFacturaAction(id: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "No autorizado" }
    }

    try {
        console.log(`🗑️ Eliminando factura ID: ${id}`)

        // Con Prisma, si tenemos onDelete: Cascade en el schema, se borrarán items, formasPago, etc.
        // Si no, tendríamos que borrarlos manualmente. Dado que usamos (prisma as any),
        // confiaremos en la base de datos o lo haremos explícito si falla.
        await (prisma as any).factura.delete({
            where: { id }
        })

        revalidatePath("/medico/dashboard")
        return { success: true }
    } catch (error: any) {
        console.error("Error deleting factura:", error)
        return { success: false, error: error?.message || "Error al eliminar la factura" }
    }
}

