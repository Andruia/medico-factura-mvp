"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function registrarPacienteAction(data: any) {
    try {
        // Validate required fields
        if (!data.numeroIdentificacion || !data.nombres || !data.apellidos) {
            return { success: false, error: "Datos incompletos" }
        }

        const razonSocial = `${data.nombres} ${data.apellidos}`.trim()

        // Upsert: Create or Update if exists (by identification number)
        const paciente = await prisma.paciente.upsert({
            where: {
                numeroIdentificacion: data.numeroIdentificacion
            },
            update: {
                tipoIdentificacion: data.tipoIdentificacion === "cedula" ? "CEDULA" : "RUC", // Standardize enum/string
                razonSocial: razonSocial,
                email: data.email,
                telefono: data.telefono,
                direccion: data.direccion,
                updatedAt: new Date()
            },
            create: {
                tipoIdentificacion: data.tipoIdentificacion === "cedula" ? "CEDULA" : "RUC",
                numeroIdentificacion: data.numeroIdentificacion,
                razonSocial: razonSocial,
                email: data.email,
                telefono: data.telefono,
                direccion: data.direccion
            }
        })

        console.log("Paciente registrado:", paciente)

        // Crear registro de atención pendiente para el médico
        if (data.medicoId) {
            console.log(`📌 Intentando encolar atención para médico: ${data.medicoId}`)
            try {
                // Intento vía Prisma Client (si existe en el objeto)
                if ((prisma as any).atencionMedica) {
                    await (prisma as any).atencionMedica.create({
                        data: {
                            medicoId: data.medicoId,
                            pacienteId: paciente.id,
                            estado: "PENDIENTE"
                        }
                    })
                } else {
                    throw new Error("Modelo AtencionMedica no disponible en el cliente Prisma")
                }
            } catch (atencionError: any) {
                console.warn("⚠️ Fallo encolado vía Prisma Client, reintentando vía SQL directo:", atencionError.message)
                // Fallback via SQL directo para evitar bloqueos por regeneración fallida de Prisma
                const idAtencion = Math.random().toString(36).substring(2, 15) // Simular CUID simple si no hay
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "AtencionMedica" ("id", "medicoId", "pacienteId", "fecha", "estado") 
                     VALUES ($1, $2, $3, NOW(), 'PENDIENTE')`,
                    idAtencion, data.medicoId, paciente.id
                )
            }
        }

        revalidatePath("/medico/dashboard")
        return { success: true, pacienteId: paciente.id }

    } catch (error: any) {
        console.error("❌ Error registering patient:", error)
        return {
            success: false,
            error: `Error al registrar: ${error.message || 'Error desconocido'}`
        }
    }
}
