import { NextResponse } from "next/server"
import { cacheManager } from "@/lib/cache/cache-manager"

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    switch (type) {
      case "l1":
        cacheManager.clear()
        break
      case "all":
      default:
        cacheManager.clear()
        break
    }

    return NextResponse.json({ success: true, message: `Cache ${type} limpiado` })
  } catch (error) {
    return NextResponse.json({ error: "Error limpiando cache" }, { status: 500 })
  }
}
