"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Mail, Download, ArrowLeft } from "lucide-react"
import Link from "next/link"

const medicosDemo = {
  "1": { nombre: "Dr. Juan Martínez", especialidad: "Cardiología" },
  "2": { nombre: "Dra. Ana Gómez", especialidad: "Pediatría" },
  "3": { nombre: "Dr. Carlos Sánchez", especialidad: "Dermatología" },
  "4": { nombre: "Dra. María López", especialidad: "Ginecología" },
  "5": { nombre: "Dr. Luis Ramírez", especialidad: "Traumatología" },
  "6": { nombre: "Dra. Carmen Torres", especialidad: "Oftalmología" },
}

export default function ConfirmacionPaciente() {
  const searchParams = useSearchParams()
  const medicoId = searchParams.get("medico") || "1"
  const medico = medicosDemo[medicoId as keyof typeof medicosDemo]

  const [datosEnviados, setDatosEnviados] = useState<any>(null)
  const [tiempoEspera, setTiempoEspera] = useState(5)

  useEffect(() => {
    // Cargar datos enviados
    const datos = localStorage.getItem(`paciente-completado-${medicoId}`)
    if (datos) {
      setDatosEnviados(JSON.parse(datos))
    }

    // Simular tiempo de procesamiento
    const timer = setInterval(() => {
      setTiempoEspera((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [medicoId])

  if (!datosEnviados) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">No se encontraron datos enviados</p>
            <Link href="/paciente/seleccionar-medico">
              <Button className="mt-4">Volver a Inicio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Datos Enviados Exitosamente!</h1>
            <p className="text-gray-600">Sus datos han sido recibidos y están siendo procesados para la facturación</p>
          </div>

          {/* Resumen */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Resumen de su solicitud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Médico</p>
                  <p className="font-medium">{medico?.nombre}</p>
                  <p className="text-sm text-gray-500">{medico?.especialidad}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Paciente</p>
                  <p className="font-medium">
                    {datosEnviados.nombres} {datosEnviados.apellidos}
                  </p>
                  <p className="text-sm text-gray-500">{datosEnviados.numeroIdentificacion}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{datosEnviados.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha y hora</p>
                  <p className="font-medium">{new Date(datosEnviados.fechaEnvio).toLocaleString("es-EC")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estado del procesamiento */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Estado del procesamiento</CardTitle>
            </CardHeader>
            <CardContent>
              {tiempoEspera > 0 ? (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Procesando sus datos... {tiempoEspera} segundos restantes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span>Datos recibidos y validados</span>
                  </div>
                  <div className="flex items-center gap-3 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span>Enviado al facturador para procesamiento</span>
                  </div>
                  <div className="flex items-center gap-3 text-blue-600">
                    <div className="animate-pulse h-5 w-5 bg-blue-600 rounded-full"></div>
                    <span>Generando factura electrónica con SRI...</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próximos pasos */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                ¿Qué sucede ahora?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium">Validación médica</p>
                  <p className="text-sm text-gray-600">El personal médico revisará y confirmará el servicio brindado</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium">Procesamiento SRI</p>
                  <p className="text-sm text-gray-600">Se generará y autorizará su factura electrónica</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium">Recepción por email</p>
                  <p className="text-sm text-gray-600">Recibirá su factura en {datosEnviados.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-center">
            <Link href="/paciente/seleccionar-medico">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Nueva Consulta
              </Button>
            </Link>
            <Button disabled>
              <Download className="h-4 w-4 mr-2" />
              Descargar Factura (Procesando...)
            </Button>
          </div>

          {/* Help */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>¿No recibió su factura? Contacte a recepción</p>
          </div>
        </div>
      </div>
    </div>
  )
}
