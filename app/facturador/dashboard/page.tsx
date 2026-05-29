"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  User,
  Settings,
  Download,
} from "lucide-react"
import Link from "next/link"

interface SolicitudFacturacion {
  id: string
  paciente: {
    nombres: string
    apellidos: string
    numeroIdentificacion: string
    tipoIdentificacion: "cedula" | "ruc"
    email: string
    telefono: string
    direccion: string
  }
  servicio: {
    codigo: string
    nombre: string
    descripcion: string
    precio: number
    iva: number
  }
  medico: {
    nombre: string
    especialidad: string
    consultorio?: string
    id?: string
  }
  observaciones: string
  fechaProcesamiento: string
  estado: "pendiente" | "procesando" | "completado" | "error"
  total: number
  numeroFactura?: string
  claveAcceso?: string
}

interface FacturadorSession {
  id: string
  nombre: string
  email: string
  empresa: string
}

export default function FacturadorDashboard() {
  const [facturador, setFacturador] = useState<FacturadorSession | null>(null)
  const [solicitudes, setSolicitudes] = useState<SolicitudFacturacion[]>([])
  const [solicitudProcesando, setSolicitudProcesando] = useState<string | null>(null)

  useEffect(() => {
    const session = localStorage.getItem("facturador-session")
    if (session) {
      setFacturador(JSON.parse(session))
    }
    cargarSolicitudes()
  }, [])

  const cargarSolicitudes = () => {
    const solicitudesGuardadas = localStorage.getItem("solicitudes-facturacion")
    if (solicitudesGuardadas) {
      const solicitudesData = JSON.parse(solicitudesGuardadas)
      // Agregar información del médico simulada
      const solicitudesConMedico = solicitudesData.map((s: any) => ({
        ...s,
        medico: {
          nombre: "Dr. Juan Martínez",
          especialidad: "Cardiología",
          consultorio: "Consultorio 202",
          id: "MED001",
        },
        estado: s.estado || "pendiente",
      }))
      setSolicitudes(solicitudesConMedico)
    }
  }

  const procesarFactura = async (solicitudId: string) => {
    // Verificar configuración antes de procesar
    const certificados = localStorage.getItem("certificados-medico-MED001")
    const configSRI = localStorage.getItem("configuracion-sri-MED001")

    if (!certificados || !configSRI) {
      alert("Configuración incompleta. Por favor configure certificados y SRI antes de procesar facturas.")
      return
    }

    setSolicitudProcesando(solicitudId)

    // Simular procesamiento con SRI
    setTimeout(() => {
      const numeroFactura = `001-001-${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`
      const claveAcceso = `${new Date().getFullYear()}${String(Math.floor(Math.random() * 999999999)).padStart(9, "0")}`

      const solicitudesActualizadas = solicitudes.map((s) =>
        s.id === solicitudId
          ? {
              ...s,
              estado: "completado" as const,
              numeroFactura,
              claveAcceso,
            }
          : s,
      )

      setSolicitudes(solicitudesActualizadas)
      localStorage.setItem("solicitudes-facturacion", JSON.stringify(solicitudesActualizadas))
      setSolicitudProcesando(null)

      // Simular envío de email al paciente
      alert("Factura procesada y enviada al paciente exitosamente")
    }, 3000)
  }

  const formatearTelefono = (numero: string) => {
    return numero.replace(/(\d{4})(\d{3})(\d{3})/, "$1-$2-$3")
  }

  const tiempoEspera = (fecha: string) => {
    const ahora = new Date()
    const procesamiento = new Date(fecha)
    const diferencia = Math.floor((ahora.getTime() - procesamiento.getTime()) / (1000 * 60))

    if (diferencia < 60) {
      return `${diferencia} min`
    } else {
      const horas = Math.floor(diferencia / 60)
      return `${horas}h ${diferencia % 60}min`
    }
  }

  const solicitudesPendientes = solicitudes.filter((s) => s.estado === "pendiente")
  const solicitudesCompletadas = solicitudes.filter((s) => s.estado === "completado")
  const ingresosTotales = solicitudesCompletadas.reduce((acc, s) => acc + s.total, 0)

  if (!facturador) {
    return <div>Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel de Facturación</h1>
              <p className="text-gray-600">Bienvenido, {facturador.nombre}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/facturador/configuracion">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configuración
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem("facturador-session")
                  window.location.href = "/facturador/login"
                }}
              >
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{solicitudesPendientes.length}</div>
              <p className="text-xs text-muted-foreground">Esperando procesamiento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completadas Hoy</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{solicitudesCompletadas.length}</div>
              <p className="text-xs text-muted-foreground">Facturas emitidas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${ingresosTotales.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Total facturado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3.2 min</div>
              <p className="text-xs text-muted-foreground">Por factura</p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        {solicitudesPendientes.length > 0 && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Tiene {solicitudesPendientes.length} solicitud(es) de facturación pendiente(s) de procesar.
            </AlertDescription>
          </Alert>
        )}

        {/* Solicitudes Pendientes */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Solicitudes de Facturación</h2>

          {solicitudesPendientes.map((solicitud) => (
            <Card key={solicitud.id} className="border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {solicitud.paciente.nombres} {solicitud.paciente.apellidos}
                    </CardTitle>
                    <CardDescription>
                      Solicitud de {solicitud.medico.nombre} - {solicitud.medico.especialidad}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {tiempoEspera(solicitud.fechaProcesamiento)}
                    </Badge>
                    <Badge variant="secondary">ID: {solicitud.id.slice(-6)}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Datos del Paciente */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Datos del Paciente</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>
                        {solicitud.paciente.tipoIdentificacion === "cedula" ? "CI" : "RUC"}:{" "}
                        {solicitud.paciente.numeroIdentificacion}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{solicitud.paciente.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{formatearTelefono(solicitud.paciente.telefono)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="truncate">{solicitud.paciente.direccion}</span>
                    </div>
                  </div>
                </div>

                {/* Información del Médico */}
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Médico</h3>
                  <p className="font-medium">{solicitud.medico.nombre}</p>
                  <p className="text-sm text-gray-600">{solicitud.medico.consultorio}</p>
                  <p className="text-xs text-gray-500">ID: {solicitud.medico.id}</p>
                </div>

                {/* Servicio y Totales */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Servicio</h3>
                    <p className="font-medium">{solicitud.servicio.nombre}</p>
                    <p className="text-sm text-gray-600">{solicitud.servicio.descripcion}</p>
                    <p className="text-xs text-gray-500 mt-1">Código: {solicitud.servicio.codigo}</p>
                    {solicitud.observaciones && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Observaciones:</p>
                        <p className="text-sm">{solicitud.observaciones}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Totales</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${solicitud.servicio.precio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA ({solicitud.servicio.iva}%):</span>
                        <span>${((solicitud.servicio.precio * solicitud.servicio.iva) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-green-900 border-t border-green-300 pt-1">
                        <span>Total:</span>
                        <span>${solicitud.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => procesarFactura(solicitud.id)}
                    disabled={solicitudProcesando === solicitud.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {solicitudProcesando === solicitud.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Procesando con SRI...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Procesar Factura
                      </>
                    )}
                  </Button>
                  <Button variant="outline">Ver Detalles</Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Facturas Completadas */}
          {solicitudesCompletadas.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Facturas Completadas</h2>
              <div className="space-y-3">
                {solicitudesCompletadas.map((solicitud) => (
                  <Card key={solicitud.id} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">
                            {solicitud.paciente.nombres} {solicitud.paciente.apellidos}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {solicitud.servicio.nombre} - ${solicitud.total.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Factura: {solicitud.numeroFactura} | Clave: {solicitud.claveAcceso?.slice(0, 10)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completado
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {solicitudes.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay solicitudes</h3>
                <p className="text-gray-600">Las solicitudes de facturación aparecerán aquí</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
