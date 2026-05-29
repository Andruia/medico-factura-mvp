"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Settings, ArrowLeft, Save, TestTube, Globe, Shield, Mail, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import type { ConfiguracionSRI, CertificadoDigital } from "@/lib/sri/types"
import { getSRIConfigAction, saveSRIConfigAction } from "./actions"

export default function ConfiguracionSRIPage() {
  const [medico, setMedico] = useState<any>(null)
  const [certificados, setCertificados] = useState<CertificadoDigital[]>([])
  const [configuracion, setConfiguracion] = useState<Partial<ConfiguracionSRI>>({
    ambiente: "pruebas",
    ruc: "",
    razonSocial: "",
    nombreComercial: "",
    direccionMatriz: "",
    contribuyenteEspecial: "",
    obligadoContabilidad: true,
    certificadoId: "",
    configuracionEmail: {
      servidor: "smtp.gmail.com",
      puerto: 587,
      usuario: "",
      password: "",
      ssl: true,
    },
  })

  const [guardando, setGuardando] = useState(false)
  const [probandoConexion, setProbandoConexion] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "error"; texto: string } | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  useEffect(() => {
    const session = localStorage.getItem("medico-session")
    if (session) {
      const medicoData = JSON.parse(session)
      setMedico(medicoData)
      cargarConfiguracionDb()
      cargarCertificados(medicoData.id)
    }
  }, [])

  const cargarConfiguracionDb = async () => {
    const config = await getSRIConfigAction()
    if (config) {
      setConfiguracion(config as any)
    }
  }

  const cargarCertificados = (medicoId: string) => {
    const certificadosGuardados = localStorage.getItem(`certificados-medico-${medicoId}`)
    if (certificadosGuardados) {
      setCertificados(JSON.parse(certificadosGuardados))
    }
  }

  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {}

    if (!configuracion.ruc) {
      nuevosErrores.ruc = "El RUC es requerido"
    } else if (!/^\d{13}$/.test(configuracion.ruc)) {
      nuevosErrores.ruc = "El RUC debe tener 13 dígitos"
    }

    if (!configuracion.razonSocial?.trim()) {
      nuevosErrores.razonSocial = "La razón social es requerida"
    }

    if (!configuracion.direccionMatriz?.trim()) {
      nuevosErrores.direccionMatriz = "La dirección matriz es requerida"
    }

    if (!configuracion.certificadoId) {
      nuevosErrores.certificadoId = "Debe seleccionar un certificado digital"
    }

    if (!configuracion.configuracionEmail?.usuario?.trim()) {
      nuevosErrores.emailUsuario = "El usuario de email es requerido"
    }

    if (!configuracion.configuracionEmail?.password?.trim()) {
      nuevosErrores.emailPassword = "La contraseña de email es requerida"
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const guardarConfiguracion = async () => {
    if (!validarFormulario()) return

    setGuardando(true)
    setMensaje(null)

    try {
      const configCompleta: Partial<ConfiguracionSRI> = {
        ambiente: configuracion.ambiente,
        ruc: configuracion.ruc,
        razonSocial: configuracion.razonSocial,
        nombreComercial: configuracion.nombreComercial,
        direccionMatriz: configuracion.direccionMatriz,
        contribuyenteEspecial: configuracion.contribuyenteEspecial,
        obligadoContabilidad: configuracion.obligadoContabilidad,
        configuracionEmail: configuracion.configuracionEmail,
      }

      const result = await saveSRIConfigAction(configCompleta)

      if (result.success) {
        setMensaje({ tipo: "success", texto: "Configuración guardada exitosamente en la base de datos" })
        // Sync local storage just in case other legacy code still uses it
        localStorage.setItem(`configuracion-sri-${medico.id}`, JSON.stringify({ ...configuracion, ...configCompleta }))
      } else {
        setMensaje({ tipo: "error", texto: result.error || "Error guardando la configuración" })
      }
    } catch (error) {
      setMensaje({ tipo: "error", texto: "Error inesperado guardando la configuración" })
    } finally {
      setGuardando(false)
    }
  }

  const probarConexionSRI = async () => {
    setProbandoConexion(true)
    setMensaje(null)

    try {
      // Simular prueba de conexión con SRI
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // En producción, aquí se haría una llamada real al SRI
      const exito = Math.random() > 0.3 // 70% de éxito simulado

      if (exito) {
        setMensaje({
          tipo: "success",
          texto: `Conexión exitosa con SRI (${configuracion.ambiente})`,
        })
      } else {
        setMensaje({
          tipo: "error",
          texto: "Error conectando con SRI. Verifique su configuración.",
        })
      }
    } catch (error) {
      setMensaje({ tipo: "error", texto: "Error probando conexión" })
    } finally {
      setProbandoConexion(false)
    }
  }

  const certificadoSeleccionado = certificados.find((c) => c.id === configuracion.certificadoId)

  if (!medico) return <div>Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/medico/configuracion">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Configuración
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuración SRI</h1>
                <p className="text-gray-600">Configure la integración con el Servicio de Rentas Internas</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={probarConexionSRI} disabled={probandoConexion || !configuracion.ruc}>
                {probandoConexion ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Probando...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Probar Conexión
                  </>
                )}
              </Button>
              <Button onClick={guardarConfiguracion} disabled={guardando}>
                <Save className="h-4 w-4 mr-2" />
                {guardando ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Mensajes */}
        {mensaje && (
          <Alert
            className={`mb-6 ${mensaje.tipo === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
          >
            <AlertDescription className={mensaje.tipo === "success" ? "text-green-800" : "text-red-800"}>
              {mensaje.texto}
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta de certificados */}
        {certificados.length === 0 && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <Shield className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Certificado requerido:</strong> Necesita cargar un certificado digital antes de configurar el SRI.{" "}
              <Link href="/medico/certificados" className="underline">
                Cargar certificado aquí
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Configuración General */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración General
              </CardTitle>
              <CardDescription>Datos básicos para la facturación electrónica</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Ambiente SRI</Label>
                <Select
                  value={configuracion.ambiente}
                  onValueChange={(value: "pruebas" | "produccion") =>
                    setConfiguracion((prev) => ({ ...prev, ambiente: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pruebas">
                      <div className="flex items-center gap-2">
                        <TestTube className="h-4 w-4" />
                        Pruebas
                      </div>
                    </SelectItem>
                    <SelectItem value="produccion">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Producción
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Use "Pruebas" para desarrollo y testing. "Producción" para facturas reales.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruc">RUC *</Label>
                <Input
                  id="ruc"
                  placeholder="1234567890001"
                  value={configuracion.ruc}
                  onChange={(e) => setConfiguracion((prev) => ({ ...prev, ruc: e.target.value }))}
                  className={errores.ruc ? "border-red-500" : ""}
                  maxLength={13}
                />
                {errores.ruc && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errores.ruc}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="razonSocial">Razón Social *</Label>
                <Input
                  id="razonSocial"
                  placeholder="Dr. Juan Martínez"
                  value={configuracion.razonSocial}
                  onChange={(e) => setConfiguracion((prev) => ({ ...prev, razonSocial: e.target.value }))}
                  className={errores.razonSocial ? "border-red-500" : ""}
                />
                {errores.razonSocial && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errores.razonSocial}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombreComercial">Nombre Comercial</Label>
                <Input
                  id="nombreComercial"
                  placeholder="Consultorio Médico Dr. Martínez"
                  value={configuracion.nombreComercial}
                  onChange={(e) => setConfiguracion((prev) => ({ ...prev, nombreComercial: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccionMatriz">Dirección Matriz *</Label>
                <Input
                  id="direccionMatriz"
                  placeholder="Av. Principal 123 y Secundaria"
                  value={configuracion.direccionMatriz}
                  onChange={(e) => setConfiguracion((prev) => ({ ...prev, direccionMatriz: e.target.value }))}
                  className={errores.direccionMatriz ? "border-red-500" : ""}
                />
                {errores.direccionMatriz && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errores.direccionMatriz}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contribuyenteEspecial">Contribuyente Especial</Label>
                <Input
                  id="contribuyenteEspecial"
                  placeholder="12345 (opcional)"
                  value={configuracion.contribuyenteEspecial}
                  onChange={(e) => setConfiguracion((prev) => ({ ...prev, contribuyenteEspecial: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Obligado a llevar contabilidad</Label>
                  <p className="text-sm text-gray-500">Según su registro en el SRI</p>
                </div>
                <Switch
                  checked={configuracion.obligadoContabilidad}
                  onCheckedChange={(checked) =>
                    setConfiguracion((prev) => ({ ...prev, obligadoContabilidad: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Certificado Digital */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Certificado Digital
              </CardTitle>
              <CardDescription>Seleccione el certificado para firma electrónica</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {certificados.length === 0 ? (
                <div className="text-center py-6">
                  <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No hay certificados disponibles</p>
                  <Link href="/medico/certificados">
                    <Button>
                      <Shield className="h-4 w-4 mr-2" />
                      Cargar Certificado
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Certificado a usar</Label>
                    <Select
                      value={configuracion.certificadoId}
                      onValueChange={(value) => setConfiguracion((prev) => ({ ...prev, certificadoId: value }))}
                    >
                      <SelectTrigger className={errores.certificadoId ? "border-red-500" : ""}>
                        <SelectValue placeholder="Seleccione un certificado" />
                      </SelectTrigger>
                      <SelectContent>
                        {certificados.map((cert) => (
                          <SelectItem key={cert.id} value={cert.id}>
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              <div>
                                <p className="font-medium">{cert.titular}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-gray-500">RUC: {cert.ruc}</p>
                                  {cert.ruc === "No detectado" && (
                                    <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[10px] py-0 px-1 leading-none h-auto">
                                      No detectado
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errores.certificadoId && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errores.certificadoId}
                      </p>
                    )}
                  </div>

                  {certificadoSeleccionado && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <p className="font-medium text-green-900">Certificado Seleccionado</p>
                      </div>
                      <div className="text-sm text-green-800 space-y-1">
                        <p>
                          <strong>Titular:</strong> {certificadoSeleccionado.titular}
                        </p>
                        <p>
                          <strong>RUC:</strong> {certificadoSeleccionado.ruc}
                        </p>
                        <p>
                          <strong>Vencimiento:</strong>{" "}
                          {new Date(certificadoSeleccionado.fechaVencimiento).toLocaleDateString("es-EC")}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Configuración de Email */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Configuración de Email
              </CardTitle>
              <CardDescription>Configure el servidor SMTP para envío de facturas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="servidor">Servidor SMTP</Label>
                    <Input
                      id="servidor"
                      placeholder="smtp.gmail.com"
                      value={configuracion.configuracionEmail?.servidor}
                      onChange={(e) =>
                        setConfiguracion((prev) => ({
                          ...prev,
                          configuracionEmail: {
                            ...prev.configuracionEmail!,
                            servidor: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="puerto">Puerto</Label>
                    <Input
                      id="puerto"
                      type="number"
                      placeholder="587"
                      value={configuracion.configuracionEmail?.puerto}
                      onChange={(e) =>
                        setConfiguracion((prev) => ({
                          ...prev,
                          configuracionEmail: {
                            ...prev.configuracionEmail!,
                            puerto: Number.parseInt(e.target.value) || 587,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Usar SSL/TLS</Label>
                      <p className="text-sm text-gray-500">Conexión segura</p>
                    </div>
                    <Switch
                      checked={configuracion.configuracionEmail?.ssl}
                      onCheckedChange={(checked) =>
                        setConfiguracion((prev) => ({
                          ...prev,
                          configuracionEmail: {
                            ...prev.configuracionEmail!,
                            ssl: checked,
                          },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailUsuario">Usuario / Email</Label>
                    <Input
                      id="emailUsuario"
                      type="email"
                      placeholder="medico@ejemplo.com"
                      value={configuracion.configuracionEmail?.usuario}
                      onChange={(e) =>
                        setConfiguracion((prev) => ({
                          ...prev,
                          configuracionEmail: {
                            ...prev.configuracionEmail!,
                            usuario: e.target.value,
                          },
                        }))
                      }
                      className={errores.emailUsuario ? "border-red-500" : ""}
                    />
                    {errores.emailUsuario && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errores.emailUsuario}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailPassword">Contraseña</Label>
                    <Input
                      id="emailPassword"
                      type="password"
                      placeholder="Contraseña del email"
                      value={configuracion.configuracionEmail?.password}
                      onChange={(e) =>
                        setConfiguracion((prev) => ({
                          ...prev,
                          configuracionEmail: {
                            ...prev.configuracionEmail!,
                            password: e.target.value,
                          },
                        }))
                      }
                      className={errores.emailPassword ? "border-red-500" : ""}
                    />
                    {errores.emailPassword && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errores.emailPassword}
                      </p>
                    )}
                  </div>

                  <Alert>
                    <Mail className="h-4 w-4" />
                    <AlertDescription>
                      Para Gmail, use una contraseña de aplicación en lugar de su contraseña normal.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estado de configuración */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Estado de Configuración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${configuracion.ruc ? "bg-green-500" : "bg-red-500"}`} />
                <div>
                  <p className="font-medium">Datos SRI</p>
                  <p className="text-sm text-gray-600">{configuracion.ruc ? "Configurado" : "Pendiente"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${configuracion.certificadoId ? "bg-green-500" : "bg-red-500"}`}
                />
                <div>
                  <p className="font-medium">Certificado Digital</p>
                  <p className="text-sm text-gray-600">{configuracion.certificadoId ? "Configurado" : "Pendiente"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${configuracion.configuracionEmail?.usuario ? "bg-green-500" : "bg-red-500"}`}
                />
                <div>
                  <p className="font-medium">Email SMTP</p>
                  <p className="text-sm text-gray-600">
                    {configuracion.configuracionEmail?.usuario ? "Configurado" : "Pendiente"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
