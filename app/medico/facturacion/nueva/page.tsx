import { auth } from "@/auth"
import { redirect } from "next/navigation"
import NuevaFacturaClient from "./nueva-factura-client"
import { prisma } from "@/lib/prisma"

export default async function NuevaFacturaPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/medico/login")
    }

    // Fetch ONLY patients in the queue (PENDIENTE status)
    const atencionesPendientes = await prisma.atencionMedica.findMany({
        where: {
            medicoId: session.user.id,
            estado: "PENDIENTE"
        },
        include: {
            paciente: {
                include: {
                    facturas: {
                        where: {
                            userId: session.user.id,
                            estado: "BORRADOR"
                        },
                        take: 1,
                        orderBy: { updatedAt: 'desc' }
                    }
                }
            }
        },
        orderBy: { fecha: 'asc' }
    })

    // Extract patients from the queue
    const pacientes = atencionesPendientes.map(atencion => ({
        ...atencion.paciente,
        tieneBorrador: atencion.paciente.facturas.length > 0
    }))

    // Fetch medico profile for defaults (IVA, currency)
    const medicoProfile = await prisma.medicoProfile.findUnique({
        where: { userId: session.user.id },
        select: {
            ivaDefecto: true,
            monedaDefecto: true,
            puntoEmision: true,
            establecimiento: true
        }
    })

    // Fetch sequencial info
    const puntoEmisionConfig = await (prisma as any).puntoEmisionConfig.findUnique({
        where: {
            medicoId_establecimiento_puntoEmision: {
                medicoId: session.user.id,
                establecimiento: medicoProfile?.establecimiento || "001",
                puntoEmision: medicoProfile?.puntoEmision || "001"
            }
        }
    })

    const nextSecuencial = ((puntoEmisionConfig?.ultimoSecuencial || 0) + 1).toString().padStart(9, "0")

    // Serializar datos para evitar error "Decimal objects not supported"
    const serializedPacientes = JSON.parse(JSON.stringify(pacientes))


    return <NuevaFacturaClient
        initialPacientes={serializedPacientes}
        config={{
            ivaPorcentaje: medicoProfile?.ivaDefecto ?? 12,
            moneda: medicoProfile?.monedaDefecto || "USD",
            establecimiento: medicoProfile?.establecimiento || "001",
            puntoEmision: medicoProfile?.puntoEmision || "001",
            secuencial: nextSecuencial
        }}
    />
}
