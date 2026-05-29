import { NextResponse } from "next/server"
import { cacheManager } from "@/lib/cache/cache-manager"

export async function GET() {
  try {
    const stats = await cacheManager.getStats()
    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json({ error: "Error obteniendo estadísticas de cache" }, { status: 500 })
  }
}
