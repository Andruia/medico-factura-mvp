"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock, Mail, Phone, MapPin, ArrowLeft, CheckCircle, AlertCircle, DollarSign, Trash2, Archive, Search, Filter, RotateCcw } from "lucide-react"
import Link from "next/link"
import { getPacientesPendientesAction, deletePacienteAction, getPacientesArchivadosAction, restaurarPacienteAction } from "./actions"

interface PacientePendiente {
  id: string
  medicoId: string
  nombres: string
  apellidos: string
  numeroIdentificacion: string
  tipoIdentificacion: "cedula" | "ruc"
  email: string
  telefono: string
  direccion: string
  fechaEnvio: string
  estado: "pendiente" | "validado" | "facturado"
}

interface Servicio {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  precio: number
  iva: number
  categoria: string
  activo: boolean
}

function GestionPacientesContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "archivados" ? "archivados" : "pendientes"

  const [pacientesPendientes, setPacientesPendientes] = useState<PacientePendiente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<PacientePendiente | null>(null)
  const [servicioSeleccionado, setServicioSeleccionado] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [mostrarModal, setMostrarModal] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [tabActiva, setTabActiva] = useState<"pendientes" | "archivados">(initialTab)
  const [pacientesArchivados, setPacientesArchivados] = useState<PacientePendiente[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (tabActiva === "pendientes") {
      cargarPacientesPendientes()
    } else {
      cargarPacientesArchivados()
    }
    cargarServicios()
  }, [tabActiva])

  const cargarPacientesPendientes = async () => {
    setCargando(true)
    try {
      const pacientes = await getPacientesPendientesAction()
      setPacientesPendientes(pacientes)
    } catch (error) {
      console.error("Error cargando pacientes:", error)
    } finally {
      setCargando(false)
    }
  }

  const cargarPacientesArchivados = async () => {
    setCargando(true)
    try {
      const pacientes = await getPacientesArchivadosAction()
      setPacientesArchivados(pacientes as any)
    } catch (error) {
      console.error("Error cargando archivados:", error)
    } finally {
      setCargando(false)
    }
  }

  const cargarServicios = () => {
    const medicoSession = localStorage.getItem("medico-session")
    if (!medicoSession) return

    const medico = JSON.parse(medicoSession)
    const serviciosGuardados = localStorage.getItem(`servicios-medico-${medico.id}`)

    if (serviciosGuardados) {
      const serviciosData = JSON.parse(serviciosGuardados)
      setServicios(serviciosData.filter((s: Servicio) => s.activo))
    }
  }

  const archivarPaciente = async (id: string, nombre: string) => {
    console.log(`📦 Clic en archivar paciente: ${nombre} (${id})`)
    if (!confirm(`¿Está seguro de archivar al paciente ${nombre}? Se guardarán sus datos pero ya no aparecerá en la lista de facturación pendiente.`)) {
      console.log("🚫 Archivado cancelado por el usuario")
      return
    }

    setEliminandoId(id)
    try {
      console.log("⏳ Llamando a archivePacienteAction (vía deletePacienteAction)...")
      const result = await deletePacienteAction(id)
      console.log("📥 Resultado de archivado:", result)

      if (result.success) {
        setPacientesPendientes((prev) => prev.filter(p => p.id !== id))
        alert("Paciente movido al archivo correctamente")
      } else {
        alert("Error: " + result.error)
      }
    } catch (error) {
      console.error("❌ Error al archivar:", error)
      alert("Error de conexión al archivar")
    } finally {
      setEliminandoId(null)
    }
  }

  const restaurarPaciente = async (id: string, nombre: string) => {
    if (!confirm(`¿Desea restaurar a ${nombre} a la lista activa?`)) return

    setEliminandoId(id)
    try {
      const result = await restaurarPacienteAction(id)
      if (result.success) {
        setPacientesArchivados(prev => prev.filter(p => p.id !== id))
        cargarPacientesPendientes() // Recargar cola activa
        alert("Paciente restaurado con éxito")
      } else {
        alert("Error al restaurar: " + result.error)
      }
    } catch (error) {
      console.error("Error restaurando:", error)
    } finally {
      setEliminandoId(null)
    }
  }

  const abrirModalValidacion = (paciente: PacientePendiente) => {
    setPacienteSeleccionado(paciente)
    setServicioSeleccionado("")
    setObservaciones("")
    setMostrarModal(true)
  }

  const procesarFacturacion = () => {
    if (!pacienteSeleccionado || !servicioSeleccionado) return

    const servicio = servicios.find((s) => s.id === servicioSeleccionado)
    if (!servicio) return

    const medicoSession = localStorage.getItem("medico-session")
    if (!medicoSession) return

    const medico = JSON.parse(medicoSession)

    // Simular envío al facturador
    const solicitudFacturacion = {
      id: `factura-${Date.now()}`,
      paciente: pacienteSeleccionado,
      servicio: servicio,
      medico: {
        id: medico.id,
        nombre: medico.nombre,
        email: medico.email,
        consultorio: medico.consultorio,
      },
      observaciones: observaciones,
      fechaProcesamiento: new Date().toISOString(),
      estado: "enviado_facturador",
      total: servicio.precio + (servicio.precio * servicio.iva) / 100,
    }

    // Guardar solicitud
    const solicitudesExistentes = JSON.parse(localStorage.getItem("solicitudes-facturacion") || "[]")
    solicitudesExistentes.push(solicitudFacturacion)
    localStorage.setItem("solicitudes-facturacion", JSON.stringify(solicitudesExistentes))

    // Actualizar estado del paciente
    const pacientesActualizados = pacientesPendientes.map((p) =>
      p.id === pacienteSeleccionado.id ? { ...p, estado: "facturado" as const } : p,
    )
    setPacientesPendientes(pacientesActualizados)

    // Cerrar modal
    setMostrarModal(false)
    setPacienteSeleccionado(null)

    alert("Solicitud enviada al facturador exitosamente")
  }

  const formatearTelefono = (numero: string) => {
    return numero.replace(/(\d{4})(\d{3})(\d{3})/, "$1-$2-$3")
  }

  const tiempoEspera = (fechaEnvio: string) => {
    const ahora = new Date()
    const envio = new Date(fechaEnvio)
    const diferencia = Math.floor((ahora.getTime() - envio.getTime()) / (1000 * 60))

    if (diferencia < 60) {
      return `${diferencia} min`
    } else {
      const horas = Math.floor(diferencia / 60)
      return `${horas}h ${diferencia % 60}min`
    }
  }

  const pacientesPendientesActivos = pacientesPendientes.filter((p) => p.estado === "pendiente")

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/medico/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Pacientes</h1>
                <p className="text-gray-600">Valide y procese pacientes pendientes de facturación</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {pacientesPendientesActivos.length} Pendientes
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Selector de Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${tabActiva === 'pendientes' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => {
              setTabActiva('pendientes')
              cargarPacientesPendientes()
            }}
          >
            Cola de Hoy ({pacientesPendientesActivos.length})
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${tabActiva === 'archivados' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => {
              setTabActiva('archivados')
              cargarPacientesArchivados()
            }}
          >
            Archivo / Historial
          </button>
        </div>

        {/* Alertas y Contenido */}
        {tabActiva === 'pendientes' ? (
          <>
            {pacientesPendientesActivos.length > 0 && (
              <Alert className="mb-6 border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  Tiene {pacientesPendientesActivos.length} paciente(s) esperando validación y facturación hoy.
                </AlertDescription>
              </Alert>
            )}

            {/* Lista de Pacientes Pendientes */}
            <div className="space-y-4">
              {pacientesPendientesActivos.map((paciente) => (
                <Card key={paciente.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold">
                            {paciente.nombres} {paciente.apellidos}
                          </h3>
                          <Badge variant="outline">
                            {paciente.tipoIdentificacion === "cedula" ? "CI" : "RUC"}: {paciente.numeroIdentificacion}
                          </Badge>
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {tiempoEspera(paciente.fechaEnvio)}
                          </Badge>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-500" />
                            <span>{paciente.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-500" />
                            <span>{formatearTelefono(paciente.telefono)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="truncate">{paciente.direccion}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button onClick={() => window.location.href = `/medico/facturacion/nueva?pacienteId=${paciente.id}`} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Facturar Ahora
                        </Button>
                        <Button
                          variant="outline"
                          title="Archivar (Remover de la cola)"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                          onClick={() => archivarPaciente(paciente.id, `${paciente.nombres} ${paciente.apellidos}`)}
                          disabled={eliminandoId === paciente.id}
                        >
                          {eliminandoId === paciente.id ? (
                            <Clock className="h-4 w-4 animate-spin" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {pacientesPendientesActivos.length === 0 && !cargando && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">¡Todo al día!</h3>
                  <p className="text-gray-600">No hay pacientes esperando en la cola de hoy</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          /* Vista de Archivados */
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-l-blue-500 p-4 mb-4">
              <div className="flex">
                <Archive className="h-5 w-5 text-blue-600 mr-3" />
                <p className="text-sm text-blue-700">
                  Estos pacientes han sido archivados. Puede restaurarlos si necesita facturarles nuevamente.
                </p>
              </div>
            </div>

            {pacientesArchivados.map((paciente) => (
              <Card key={paciente.id} className="opacity-80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{paciente.nombres}</h4>
                      <p className="text-xs text-gray-500">ID: {paciente.numeroIdentificacion}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      onClick={() => restaurarPaciente(paciente.id, paciente.nombres)}
                      disabled={eliminandoId === paciente.id}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restaurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {pacientesArchivados.length === 0 && !cargando && (
              <p className="text-center text-gray-500 py-10">No hay pacientes en el archivo histórico.</p>
            )}
          </div>
        )}

        {cargando && (
          <div className="flex justify-center py-10">
            <Clock className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        )}
      </div>

      {/* Modal de Validación */}
      {mostrarModal && pacienteSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Validar y Facturar Paciente</CardTitle>
              <CardDescription>Seleccione el servicio brindado y procese la facturación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Datos del Paciente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Datos del Paciente</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Nombre:</span>
                    <p className="font-medium">
                      {pacienteSeleccionado.nombres} {pacienteSeleccionado.apellidos}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Identificación:</span>
                    <p className="font-medium">{pacienteSeleccionado.numeroIdentificacion}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-medium">{pacienteSeleccionado.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Teléfono:</span>
                    <p className="font-medium">{formatearTelefono(pacienteSeleccionado.telefono)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-600">Dirección:</span>
                    <p className="font-medium">{pacienteSeleccionado.direccion}</p>
                  </div>
                </div>
              </div>

              {/* Selección de Servicio */}
              <div>
                <label className="block text-sm font-medium mb-2">Servicio Brindado *</label>
                <div className="grid gap-3">
                  {servicios.map((servicio) => (
                    <div
                      key={servicio.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${servicioSeleccionado === servicio.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                      onClick={() => setServicioSeleccionado(servicio.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{servicio.nombre}</h4>
                          <p className="text-sm text-gray-600">{servicio.descripcion}</p>
                          <p className="text-xs text-gray-500 mt-1">{servicio.codigo}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${servicio.precio.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">IVA {servicio.iva}%</p>
                          <p className="text-sm font-medium text-green-600">
                            Total: ${(servicio.precio + (servicio.precio * servicio.iva) / 100).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium mb-2">Observaciones (Opcional)</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                  rows={3}
                  placeholder="Notas adicionales sobre la consulta..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>

              {/* Resumen */}
              {servicioSeleccionado && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-900 mb-2">Resumen de Facturación</h3>
                  {(() => {
                    const servicio = servicios.find((s) => s.id === servicioSeleccionado)!
                    const subtotal = servicio.precio
                    const iva = (subtotal * servicio.iva) / 100
                    const total = subtotal + iva

                    return (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Servicio:</span>
                          <span>{servicio.nombre}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVA ({servicio.iva}%):</span>
                          <span>${iva.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-green-900 border-t border-green-300 pt-1">
                          <span>Total:</span>
                          <span>${total.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={procesarFacturacion}
                  disabled={!servicioSeleccionado}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Enviar al Facturador
                </Button>
                <Button variant="outline" onClick={() => setMostrarModal(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function GestionPacientes() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    }>
      <GestionPacientesContent />
    </Suspense>
  )
}
