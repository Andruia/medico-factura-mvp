import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ConnectionStatusProps {
  connectionState: string
  className?: string
}

export function ConnectionStatus({ connectionState, className = "" }: ConnectionStatusProps) {
  const getStatusConfig = (state: string) => {
    switch (state) {
      case "connected":
        return {
          variant: "default" as const,
          icon: "🟢",
          label: "Sincronizado",
          description: "La plataforma está sincronizada y recibiendo actualizaciones",
          color: "bg-green-500",
        }
      case "connecting":
        return {
          variant: "secondary" as const,
          icon: "🟡",
          label: "Estableciendo conexión segura...",
          description: "Sincronizando con el servidor central",
          color: "bg-yellow-500",
        }
      case "disconnected":
        return {
          variant: "destructive" as const,
          icon: "🔴",
          label: "Desconectado",
          description: "Sin conexión en tiempo real",
          color: "bg-red-500",
        }
      case "error":
        return {
          variant: "destructive" as const,
          icon: "❌",
          label: "Error",
          description: "Error de conexión - Reintentando automáticamente",
          color: "bg-red-500",
        }
      default:
        return {
          variant: "outline" as const,
          icon: "⚪",
          label: "Desconocido",
          description: "Estado no reconocido",
          color: "bg-gray-500",
        }
    }
  }

  const config = getStatusConfig(connectionState)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className={`flex items-center gap-1 ${className}`}>
            <div
              className={`w-2 h-2 rounded-full ${config.color} ${connectionState === "connecting" ? "animate-pulse" : ""}`}
            />
            <span className="text-xs">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
