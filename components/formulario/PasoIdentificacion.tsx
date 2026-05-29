"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"

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

export default function PasoIdentificacion({ datos, errores, onActualizar }: Props) {
  const validarIdentificacion = (numero: string, tipo: "cedula" | "ruc") => {
    // Simulación de validación con base de datos
    const pacientesExistentes = {
      "1234567890": {
        nombres: "María",
        apellidos: "González Pérez",
        email: "maria.gonzalez@email.com",
        telefono: "0987654321",
        direccion: "Av. 10 de Agosto 1234 y Colón, Quito",
      },
      "0987654321": {
        nombres: "Juan Carlos",
        apellidos: "Rodríguez López",
        email: "juan.rodriguez@email.com",
        telefono: "0912345678",
        direccion: "Av. 9 de Octubre 567 y Malecón, Guayaquil",
      },
    }

    if (pacientesExistentes[numero as keyof typeof pacientesExistentes]) {
      const datosExistentes = pacientesExistentes[numero as keyof typeof pacientesExistentes]
      onActualizar({
        numeroIdentificacion: numero,
        ...datosExistentes,
      })
      return true
    }

    return false
  }

  const handleIdentificacionChange = (valor: string) => {
    const numeroLimpio = valor.replace(/\D/g, "")
    onActualizar({ numeroIdentificacion: numeroLimpio })

    // Auto-validar si tiene la longitud correcta
    if (
      (datos.tipoIdentificacion === "cedula" && numeroLimpio.length === 10) ||
      (datos.tipoIdentificacion === "ruc" && numeroLimpio.length === 13)
    ) {
      validarIdentificacion(numeroLimpio, datos.tipoIdentificacion)
    }
  }

  const pacienteExistente = datos.nombres && datos.apellidos

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Tipo de Identificación</Label>
        <Select
          value={datos.tipoIdentificacion}
          onValueChange={(value: "cedula" | "ruc") => {
            onActualizar({
              tipoIdentificacion: value,
              numeroIdentificacion: "",
              nombres: "",
              apellidos: "",
              email: "",
              telefono: "",
            })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cedula">Cédula de Identidad</SelectItem>
            <SelectItem value="ruc">RUC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="identificacion">
          {datos.tipoIdentificacion === "cedula" ? "Número de Cédula" : "Número de RUC"}
        </Label>
        <Input
          id="identificacion"
          type="text"
          placeholder={datos.tipoIdentificacion === "cedula" ? "1234567890" : "1234567890001"}
          value={datos.numeroIdentificacion}
          onChange={(e) => handleIdentificacionChange(e.target.value)}
          maxLength={datos.tipoIdentificacion === "cedula" ? 10 : 13}
          className={errores.numeroIdentificacion ? "border-red-500" : ""}
        />
        {errores.numeroIdentificacion && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errores.numeroIdentificacion}
          </p>
        )}
      </div>

      {pacienteExistente && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>¡Paciente encontrado!</strong>
            <br />
            Hemos encontrado sus datos completos: {datos.nombres} {datos.apellidos}
            <br />
            Podrá revisar y actualizar toda su información en el siguiente paso.
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Información importante:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Su identificación se usa únicamente para la facturación electrónica</li>
          <li>• Si ya es paciente, sus datos se completarán automáticamente</li>
          <li>• Todos los datos están protegidos y son confidenciales</li>
        </ul>
      </div>
    </div>
  )
}
