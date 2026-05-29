"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ArrowRight, CheckCircle, User } from "lucide-react"
import Link from "next/link"
import { registrarPacienteAction } from "./actions"
import { getMedicoPublicInfoAction } from "../../medico/qr/actions-public"

// Componentes de pasos
import PasoIdentificacion from "@/components/formulario/PasoIdentificacion"
import PasoDatosPersonales from "@/components/formulario/PasoDatosPersonales"
import PasoConfirmacion from "@/components/formulario/PasoConfirmacion"

interface DatosPaciente {
  // Paso 1: Identificación
  tipoIdentificacion: "cedula" | "ruc"
  numeroIdentificacion: string

  // Paso 2: Datos Personales
  nombres: string
  apellidos: string
  email: string
  telefono: string
  direccion: string

  // Metadata
  medicoId: string
  fechaCreacion: string
}

const pasos = [
  { id: 1, titulo: "Identificación", descripcion: "Ingrese su cédula o RUC" },
  { id: 2, titulo: "Datos Personales", descripcion: "Complete su información personal y dirección" },
  { id: 3, titulo: "Confirmación", descripcion: "Revise y confirme sus datos" },
]

export default function FormularioPaciente() {
  const searchParams = useSearchParams()
  const medicoId = searchParams.get("medico") || "1"

  const [medico, setMedico] = useState<{ nombre: string; especialidad: string } | null>(null)

  useEffect(() => {
    if (medicoId) {
      getMedicoPublicInfoAction(medicoId).then(data => {
        if (data) setMedico(data)
      })
    }
  }, [medicoId])

  const [pasoActual, setPasoActual] = useState(1)
  const [datosPaciente, setDatosPaciente] = useState<DatosPaciente>({
    tipoIdentificacion: "cedula",
    numeroIdentificacion: "",
    nombres: "",
    apellidos: "",
    email: "",
    telefono: "",
    direccion: "",
    medicoId: medicoId,
    fechaCreacion: new Date().toISOString(),
  })

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardandoAutomatico, setGuardandoAutomatico] = useState(false)

  // Guardado automático
  useEffect(() => {
    const timer = setTimeout(() => {
      guardarProgreso()
    }, 2000)

    return () => clearTimeout(timer)
  }, [datosPaciente])

  // Actualizar la lógica de determinación de paso actual en useEffect:
  useEffect(() => {
    const progresoGuardado = localStorage.getItem(`formulario-${medicoId}`)
    if (progresoGuardado) {
      const datos = JSON.parse(progresoGuardado)
      setDatosPaciente(datos)
      // No forzamos pasos automáticos, siempre inicia en 1 para evitar confusión
      setPasoActual(1)
    }
  }, [medicoId])

  const guardarProgreso = () => {
    setGuardandoAutomatico(true)
    localStorage.setItem(`formulario-${medicoId}`, JSON.stringify(datosPaciente))
    setTimeout(() => setGuardandoAutomatico(false), 1000)
  }

  const actualizarDatos = (nuevosDatos: Partial<DatosPaciente>) => {
    setDatosPaciente((prev) => ({ ...prev, ...nuevosDatos }))
    // Limpiar errores relacionados
    const nuevosErrores = { ...errores }
    Object.keys(nuevosDatos).forEach((key) => {
      delete nuevosErrores[key]
    })
    setErrores(nuevosErrores)
  }

  const validarPaso = (paso: number): boolean => {
    const nuevosErrores: Record<string, string> = {}

    switch (paso) {
      case 1:
        if (!datosPaciente.numeroIdentificacion) {
          nuevosErrores.numeroIdentificacion = "La identificación es requerida"
        } else if (datosPaciente.tipoIdentificacion === "cedula" && datosPaciente.numeroIdentificacion.length !== 10) {
          nuevosErrores.numeroIdentificacion = "La cédula debe tener 10 dígitos"
        } else if (datosPaciente.tipoIdentificacion === "ruc" && datosPaciente.numeroIdentificacion.length !== 13) {
          nuevosErrores.numeroIdentificacion = "El RUC debe tener 13 dígitos"
        }
        break

      // En la función validarPaso, mover la validación de dirección al paso 2:
      case 2:
        if (!datosPaciente.nombres.trim()) nuevosErrores.nombres = "Los nombres son requeridos"
        if (!datosPaciente.apellidos.trim()) nuevosErrores.apellidos = "Los apellidos son requeridos"
        if (!datosPaciente.email.trim()) {
          nuevosErrores.email = "El email es requerido"
        } else if (!/\S+@\S+\.\S+/.test(datosPaciente.email)) {
          nuevosErrores.email = "El email no es válido"
        }
        if (!datosPaciente.telefono.trim()) {
          nuevosErrores.telefono = "El teléfono es requerido"
        } else if (!/^[0-9]{10}$/.test(datosPaciente.telefono.replace(/\D/g, ""))) {
          nuevosErrores.telefono = "El teléfono debe tener 10 dígitos"
        }
        if (!datosPaciente.direccion.trim()) nuevosErrores.direccion = "La dirección es requerida"
        break
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const siguientePaso = () => {
    if (validarPaso(pasoActual)) {
      setPasoActual((prev) => Math.min(prev + 1, pasos.length))
    }
  }

  const pasoAnterior = () => {
    setPasoActual((prev) => Math.max(prev - 1, 1))
  }

  // Actualizar la lógica de envío para validar el paso 2 en lugar del 3:
  const enviarFormulario = async () => {
    if (validarPaso(2)) {
      setGuardandoAutomatico(true)
      try {
        const resultado = await registrarPacienteAction(datosPaciente)

        if (resultado.success) {
          // Guardar datos para la página de confirmación
          localStorage.setItem(`paciente-completado-${medicoId}`, JSON.stringify({
            ...datosPaciente,
            fechaEnvio: new Date().toISOString()
          }))

          // Limpiar borrador para que la próxima vez inicie vacío
          localStorage.removeItem(`formulario-${medicoId}`)

          window.location.href = `/paciente/confirmacion?medico=${medicoId}`
        } else {
          console.error("Error al guardar paciente:", resultado.error)
          setErrores(prev => ({ ...prev, form: "Error al guardar los datos. Intente nuevamente." }))
        }
      } catch (error) {
        console.error("Error de conexión:", error)
        setErrores(prev => ({ ...prev, form: "Error de conexión. Verifique su internet." }))
      } finally {
        setGuardandoAutomatico(false)
      }
    }
  }

  const progreso = (pasoActual / pasos.length) * 100

  // Actualizar el renderPaso para eliminar el caso 3 (PasoFacturacion):
  const renderPaso = () => {
    switch (pasoActual) {
      case 1:
        return <PasoIdentificacion datos={datosPaciente} errores={errores} onActualizar={actualizarDatos} />
      case 2:
        return <PasoDatosPersonales datos={datosPaciente} errores={errores} onActualizar={actualizarDatos} />
      case 3:
        return <PasoConfirmacion datos={datosPaciente} medico={medico} />
      default:
        return null
    }
  }

  if (!medico) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Médico no encontrado</p>
            <Link href="/paciente/seleccionar-medico">
              <Button className="mt-4">Seleccionar Médico</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <User className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              {medico.nombre} - {medico.especialidad}
            </h1>
          </div>
          <p className="text-gray-600">Complete sus datos para la facturación electrónica</p>
        </div>

        {/* Progress */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Paso {pasoActual} de {pasos.length}
            </span>
            <span className="text-sm text-gray-500">
              {guardandoAutomatico ? "Guardando..." : "Guardado automático"}
            </span>
          </div>
          <Progress value={progreso} className="h-2" />
          <div className="flex justify-between mt-2">
            {pasos.map((paso) => (
              <div
                key={paso.id}
                className={`text-xs text-center ${paso.id <= pasoActual ? "text-blue-600" : "text-gray-400"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${paso.id < pasoActual
                    ? "bg-green-500 text-white"
                    : paso.id === pasoActual
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                    }`}
                >
                  {paso.id < pasoActual ? <CheckCircle className="h-4 w-4" /> : paso.id}
                </div>
                <p className="font-medium">{paso.titulo}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>{pasos[pasoActual - 1].titulo}</CardTitle>
              <p className="text-gray-600">{pasos[pasoActual - 1].descripcion}</p>
            </CardHeader>
            <CardContent>{renderPaso()}</CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <div>
              {pasoActual > 1 && (
                <Button variant="outline" onClick={pasoAnterior}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
              )}
            </div>

            <div>
              {pasoActual < pasos.length ? (
                <Button onClick={siguientePaso}>
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={enviarFormulario} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Enviar Datos
                </Button>
              )}
            </div>
          </div>

          {/* Help */}
          <div className="mt-8 text-center">
            <Alert>
              <AlertDescription>
                Sus datos se guardan automáticamente. Puede cerrar esta página y continuar más tarde.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  )
}
