"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, X, Check, AlertCircle, User, DollarSign } from "lucide-react"
import { useWebSocket } from "@/hooks/use-websocket"
import type { NotificacionPaciente, CambioPrecio, EstadoFactura } from "@/lib/websocket/types"

interface Notificacion {
  id: string
  tipo: "paciente" | "precio" | "factura" | "sistema"
  titulo: string
  mensaje: string
  timestamp: Date
  leida: boolean
  datos?: any
}

export function NotificationCenter() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [mostrarPanel, setMostrarPanel] = useState(false)
  const [usuario, setUsuario] = useState<any>(null)

  useEffect(() => {
    const session = localStorage.getItem("medico-session")
    if (session) {
      setUsuario(JSON.parse(session))
    }
  }, [])

  const { connectionState, emit, on } = useWebSocket({
    namespace: "/medicos",
    token: "demo-token",
    autoConnect: true,
    onConnect: () => {
      // console.log("🔔 Sistema de notificaciones conectado") // SILENCED
      // Solicitar notificaciones pendientes
      emit("solicitar_notificaciones_pendientes")
    },
  })

  useEffect(() => {
    // Escuchar nuevos pacientes
    on("nuevo_paciente", (data: NotificacionPaciente) => {
      agregarNotificacion({
        id: `paciente-${Date.now()}`,
        tipo: "paciente",
        titulo: "Nuevo Paciente",
        mensaje: `${data.datos.nombres} ${data.datos.apellidos} ha completado sus datos`,
        timestamp: new Date(),
        leida: false,
        datos: data,
      })
    })

    // Escuchar cambios de precio
    on("precio_actualizado", (data: CambioPrecio) => {
      agregarNotificacion({
        id: `precio-${Date.now()}`,
        tipo: "precio",
        titulo: "Precio Actualizado",
        mensaje: `Servicio actualizado: $${data.precioAnterior} → $${data.precioNuevo}`,
        timestamp: new Date(),
        leida: false,
        datos: data,
      })
    })

    // Escuchar estados de factura
    on("factura_completada", (data: EstadoFactura) => {
      agregarNotificacion({
        id: `factura-${Date.now()}`,
        tipo: "factura",
        titulo: "Factura Completada",
        mensaje: `Factura ${data.numeroFactura} procesada exitosamente`,
        timestamp: new Date(),
        leida: false,
        datos: data,
      })
    })

    // Simular algunas notificaciones iniciales
    // NOTA: Se comenta para evitar duplicados en React Strict Mode
    /*
    setTimeout(() => {
      agregarNotificacion({
        id: "demo-1",
        tipo: "paciente",
        titulo: "Paciente Pendiente",
        mensaje: "María González está esperando validación",
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        leida: false,
        })
    */
  }, [on, emit])

  const agregarNotificacion = (notificacion: Notificacion) => {
    setNotificaciones((prev) => [notificacion, ...prev].slice(0, 50)) // Mantener solo 50

    // Mostrar notificación del navegador si está permitido
    if (Notification.permission === "granted") {
      new Notification(notificacion.titulo, {
        body: notificacion.mensaje,
        icon: "/favicon.ico",
      })
    }
  }

  const marcarComoLeida = (id: string) => {
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
  }

  const eliminarNotificacion = (id: string) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id))
  }

  const marcarTodasComoLeidas = () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
  }

  const notificacionesNoLeidas = notificaciones.filter((n) => !n.leida).length

  const getIconoTipo = (tipo: string) => {
    switch (tipo) {
      case "paciente":
        return <User className="h-4 w-4 text-blue-600" />
      case "precio":
        return <DollarSign className="h-4 w-4 text-green-600" />
      case "factura":
        return <Check className="h-4 w-4 text-purple-600" />
      case "sistema":
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const formatearTiempo = (timestamp: Date) => {
    const ahora = new Date()
    const diferencia = ahora.getTime() - timestamp.getTime()
    const minutos = Math.floor(diferencia / (1000 * 60))

    if (minutos < 1) return "Ahora"
    if (minutos < 60) return `${minutos}m`
    if (minutos < 1440) return `${Math.floor(minutos / 60)}h`
    return `${Math.floor(minutos / 1440)}d`
  }

  return (
    <div className="relative">
      {/* Botón de notificaciones */}
      <Button variant="outline" size="sm" onClick={() => setMostrarPanel(!mostrarPanel)} className="relative">
        <Bell className="h-4 w-4" />
        {notificacionesNoLeidas > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {notificacionesNoLeidas > 99 ? "99+" : notificacionesNoLeidas}
          </Badge>
        )}
      </Button>

      {/* Panel de notificaciones */}
      {mostrarPanel && (
        <Card className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-hidden z-50 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notificaciones</CardTitle>
              <div className="flex items-center gap-2">
                {notificacionesNoLeidas > 0 && (
                  <Button variant="ghost" size="sm" onClick={marcarTodasComoLeidas} className="text-xs">
                    Marcar todas
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setMostrarPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 max-h-80 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notificaciones.map((notificacion) => (
                  <div
                    key={notificacion.id}
                    className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${!notificacion.leida ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                      }`}
                    onClick={() => marcarComoLeida(notificacion.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1">
                        {getIconoTipo(notificacion.tipo)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{notificacion.titulo}</p>
                          <p className="text-xs text-gray-600 line-clamp-2">{notificacion.mensaje}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatearTiempo(notificacion.timestamp)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          eliminarNotificacion(notificacion.id)
                        }}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
