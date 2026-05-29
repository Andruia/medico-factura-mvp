"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, MapPin } from "lucide-react"

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

interface Props {
  datos: DatosPaciente
  errores: Record<string, string>
  onActualizar: (datos: Partial<DatosPaciente>) => void
}

export default function PasoDatosPersonales({ datos, errores, onActualizar }: Props) {
  const formatearTelefono = (valor: string) => {
    const numero = valor.replace(/\D/g, "")
    if (numero.length <= 10) {
      return numero.replace(/(\d{4})(\d{3})(\d{3})/, "$1-$2-$3")
    }
    return numero.slice(0, 10).replace(/(\d{4})(\d{3})(\d{3})/, "$1-$2-$3")
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nombres">Nombres *</Label>
          <Input
            id="nombres"
            type="text"
            placeholder="Juan Carlos"
            value={datos.nombres}
            onChange={(e) => onActualizar({ nombres: e.target.value })}
            className={errores.nombres ? "border-red-500" : ""}
          />
          {errores.nombres && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errores.nombres}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="apellidos">Apellidos *</Label>
          <Input
            id="apellidos"
            type="text"
            placeholder="Pérez González"
            value={datos.apellidos}
            onChange={(e) => onActualizar({ apellidos: e.target.value })}
            className={errores.apellidos ? "border-red-500" : ""}
          />
          {errores.apellidos && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errores.apellidos}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo Electrónico *</Label>
        <Input
          id="email"
          type="email"
          placeholder="juan.perez@email.com"
          value={datos.email}
          onChange={(e) => onActualizar({ email: e.target.value.toLowerCase() })}
          className={errores.email ? "border-red-500" : ""}
        />
        {errores.email && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errores.email}
          </p>
        )}
        <p className="text-xs text-gray-500">Su factura electrónica será enviada a este correo</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono *</Label>
        <Input
          id="telefono"
          type="tel"
          placeholder="0987-654-321"
          value={formatearTelefono(datos.telefono)}
          onChange={(e) => {
            const numeroLimpio = e.target.value.replace(/\D/g, "")
            onActualizar({ telefono: numeroLimpio })
          }}
          className={errores.telefono ? "border-red-500" : ""}
        />
        {errores.telefono && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errores.telefono}
          </p>
        )}
        <p className="text-xs text-gray-500">10 dígitos, incluya el código de área</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Dirección para Facturación *
        </Label>
        <Input
          id="direccion"
          type="text"
          placeholder="Av. Principal 123 y Calle Secundaria"
          value={datos.direccion}
          onChange={(e) => onActualizar({ direccion: e.target.value })}
          className={errores.direccion ? "border-red-500" : ""}
        />
        {errores.direccion && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errores.direccion}
          </p>
        )}
        <p className="text-xs text-gray-500">
          Ingrese la dirección completa incluyendo calles principales y secundarias
        </p>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Verificación de datos:</h3>
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            <strong>Identificación:</strong> {datos.numeroIdentificacion}
          </p>
          <p>
            <strong>Nombre completo:</strong> {datos.nombres} {datos.apellidos}
          </p>
          <p>
            <strong>Email:</strong> {datos.email}
          </p>
          <p>
            <strong>Teléfono:</strong> {formatearTelefono(datos.telefono)}
          </p>
          <p>
            <strong>Dirección:</strong> {datos.direccion}
          </p>
        </div>
      </div>
    </div>
  )
}
