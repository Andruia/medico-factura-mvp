import { NextResponse } from "next/server"
import { BackgroundProcessor } from "@/lib/sri/background-processor"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
    try {
        console.log("⏰ [Cron] Iniciando procesamiento de facturas SRI...")
        
        // Ejecutar el procesador en segundo plano
        const result = await BackgroundProcessor.processAllPending()
        
        console.log(`⏰ [Cron] Procesamiento finalizado. Facturas afectadas: ${result.processedCount}. Errores: ${result.errors.length}`)
        
        return NextResponse.json({
            success: true,
            processedCount: result.processedCount,
            errors: result.errors
        })

    } catch (error: any) {
        console.error("❌ [Cron] Error ejecutando cron:", error.message)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

// Permitir también solicitudes POST
export async function POST(req: Request) {
    return GET(req)
}
