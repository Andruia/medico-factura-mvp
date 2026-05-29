"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function getPacientesPendientesAction() {
    const session = await auth()

    // console.log("Session in action:", session) 
    // if (!session?.user?.id) {
    //    console.log("No session found in action")
    //    return []
    // }

    if (!session?.user?.id) return []

    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Capa de Resiliencia para AtencionMedica
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
                    orderBy: {
                        fecha: 'desc'
                    },
                    take: 50
                })
            } else {
                throw new Error("Client sync error")
            }
        } catch (e) {
            console.warn("⚠️ Pacientes: Fallback SQL para AtencionMedica")
            atenciones = await prisma.$queryRawUnsafe(`
                SELECT am.*, 
                       p."razonSocial" as "p_razonSocial", 
                       p."numeroIdentificacion" as "p_numeroIdentificacion",
                       p."tipoIdentificacion" as "p_tipoIdentificacion",
                       p."email" as "p_email", 
                       p."telefono" as "p_telefono",
                       p."direccion" as "p_direccion"
                FROM "AtencionMedica" am
                JOIN "Paciente" p ON am."pacienteId" = p."id"
                WHERE am."medicoId" = $1 
                  AND am."estado" = 'PENDIENTE' 
                  -- AND am."fecha" >= $2 (Eliminado)
                ORDER BY am."fecha" DESC
                LIMIT 50
            `, session.user.id, today)

            atenciones = atenciones.map((at: any) => ({
                id: at.id,
                estado: at.estado,
                fecha: at.fecha,
                pacienteId: at.pacienteId,
                paciente: {
                    id: at.pacienteId,
                    razonSocial: at.p_razonSocial,
                    numeroIdentificacion: at.p_numeroIdentificacion,
                    tipoIdentificacion: at.p_tipoIdentificacion,
                    email: at.p_email,
                    telefono: at.p_telefono,
                    direccion: at.p_direccion
                }
            }))
        }

        return atenciones.map((at: any) => ({
            id: at.paciente.id,
            atencionId: at.id,
            medicoId: session?.user?.id || "unknown", // Satisfacer interfaz
            nombres: at.paciente.razonSocial,
            apellidos: "", // No separado en DB
            numeroIdentificacion: at.paciente.numeroIdentificacion,
            tipoIdentificacion: at.paciente.tipoIdentificacion.toLowerCase() as "cedula" | "ruc",
            email: at.paciente.email || "",
            telefono: at.paciente.telefono || "",
            direccion: at.paciente.direccion || "",
            fechaEnvio: at.fecha.toISOString(),
            estado: "pendiente" as const
        }))

    } catch (error) {
        console.error("Error al obtener pacientes:", error)
        return []
    }
}

export async function deletePacienteAction(id: string) {
    const session = await auth()
    console.log(`� Archivando paciente ID: ${id}`)

    if (!session?.user?.id) {
        console.warn("❌ No se pudo archivar: Usuario no autenticado")
        return { success: false, error: "No autorizado" }
    }

    try {
        // En lugar de borrar físicamente, cambiamos el estado para proteger el historial
        try {
            await (prisma as any).paciente.update({
                where: { id },
                data: { activo: false }
            })
        } catch (e: any) {
            console.warn("⚠️ Fallback SQL para archivar paciente:", e.message)
            await prisma.$executeRawUnsafe(
                `UPDATE "Paciente" SET "activo" = false WHERE "id" = $1`,
                id
            )
        }

        // También limpiamos cualquier atención médica pendiente que tuviera este paciente
        try {
            if ((prisma as any).atencionMedica) {
                await (prisma as any).atencionMedica.updateMany({
                    where: {
                        pacienteId: id,
                        medicoId: session.user.id,
                        estado: "PENDIENTE"
                    },
                    data: { estado: "COMPLETADO" }
                })
            } else { throw new Error("ORM Sync") }
        } catch (e) {
            console.warn("⚠️ Fallback SQL para limpiar cola en archivado")
            await prisma.$executeRawUnsafe(
                `UPDATE "AtencionMedica" SET "estado" = 'COMPLETADO' 
                 WHERE "pacienteId" = $1 AND "medicoId" = $2 AND "estado" = 'PENDIENTE'`,
                id, session.user.id
            )
        }

        console.log("✅ Paciente movido al archivo con éxito.")
        return { success: true }
    } catch (error: any) {
        console.error("❌ Error archiving paciente:", error)
        return {
            success: false,
            error: error?.message || "Error al archivar el paciente"
        }
    }
}

export async function getPacientesArchivadosAction() {
    const session = await auth()
    if (!session?.user?.id) return []

    try {
        let pacientes: any[] = []
        try {
            pacientes = await (prisma as any).paciente.findMany({
                where: { activo: false },
                orderBy: { updatedAt: 'desc' },
                take: 100
            })
        } catch (e) {
            console.warn("⚠️ Fallback SQL para buscar pacientes archivados")
            pacientes = await prisma.$queryRawUnsafe(
                `SELECT * FROM "Paciente" WHERE "activo" = false ORDER BY "updatedAt" DESC LIMIT 100`
            )
        }

        return pacientes.map((p: any) => ({
            id: p.id,
            nombres: p.razonSocial,
            numeroIdentificacion: p.numeroIdentificacion,
            tipoIdentificacion: p.tipoIdentificacion.toLowerCase(),
            email: p.email || "",
            telefono: p.telefono || "",
            direccion: p.direccion || "",
            fechaEnvio: p.updatedAt.toISOString(),
            estado: "archivado"
        }))
    } catch (error) {
        console.error("Error al obtener pacientes archivados:", error)
        return []
    }
}

export async function restaurarPacienteAction(id: string) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "No autorizado" }

    try {
        try {
            await (prisma as any).paciente.update({
                where: { id },
                data: { activo: true }
            })
        } catch (e) {
            console.warn("⚠️ Fallback SQL para restaurar paciente")
            await prisma.$executeRawUnsafe(
                `UPDATE "Paciente" SET "activo" = true WHERE "id" = $1`,
                id
            )
        }

        // Al restaurar, lo ponemos de nuevo en la cola de atención para HOY
        console.log(`📌 Encolando atención para paciente restaurado: ${id}`)
        try {
            if ((prisma as any).atencionMedica) {
                await (prisma as any).atencionMedica.create({
                    data: {
                        medicoId: session.user.id,
                        pacienteId: id,
                        estado: "PENDIENTE"
                    }
                })
            } else {
                throw new Error("Client sync error")
            }
        } catch (err) {
            console.warn("⚠️ Fallback SQL para encolado en restauración")
            const idAtencion = Math.random().toString(36).substring(2, 15)
            await prisma.$executeRawUnsafe(
                `INSERT INTO "AtencionMedica" ("id", "medicoId", "pacienteId", "fecha", "estado") 
                 VALUES ($1, $2, $3, NOW(), 'PENDIENTE')`,
                idAtencion, session.user.id, id
            )
        }

        console.log(`✅ Paciente ${id} restaurado y encolado correctamente.`)
        return { success: true }
    } catch (error: any) {
        console.error("Error restaurando paciente:", error)
        return { success: false, error: error.message }
    }
}
