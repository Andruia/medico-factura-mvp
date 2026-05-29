"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Save, Bell, Shield, User, Building, QrCode, Settings } from "lucide-react"
import { getConfiguracionAction, updateConfiguracionAction } from "./actions"

interface ConfiguracionMedico {
  nombre: string
  ruc: string
  email: string
  telefono: string
  especialidad: string
  numeroLicencia: string
  nombreConsultorio: string
  direccionConsultorio: string
  telefonoConsultorio: string
  notificacionesPacientes: boolean
  notificacionesFacturas: boolean
  notificacionesReportes: boolean
  emailNotificaciones: boolean
  smsNotificaciones: boolean
  ivaDefecto: number
  monedaDefecto: string
  formatoFactura: string
  tiempoExpiracionQR: number
  limitePacientesQR: number
  ambiente: "pruebas" | "produccion"
}

export default function ConfiguracionMedico() {
  const router = useRouter()
  const [config, setConfig] = useState<ConfiguracionMedico>({
    nombre: "",
    ruc: "",
    email: "",
    telefono: "",
    especialidad: "",
    numeroLicencia: "",
    nombreConsultorio: "",
    direccionConsultorio: "",
    telefonoConsultorio: "",
    notificacionesPacientes: true,
    notificacionesFacturas: true,
    notificacionesReportes: false,
    emailNotificaciones: true,
    smsNotificaciones: false,
    ivaDefecto: 12,
    monedaDefecto: "USD",
    formatoFactura: "001-001",
    tiempoExpiracionQR: 24,
    limitePacientesQR: 100,
    ambiente: "pruebas"
  })

  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState("")

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  const cargarConfiguracion = async () => {
    try {
      const data = await getConfiguracionAction()
      if (data) {
        setConfig((prev) => ({
          ...prev,
          nombre: data.nombre || "",
          email: data.email || "",
          ruc: data.ruc || "",
          telefono: data.telefono || "",
          especialidad: data.especialidad || "",
          numeroLicencia: data.numeroLicencia || "",
          nombreConsultorio: data.nombreConsultorio || "",
          direccionConsultorio: data.direccionConsultorio || "",
          telefonoConsultorio: data.telefonoConsultorio || "",
          notificacionesPacientes: data.notificacionesPacientes,
          notificacionesFacturas: data.notificacionesFacturas,
          notificacionesReportes: data.notificacionesReportes,
          emailNotificaciones: data.emailNotificaciones,
          smsNotificaciones: data.smsNotificaciones,
          ivaDefecto: data.ivaDefecto,
          monedaDefecto: data.monedaDefecto,
          formatoFactura: data.formatoFactura,
          tiempoExpiracionQR: data.tiempoExpiracionQR,
          limitePacientesQR: data.limitePacientesQR,
          ambiente: data.ambiente as "pruebas" | "produccion" || "pruebas",
        }))
      }
    } catch (error) {
      console.error("Error loading config:", error)
    }
  }

  const guardarConfiguracion = async () => {
    // Validaciones Previas
    if (!config.nombre?.trim()) {
      setMensaje("Error: El nombre es obligatorio")
      return
    }

    // Validar RUC (13 dígitos numéricos)
    const rucLimpio = config.ruc ? config.ruc.trim() : ""
    if (!/^\d{13}$/.test(rucLimpio)) {
      setMensaje(`Error: El RUC debe tener exactamente 13 dígitos numéricos. Actual: ${rucLimpio.length}`)
      return
    }
    // Validar sufijo 001 es una buena práctica pero no obligatoria (aunque SRI lo pide)
    if (!rucLimpio.endsWith("001")) {
      setMensaje("Error: El RUC generalmente debe terminar en 001")
      return
    }

    // Validar Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!config.email || !emailRegex.test(config.email)) {
      setMensaje("Error: Ingrese un correo electrónico válido")
      return
    }

    setGuardando(true)
    setMensaje("")

    try {
      // Enviar datos limpios
      const dataToSend = { ...config, ruc: rucLimpio }
      const result = await updateConfiguracionAction(dataToSend)

      if (result.success) {
        setMensaje("Configuración guardada exitosamente en la base de datos")
      } else {
        setMensaje("Error: " + (result.error || "No se pudo guardar"))
      }
    } catch (error) {
      console.error("Error saving config:", error)
      setMensaje("Error de conexión al guardar")
    } finally {
      setGuardando(false)
      setTimeout(() => setMensaje(""), 3000)
    }
  }

  const actualizarConfig = (campo: keyof ConfiguracionMedico, valor: any) => {
    setConfig((prev) => ({ ...prev, [campo]: valor }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/medico/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
                <p className="text-gray-600">Administre las configuraciones de su cuenta y consultorio</p>
              </div>
            </div>
            <Button onClick={guardarConfiguracion} disabled={guardando}>
              <Save className="h-4 w-4 mr-2" />
              {guardando ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {mensaje && (
          <Alert className={`mb-6 ${mensaje.startsWith("Error") ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
            <AlertDescription>{mensaje}</AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Información Personal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Información Personal
              </CardTitle>
              <CardDescription>Datos básicos de su perfil médico</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input
                  id="nombre"
                  value={config.nombre}
                  onChange={(e) => actualizarConfig("nombre", e.target.value)}
                  placeholder="Dr. Juan Pérez"
                />

              </div>

              <div className="space-y-2">
                <Label htmlFor="ruc">RUC (Registro Único de Contribuyentes)</Label>
                <Input
                  id="ruc"
                  value={config.ruc}
                  onChange={(e) => actualizarConfig("ruc", e.target.value)}
                  placeholder="1700000000001"
                />
                <p className="text-xs text-gray-500">
                  Debe coincidir EXACTAMENTE con el de su Firma Electrónica (.p12)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (Login)</Label>
                <Input
                  id="email"
                  type="email"
                  value={config.email}
                  onChange={(e) => actualizarConfig("email", e.target.value)}
                  placeholder="doctor@ejemplo.com"
                />
                <p className="text-xs text-orange-600">
                  Nota: Al cambiar este email, deberá usar el nuevo para iniciar sesión.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={config.telefono}
                  onChange={(e) => actualizarConfig("telefono", e.target.value)}
                  placeholder="0987654321"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="especialidad">Especialidad</Label>
                <Select value={config.especialidad} onValueChange={(value) => actualizarConfig("especialidad", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cardiología">Cardiología</SelectItem>
                    <SelectItem value="Pediatría">Pediatría</SelectItem>
                    <SelectItem value="Dermatología">Dermatología</SelectItem>
                    <SelectItem value="Ginecología">Ginecología</SelectItem>
                    <SelectItem value="Traumatología">Traumatología</SelectItem>
                    <SelectItem value="Oftalmología">Oftalmología</SelectItem>
                    <SelectItem value="Medicina General">Medicina General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="licencia">Número de Licencia Médica</Label>
                <Input
                  id="licencia"
                  value={config.numeroLicencia}
                  onChange={(e) => actualizarConfig("numeroLicencia", e.target.value)}
                  placeholder="MSP-12345"
                />
              </div>
            </CardContent>
          </Card>

          {/* Información del Consultorio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Información del Consultorio
              </CardTitle>
              <CardDescription>Datos de su lugar de trabajo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombreConsultorio">Nombre del Consultorio</Label>
                <Input
                  id="nombreConsultorio"
                  value={config.nombreConsultorio}
                  onChange={(e) => actualizarConfig("nombreConsultorio", e.target.value)}
                  placeholder="Consultorio Médico Demo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccionConsultorio">Dirección</Label>
                <Input
                  id="direccionConsultorio"
                  value={config.direccionConsultorio}
                  onChange={(e) => actualizarConfig("direccionConsultorio", e.target.value)}
                  placeholder="Av. Principal 123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefonoConsultorio">Teléfono del Consultorio</Label>
                <Input
                  id="telefonoConsultorio"
                  value={config.telefonoConsultorio}
                  onChange={(e) => actualizarConfig("telefonoConsultorio", e.target.value)}
                  placeholder="02-2345678"
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500">Usa el mismo teléfono de contacto por ahora</p>
              </div>
            </CardContent>
          </Card>

          {/* Configuraciones de Notificaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificaciones
              </CardTitle>
              <CardDescription>Configure cómo desea recibir notificaciones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Nuevos Pacientes</Label>
                  <p className="text-sm text-gray-500">Notificar cuando lleguen nuevos pacientes</p>
                </div>
                <Switch
                  checked={config.notificacionesPacientes}
                  onCheckedChange={(checked) => actualizarConfig("notificacionesPacientes", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Facturas Procesadas</Label>
                  <p className="text-sm text-gray-500">Notificar cuando se procesen facturas</p>
                </div>
                <Switch
                  checked={config.notificacionesFacturas}
                  onCheckedChange={(checked) => actualizarConfig("notificacionesFacturas", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Reportes Semanales</Label>
                  <p className="text-sm text-gray-500">Recibir reportes automáticos semanales</p>
                </div>
                <Switch
                  checked={config.notificacionesReportes}
                  onCheckedChange={(checked) => actualizarConfig("notificacionesReportes", checked)}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Métodos de Notificación</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Email</Label>
                    <Switch
                      checked={config.emailNotificaciones}
                      onCheckedChange={(checked) => actualizarConfig("emailNotificaciones", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>SMS</Label>
                    <Switch
                      checked={config.smsNotificaciones}
                      onCheckedChange={(checked) => actualizarConfig("smsNotificaciones", checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuraciones de Facturación */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Configuraciones de Facturación
              </CardTitle>
              <CardDescription>Parámetros por defecto para facturación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>IVA por Defecto (%)</Label>
                <Select
                  value={config.ivaDefecto.toString()}
                  onValueChange={(value) => actualizarConfig("ivaDefecto", Number.parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="14">14%</SelectItem>
                    <SelectItem value="15">15%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select
                  value={config.monedaDefecto}
                  onValueChange={(value) => actualizarConfig("monedaDefecto", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Formato de Factura</Label>
                <Input
                  value={config.formatoFactura}
                  onChange={(e) => actualizarConfig("formatoFactura", e.target.value)}
                  placeholder="001-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Ambiente SRI</Label>
                <Select
                  value={config.ambiente}
                  onValueChange={(value) => actualizarConfig("ambiente", value)}
                >
                  <SelectTrigger className={config.ambiente === "produccion" ? "border-red-500 bg-red-50" : "bg-green-50 border-green-500"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pruebas">PRUEBAS (Sin validez tributaria)</SelectItem>
                    <SelectItem value="produccion">PRODUCCIÓN (Validez Legal)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {config.ambiente === "produccion"
                    ? "⚠️ CUIDADO: Las facturas emitidas serán reales y válidas ante el SRI."
                    : "✅ Modo seguro para pruebas y desarrollo."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Integración SRI</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="w-full flex-1"
                    onClick={() => router.push("/medico/certificados")}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Certificados
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full flex-1"
                    onClick={() => alert("Configuración SRI avanzada (próximamente)")}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Config SRI
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuraciones de QR */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Configuraciones de Código QR
              </CardTitle>
              <CardDescription>Parámetros para la generación de códigos QR</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Tiempo de Expiración (horas)</Label>
                  <Select
                    value={config.tiempoExpiracionQR.toString()}
                    onValueChange={(value) => actualizarConfig("tiempoExpiracionQR", Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hora</SelectItem>
                      <SelectItem value="4">4 horas</SelectItem>
                      <SelectItem value="8">8 horas</SelectItem>
                      <SelectItem value="24">24 horas</SelectItem>
                      <SelectItem value="168">1 semana</SelectItem>
                      <SelectItem value="0">Sin expiración</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Límite de Pacientes por QR</Label>
                  <Select
                    value={config.limitePacientesQR.toString()}
                    onValueChange={(value) => actualizarConfig("limitePacientesQR", Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 pacientes</SelectItem>
                      <SelectItem value="25">25 pacientes</SelectItem>
                      <SelectItem value="50">50 pacientes</SelectItem>
                      <SelectItem value="100">100 pacientes</SelectItem>
                      <SelectItem value="0">Sin límite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
