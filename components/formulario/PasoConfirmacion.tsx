"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, User, Mail, Phone, MapPin, CreditCard } from "lucide-react"

interface DatosPaciente {
  tipoIdentificacion: "cedula" | "ruc"
  numeroIdentificacion: string
  nombres: string
  apellidos: string
  email: string
  telefono: string
  direccion: string
  medicoId: string
  fechaCreacion: string
}

interface Medico {
  nombre: string
  especialidad: string
}

interface Props {
  datos: DatosPaciente
  medico: Medico
}

export default function PasoConfirmacion({ datos, medico }: Props) {
  const formatearTelefono = (numero: string) => {
    return numero.replace(/(\d{4})(\d{3})(\d{3})/, "$1-$2-$3")
  }

  return (
    <div className="space-y-6">
      {/* Confirmación de médico */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <User className="h-5 w-5" />
            Médico Seleccionado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900">{medico.nombre}</p>
              <p className="text-blue-700">{medico.especialidad}</p>
            </div>
            <Badge className="bg-blue-600">Confirmado</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Datos del paciente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Sus Datos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Identificación</p>
                <p className="font-medium">
                  {datos.tipoIdentificacion === "cedula" ? "Cédula" : "RUC"}: {datos.numeroIdentificacion}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Nombre completo</p>
                <p className="font-medium">
                  {datos.nombres} {datos.apellidos}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Correo electrónico</p>
                <p className="font-medium">{datos.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Teléfono</p>
                <p className="font-medium">{formatearTelefono(datos.telefono)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-gray-500 mt-1" />
            <div>
              <p className="text-sm text-gray-600">Dirección de facturación</p>
              <p className="font-medium">{datos.direccion}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Próximos pasos */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-900">¿Qué sucede después?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-green-800">
            <div className="flex items-start gap-3">
              <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Validación de datos</p>
                <p className="text-sm">El personal médico revisará y validará su información en pocos minutos</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Procesamiento de factura</p>
                <p className="text-sm">Se generará automáticamente su factura electrónica con el SRI</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Recepción de factura</p>
                <p className="text-sm">Recibirá su factura por correo electrónico en máximo 10 minutos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Importante:</strong> Al enviar sus datos, confirma que toda la información es correcta y autoriza el
          procesamiento de su factura electrónica.
        </p>
      </div>
    </div>
  )
}
