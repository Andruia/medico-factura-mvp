"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QrCode, Users, FileText, Settings, Plus, Eye, Wifi, WifiOff, Shield, ArrowLeft, Clock, RefreshCw, CheckCircle2, XCircle, AlertCircle, ExternalLink, Trash2, Archive } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ConnectionStatus } from "@/components/websocket/connection-status"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { useWebSocket } from "@/hooks/use-websocket"
import { cacheManager } from "@/lib/cache/cache-manager"
import { consultarEstadoFacturaAction } from "../facturacion/actions-facturacion"
import { deleteFacturaAction } from "../facturacion/actions"
import { getDashboardDataAction, checkDraftsAction } from "./actions"

interface MedicoSession {
  id: string
  nombre: string
  email: string
  consultorio: string
}

export default function MedicoDashboard({ initialMedico }: { initialMedico: MedicoSession }) {
  const [medico, setMedico] = useState<MedicoSession | null>(initialMedico)
  const [stats, setStats] = useState({
    pacientesHoy: 8,
    facturasHoy: 6,
    ingresosDia: 180,
    qrActivos: 1,
  })
  const [pacientesPendientes, setPacientesPendientes] = useState<any[]>([])
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [medicoProfile, setMedicoProfile] = useState<any>(null)
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [checkingId, setCheckingId] = useState<string | null>(null)

  const router = useRouter()

  // WebSocket para tiempo real
  const { connectionState, isConnected, emit, on } = useWebSocket({
    namespace: "/medicos",
    token: "demo-token",
    autoConnect: true,
    onConnect: () => {
      // console.log("✅ Dashboard conectado") // SILENCED
      emit("solicitar_pacientes_pendientes")
    },
  })

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    // Escuchar actualizaciones en tiempo real
    on("pacientes_pendientes", async (data: any[]) => {
      setPacientesPendientes(data)

      // Re-verificar borradores porque el WS no devuelve ese flag
      try {
        const ids = data.map(d => d.id)
        if (ids.length > 0) {
          const drafts = await checkDraftsAction(ids)
          setPacientesPendientes(prev => prev.map(p => ({
            ...p,
            hasDraft: drafts[p.id] || false
          })))
        }
      } catch (e) {
        console.error("Error syncing drafts with WS", e)
      }

      // Guardar en cache
      cacheManager.set("pacientes_pendientes", data, 60, ["pacientes"])
    })

    on("nuevo_paciente", (data: any) => {
      setPacientesPendientes((prev) => [data, ...prev])
      setStats((prev) => ({ ...prev, pacientesHoy: prev.pacientesHoy + 1 }))
    })

    on("factura_completada", (data: any) => {
      setStats((prev) => ({ ...prev, facturasHoy: prev.facturasHoy + 1 }))
    })

    // Cargar estadísticas de cache
    const cargarCacheStats = async () => {
      const stats = await cacheManager.getStats()
      setCacheStats(stats)
    }

    cargarCacheStats()
    const interval = setInterval(cargarCacheStats, 10000) // Cada 10 segundos

    return () => clearInterval(interval)
  }, [on])

  const cargarDatosIniciales = async () => {
    try {
      const data = await getDashboardDataAction()

      // Validación defensiva: verificar que data existe
      if (!data) {
        console.error("getDashboardDataAction returned null/undefined")
        return
      }

      if (data.pacientesPendientes) {
        setPacientesPendientes(data.pacientesPendientes as any)
      }
      if (data.medicoProfile) {
        setMedicoProfile(data.medicoProfile)
      }
      if (data.recentInvoices) {
        setRecentInvoices(data.recentInvoices)
      }
    } catch (e) {
      console.error("Error loading dashboard data", e)
    }
  }

  const handleCheckStatus = async (facturaId: string) => {
    setCheckingId(facturaId)
    try {
      const result = await consultarEstadoFacturaAction(facturaId)
      if (result.success) {
        // Refresh data
        cargarDatosIniciales()
      } else {
        alert("Error al consultar: " + result.error)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCheckingId(null)
    }
  }

  const handleDeleteFactura = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar esta factura? Si lo haces, podrás eliminar al paciente asociado o volver a facturarlo. Esta acción no se puede deshacer.")) {
      return
    }

    setCheckingId(id)
    try {
      const result = await deleteFacturaAction(id)
      if (result.success) {
        setRecentInvoices(prev => prev.filter(inv => inv.id !== id))
        cargarDatosIniciales()
      } else {
        alert("Error al eliminar: " + result.error)
      }
    } catch (e) {
      console.error("Error deleting factura", e)
      alert("Error de conexión al eliminar")
    } finally {
      setCheckingId(null)
    }
  }

  const actualizarPaciente = (pacienteId: string) => {
    emit("validar_paciente", { pacienteId })
    // Optimistic update
    setPacientesPendientes((prev) => prev.filter((p) => p.id !== pacienteId))
  }

  if (!medico) {
    return <div>Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con estado de conexión */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
              <p className="text-gray-600">Bienvenido, {medico.nombre}</p>
            </div>
            <div className="flex items-center gap-4">
              <ConnectionStatus connectionState={connectionState} />
              <NotificationCenter />
              <Link href="/medico/configuracion">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configuración
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // TODO: Implement server-side logout / signout
                  window.location.href = "/medico/login"
                }}
              >
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Alerta de conexión */}
        {!isConnected && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Modo Sin Conexión</p>
                <p className="text-sm text-yellow-700">
                  Algunas funciones pueden estar limitadas. Los datos se sincronizarán cuando se restablezca la
                  conexión.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards con indicadores de tiempo real */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pacientes Hoy</CardTitle>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {isConnected && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pacientesHoy}</div>
              <p className="text-xs text-muted-foreground">{pacientesPendientes.length} pendientes de validación</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facturas Hoy</CardTitle>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {isConnected && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.facturasHoy}</div>
              <p className="text-xs text-muted-foreground">2 pendientes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Día</CardTitle>
              <span className="text-green-600">$</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.ingresosDia}</div>
              <p className="text-xs text-muted-foreground">+15% vs ayer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado SRI</CardTitle>
              <Shield className={`h-4 w-4 ${medicoProfile?.ruc ? "text-green-600" : "text-gray-400"}`} />
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                {medicoProfile?.ruc ? (
                  <Badge variant={medicoProfile.ambiente === "produccion" ? "default" : "secondary"} className={medicoProfile.ambiente === "produccion" ? "bg-green-600 hover:bg-green-700" : "bg-blue-100 text-blue-800 hover:bg-blue-200"}>
                    {medicoProfile.ambiente === "produccion" ? "Producción" : "Ambiente Pruebas"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                    Configuración Pendiente
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {medicoProfile?.ruc
                  ? `RUC: ${medicoProfile.ruc}`
                  : "Complete su perfil para emitir facturas"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pacientes Pendientes en Tiempo Real */}
        {pacientesPendientes.length > 0 && (
          <Card className="mb-8 border-orange-200 bg-orange-50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <Users className="h-5 w-5" />
                  Pacientes por Validar
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                    {pacientesPendientes.length} pendientes
                  </Badge>
                </CardTitle>
                <Link href="/medico/pacientes">
                  <Button variant="ghost" size="sm" className="text-orange-700 hover:text-orange-900 hover:bg-orange-100">
                    Gestionar Todos <ArrowLeft className="h-4 w-4 ml-1 rotate-180" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {pacientesPendientes.map((paciente, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                        {paciente.datos?.nombres?.charAt(0) || "P"}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {paciente.datos?.nombres || "Paciente"}
                          {paciente.hasDraft && (
                            <Badge variant="outline" className="text-[10px] h-5 bg-yellow-50 text-yellow-700 border-yellow-200 px-1.5 py-0">
                              Borrador
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {new Date(paciente.fechaRegistro).toLocaleDateString()}
                          <span>•</span>
                          <span className={isConnected ? "text-green-600" : "text-gray-500"}>
                            {isConnected ? "En línea" : "Cache"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => window.location.href = `/medico/facturacion/nueva?pacienteId=${paciente.id}`} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                      Facturar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Facturas Recientes */}
        <div className="mb-8">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-700" />
                  Emisiones Recientes
                </CardTitle>
                <CardDescription>Estado de tus últimos documentos enviados al SRI</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => cargarDatosIniciales()} disabled={checkingId === 'global'}>
                <RefreshCw className={`h-4 w-4 mr-1 ${checkingId === 'global' ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3">Secuencial</th>
                      <th className="px-4 py-3">Paciente</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-center">Estado SRI</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentInvoices.length > 0 ? (
                      recentInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{inv.secuencial}</td>
                          <td className="px-4 py-3 text-gray-600">{inv.paciente}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 text-right">${Number(inv.total).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center">
                              {inv.estado === "AUTORIZADO" ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 flex gap-1 items-center font-normal">
                                  <CheckCircle2 className="h-3 w-3" /> Autorizado
                                </Badge>
                              ) : inv.estado === "RECHAZADO" ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Badge variant="destructive" className="flex gap-1 items-center font-normal">
                                    <XCircle className="h-3 w-3" /> Rechazado
                                  </Badge>
                                  {inv.error && (
                                    <span className="text-[10px] text-red-600 max-w-[150px] truncate" title={inv.error}>
                                      {inv.error}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 flex gap-1 items-center animate-pulse font-normal">
                                  <AlertCircle className="h-3 w-3" /> Pendiente
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {inv.estado === "RECIBIDA" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCheckStatus(inv.id)}
                                  disabled={checkingId === inv.id}
                                  title="Validar autorización"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
                                >
                                  <RefreshCw className={`h-4 w-4 ${checkingId === inv.id ? 'animate-spin' : ''}`} />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`/api/facturacion/pdf/${inv.id}`, '_blank')}
                                title="Ver RIDE"
                                className="text-gray-400 hover:text-gray-900 h-8 w-8 p-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteFactura(inv.id)}
                                disabled={checkingId === inv.id}
                                title="Eliminar factura"
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                              >
                                {checkingId === inv.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">
                          No se han emitido facturas recientemente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {/* QR Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Código QR Unificado
              </CardTitle>
              <CardDescription>Gestiona el código QR principal de tu consultorio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">QR Principal - {medico.consultorio}</h3>
                  <p className="text-sm text-gray-600">
                    {isConnected ? "Activo • Tiempo real" : "Activo • Modo offline"}
                  </p>
                </div>
                <Badge variant="secondary">Activo</Badge>
              </div>

              <div className="flex gap-2">
                <Link href="/medico/qr/generar" className="flex-1">
                  <Button className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Generar QR
                  </Button>
                </Link>
                <Link href="/medico/qr/ver">
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Ver QR
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Patient Management & Archive */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Pacientes y Historial
                {isConnected && <Wifi className="h-4 w-4 text-green-600" />}
              </CardTitle>
              <CardDescription>
                Acceda a la cola de atención y al archivo histórico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                {pacientesPendientes.length > 0 ? (
                  <div className="text-sm text-gray-600">
                    <p className="font-semibold text-orange-600 text-lg">{pacientesPendientes.length}</p>
                    <p>pacientes esperando en cola hoy</p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2 opacity-50" />
                    <p>No hay pacientes en cola.</p>
                    <p className="text-xs">Puede restaurar pacientes desde el archivo.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Link href="/medico/pacientes">
                  <Button className="w-full bg-orange-600 hover:bg-orange-700">
                    Gestionar Cola de Hoy
                  </Button>
                </Link>
                <Link href="/medico/pacientes?tab=archivados">
                  <Button variant="outline" className="w-full">
                    <Archive className="h-4 w-4 mr-2" />
                    Ver Archivo Histórico
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Acciones Rápidas</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <Link href="/medico/facturacion/nueva">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-200 bg-blue-50">
                <CardContent className="p-4 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="font-semibold text-blue-900">Nueva Factura</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/paciente/formulario?medico=${medico.id}`} target="_blank">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold text-green-900">Test Form Paciente</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/medico/pacientes?tab=archivados">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-orange-200 bg-orange-50">
                <CardContent className="p-4 text-center">
                  <Archive className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <p className="font-semibold text-orange-900">Historial y Archivo</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/medico/configuracion">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 text-center">
                  <Settings className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="font-medium">Configuración</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/medico/qr/generar">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 text-center">
                  <QrCode className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                  <p className="font-medium">Configurar QR</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/medico/servicios">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-indigo-200 bg-indigo-50">
                <CardContent className="p-4 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                  <p className="font-semibold text-indigo-900">Mis Servicios/Productos</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Debug Info (solo en desarrollo) */}
        {process.env.NODE_ENV === "development" && cacheStats && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Debug - Cache Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p>
                    <strong>Hit Rate:</strong> {cacheStats.l1.hitRate.toFixed(1)}%
                  </p>
                  <p>
                    <strong>Size:</strong> {cacheStats.l1.size}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Hits:</strong> {cacheStats.l1.hitCount}
                  </p>
                  <p>
                    <strong>Misses:</strong> {cacheStats.l1.missCount}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>WebSocket:</strong> {connectionState}
                  </p>
                  <p>
                    <strong>Notifications:</strong> Activo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
