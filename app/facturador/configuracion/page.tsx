"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Settings, ArrowLeft, Shield, AlertCircle, CheckCircle, Upload, Globe, TestTube, FileText } from "lucide-react"
import Link from "next/link"

interface EstadoConfiguracion {
  certificadosDisponibles: number
  certificadoActivo: boolean
  configuracionSRI: boolean
  conexionSRI: boolean
  permisosFirma: boolean
}

export default function ConfiguracionFacturador() {
  const [facturador, setFacturador] = useState<any>(null)
  const [estado, setEstado] = useState<EstadoConfiguracion>({
    certificadosDisponibles: 0,
    certificadoActivo: false,
    configuracionSRI: false,
    conexionSRI: false,
    permisosFirma: false,
  })

  const [probandoConexion, setProbandoConexion] = useState(false)

  useEffect(() => {
    const session = localStorage.getItem("facturador-session")
    if (session) {
      setFacturador(JSON.parse(session))
      verificarEstadoConfiguracion()
    }
  }, [])

  const verificarEstadoConfiguracion = () => {
    // En un sistema real, esto verificaría contra el backend
    // Por ahora simulamos el estado

    // Verificar certificados (simulando que están asociados al facturador)
    const certificados = localStorage.getItem("certificados-medico-MED001") // Asociado al médico por defecto
    const configSRI = localStorage.getItem("configuracion-sri-MED001")

    let certificadosCount = 0
    let certificadoActivo = false
    let configCompleta = false

    if (certificados) {
      const certs = JSON.parse(certificados)
      certificadosCount = certs.length
      certificadoActivo = certs.some((c: any) => c.estado === "activo")
    }

    if (configSRI) {
      const config = JSON.parse(configSRI)
      configCompleta = !!(config.ruc && config.certificadoId && config.configuracionEmail?.usuario)
    }

    setEstado({
      certificadosDisponibles: certificadosCount,
      certificadoActivo,
      configuracionSRI: configCompleta,
      conexionSRI: false, // Se actualiza al probar conexión
      permisosFirma: certificadoActivo && configCompleta,
    })
  }

  const probarConexionSRI = async () => {
    setProbandoConexion(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Simular resultado de conexión
      const exito = Math.random() > 0.3

      setEstado((prev) => ({
        ...prev,
        conexionSRI: exito,
      }))
    } catch (error) {
      setEstado((prev) => ({
        ...prev,
        conexionSRI: false,
      }))
    } finally {
      setProbandoConexion(false)
    }
  }

  const configuracionCompleta = estado.certificadoActivo && estado.configuracionSRI && estado.conexionSRI

  if (!facturador) return <div>Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/facturador/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuración de Facturación</h1>
                <p className="text-gray-600">Configure certificados digitales y conexión SRI</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Estado General */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Estado de Configuración
            </CardTitle>
            <CardDescription>
              Resumen del estado actual de su configuración para facturación electrónica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div
                  className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    estado.certificadosDisponibles > 0 ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  <Shield
                    className={`h-6 w-6 ${estado.certificadosDisponibles > 0 ? "text-green-600" : "text-red-600"}`}
                  />
                </div>
                <p className="font-medium">Certificados</p>
                <p className="text-sm text-gray-600">{estado.certificadosDisponibles} disponible(s)</p>
              </div>

              <div className="text-center">
                <div
                  className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    estado.configuracionSRI ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  <FileText className={`h-6 w-6 ${estado.configuracionSRI ? "text-green-600" : "text-red-600"}`} />
                </div>
                <p className="font-medium">Config SRI</p>
                <p className="text-sm text-gray-600">{estado.configuracionSRI ? "Configurado" : "Pendiente"}</p>
              </div>

              <div className="text-center">
                <div
                  className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    estado.conexionSRI ? "bg-green-100" : "bg-gray-100"
                  }`}
                >
                  <Globe className={`h-6 w-6 ${estado.conexionSRI ? "text-green-600" : "text-gray-600"}`} />
                </div>
                <p className="font-medium">Conexión SRI</p>
                <p className="text-sm text-gray-600">{estado.conexionSRI ? "Activa" : "No probada"}</p>
              </div>

              <div className="text-center">
                <div
                  className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    estado.permisosFirma ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  <CheckCircle className={`h-6 w-6 ${estado.permisosFirma ? "text-green-600" : "text-red-600"}`} />
                </div>
                <p className="font-medium">Firma Digital</p>
                <p className="text-sm text-gray-600">{estado.permisosFirma ? "Habilitada" : "Deshabilitada"}</p>
              </div>
            </div>

            {configuracionCompleta ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>¡Configuración completa!</strong> Su sistema está listo para procesar facturas electrónicas.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Configuración incompleta:</strong> Complete los pasos siguientes para habilitar la facturación
                  electrónica.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Pasos de Configuración */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Paso 1: Certificados Digitales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                1. Certificados Digitales
              </CardTitle>
              <CardDescription>Configure los certificados necesarios para la firma electrónica</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Certificados Disponibles</p>
                  <p className="text-sm text-gray-600">{estado.certificadosDisponibles} certificado(s) cargado(s)</p>
                </div>
                <Badge variant={estado.certificadosDisponibles > 0 ? "default" : "destructive"}>
                  {estado.certificadosDisponibles > 0 ? "Configurado" : "Pendiente"}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Link href="/medico/certificados" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Gestionar Certificados
                  </Button>
                </Link>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Los certificados digitales son emitidos por entidades certificadoras autorizadas por el SRI y son
                  necesarios para firmar electrónicamente las facturas.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Paso 2: Configuración SRI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                2. Configuración SRI
              </CardTitle>
              <CardDescription>Configure los datos fiscales y parámetros del SRI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Datos Fiscales</p>
                  <p className="text-sm text-gray-600">RUC, razón social y configuración de email</p>
                </div>
                <Badge variant={estado.configuracionSRI ? "default" : "destructive"}>
                  {estado.configuracionSRI ? "Configurado" : "Pendiente"}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Link href="/medico/configuracion-sri" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar SRI
                  </Button>
                </Link>
              </div>

              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Configure su RUC, razón social, ambiente (pruebas/producción) y servidor de email para el envío
                  automático de facturas.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Paso 3: Prueba de Conexión */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                3. Conexión con SRI
              </CardTitle>
              <CardDescription>Verifique la conectividad con los servicios del SRI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Estado de Conexión</p>
                  <p className="text-sm text-gray-600">
                    {estado.conexionSRI ? "Conexión verificada" : "Conexión no verificada"}
                  </p>
                </div>
                <Badge variant={estado.conexionSRI ? "default" : "secondary"}>
                  {estado.conexionSRI ? "Conectado" : "No probado"}
                </Badge>
              </div>

              <Button
                onClick={probarConexionSRI}
                disabled={probandoConexion || !estado.configuracionSRI}
                className="w-full"
              >
                {probandoConexion ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Probando Conexión...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Probar Conexión SRI
                  </>
                )}
              </Button>

              <Alert>
                <Globe className="h-4 w-4" />
                <AlertDescription>
                  Esta prueba verifica que su configuración puede comunicarse correctamente con los servicios web del
                  SRI.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Paso 4: Validación Final */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                4. Validación Final
              </CardTitle>
              <CardDescription>Resumen del estado de configuración</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${estado.certificadoActivo ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm">Certificado digital activo</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${estado.configuracionSRI ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm">Configuración SRI completa</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${estado.conexionSRI ? "bg-green-500" : "bg-gray-400"}`} />
                  <span className="text-sm">Conexión SRI verificada</span>
                </div>
              </div>

              {estado.permisosFirma ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ¡Sistema listo para facturación electrónica!
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    Complete los pasos anteriores para habilitar la facturación.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Información Adicional */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Información del Proceso de Firma Electrónica</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">¿Cómo funciona la firma electrónica?</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>1. El sistema genera el XML de la factura</p>
                  <p>2. Se firma digitalmente usando su certificado</p>
                  <p>3. Se envía al SRI para autorización</p>
                  <p>4. Se recibe la clave de acceso y autorización</p>
                  <p>5. Se envía la factura al paciente por email</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Requisitos Técnicos</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Certificado digital vigente (.p12 o .pfx)</p>
                  <p>• RUC activo en el SRI</p>
                  <p>• Conexión a internet estable</p>
                  <p>• Configuración de email SMTP</p>
                  <p>• Ambiente de pruebas o producción</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
