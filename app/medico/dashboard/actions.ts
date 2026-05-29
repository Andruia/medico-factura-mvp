"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function getDashboardDataAction() {
    const session = await auth()

    if (!session?.user?.id) return { pacientesPendientes: [], medicoProfile: null, recentInvoices: [] }

    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Obtener historial de facturas (esta tabla ya existía y suele estar bien en el cliente)
        const facturasPromise = prisma.factura.findMany({
            where: {
                userId: session.user.id,
                estado: { not: "BORRADOR" }
            },
            include: {
                paciente: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        })

        // Obtener perfil (también estable)
        const medicoPromise = prisma.medicoProfile.findUnique({
            where: { userId: session.user.id }
        })

        // Obtener pacientes en cola (Atención Médica) - Capa de Resiliencia
        let atenciones: any[] = []
        try {
            if ((prisma as any).atencionMedica) {
                atenciones = await (prisma as any).atencionMedica.findMany({
                    where: {
                        medicoId: session.user.id,
                        estado: "PENDIENTE"
                        // Eliminamos filtro de fecha para mostrar pendientes antiguos
                    },
                    include: {
                        paciente: true
                    },
                    orderBy: { fecha: 'desc' },
                    take: 20
                })
            } else {
                throw new Error("Client sync error")
            }
        } catch (e) {
            console.warn("⚠️ Dashboard: Fallback SQL para AtencionMedica")
            // Query SQL directa uniendo con Paciente
            atenciones = await prisma.$queryRawUnsafe(`
                SELECT am.*, 
                       p."razonSocial" as "p_razonSocial", 
                       p."email" as "p_email", 
                       p."telefono" as "p_telefono"
                FROM "AtencionMedica" am
                JOIN "Paciente" p ON am."pacienteId" = p."id"
                WHERE am."medicoId" = $1 
                  AND am."estado" = 'PENDIENTE' 
                  -- AND am."fecha" >= $2 (Eliminado para mostrar antiguos)
                ORDER BY am."fecha" DESC
                LIMIT 20
            `, session.user.id, today)

            // Normalizar a formato similar al include de Prisma
            atenciones = atenciones.map(at => ({
                id: at.id,
                estado: at.estado,
                fecha: at.fecha,
                paciente: {
                    id: at.pacienteId,
                    razonSocial: at.p_razonSocial,
                    email: at.p_email,
                    telefono: at.p_telefono
                }
            }))
        }



        // Check for drafts for these patients
        const patientIds = atenciones.map(at => at.pacienteId || at.paciente.id);
        const borradores = await prisma.factura.findMany({
            where: {
                userId: session.user.id,
                pacienteId: { in: patientIds },
                estado: "BORRADOR"
            },
            select: { pacienteId: true }
        });
        const draftPatientIds = new Set(borradores.map(b => b.pacienteId));

        const [medico, facturas] = await Promise.all([medicoPromise, facturasPromise])

        return {
            pacientesPendientes: atenciones.map((at: any) => ({
                id: at.paciente.id,
                atencionId: at.id,
                medicoId: session.user?.id || "unknown",
                datos: {
                    nombres: at.paciente.razonSocial,
                    email: at.paciente.email || "",
                    telefono: at.paciente.telefono || ""
                },
                fechaRegistro: at.fecha.toISOString(),
                estado: at.estado.toLowerCase(),
                hasDraft: draftPatientIds.has(at.paciente.id) // Flag para UI
            })),
            medicoProfile: medico,
            recentInvoices: facturas.map(f => ({
                id: f.id,
                secuencial: f.secuencial,
                fecha: f.createdAt.toISOString(),
                paciente: f.paciente.razonSocial,
                total: Number(f.total),
                estado: f.estado,
                error: f.mensajeError
            }))
        }
    } catch (error) {
        console.error("Error dashboard data:", error)
        return { pacientesPendientes: [], medicoProfile: null, recentInvoices: [] }
    }
}

export async function checkDraftsAction(patientIds: string[]) {
    const session = await auth()
    if (!session?.user?.id || !patientIds.length) return {}

    try {
        console.log("🔍 Checking drafts for patients:", patientIds)
        const borradores = await prisma.factura.findMany({
            where: {
                userId: session.user.id,
                pacienteId: { in: patientIds },
                estado: "BORRADOR"
            },
            select: { pacienteId: true }
        })
        console.log("✅ Drafts found:", borradores)

        const draftMap: Record<string, boolean> = {}
        borradores.forEach(b => {
            if (b.pacienteId) draftMap[b.pacienteId] = true
        })

        return draftMap
    } catch (error) {
        console.error("Error checking drafts:", error)
        return {}
    }
}
