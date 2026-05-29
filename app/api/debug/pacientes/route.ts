import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const count = await prisma.paciente.count()
        const pacientes = await prisma.paciente.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json({
            total: count,
            data: pacientes
        })
    } catch (error) {
        return NextResponse.json({ error: "Error fetching patients", details: String(error) }, { status: 500 })
    }
}
