"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Trash2, CheckCircle, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

interface ServicioConfig {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  precio: number
  iva: number
  categoria: string
}

const categoriasServicios = ["Consultas", "Procedimientos", "Certificados", "Exámenes", "Cirugías", "Otros"]

const serviciosPorEspecialidad = {
  Cardiología: [
    {
      codigo: "CARD_001",
      nombre: "Consulta Cardiológica",
      descripcion: "Evaluación cardiovascular completa",
      precio: 45,
      categoria: "Consultas",
    },
    {
      codigo: "CARD_002",
      nombre: "Electrocardiograma",
      descripcion: "ECG de 12 derivaciones",
      precio: 25,
      categoria: "Exámenes",
    },
    {
      codigo: "CARD_003",
      nombre: "Ecocardiograma",
      descripcion: "Ultrasonido cardíaco",
      precio: 80,
      categoria: "Exámenes",
    },
  ],
  Pediatría: [
    {
      codigo: "PED_001",
      nombre: "Consulta Pediátrica",
      descripcion: "Evaluación médica infantil",
      precio: 35,
      categoria: "Consultas",
    },
    {
      codigo: "PED_002",
      nombre: "Control de Crecimiento",
      descripcion: "Evaluación de desarrollo infantil",
      precio: 20,
      categoria: "Consultas",
    },
    {
      codigo: "PED_003",
      nombre: "Vacunación",
      descripcion: "Aplicación de vacunas",
      precio: 15,
      categoria: "Procedimientos",
    },
  ],
  Dermatología: [
    {
      codigo: "DERM_001",
      nombre: "Consulta Dermatológica",
      descripción: "Evaluación de piel y anexos",
      precio: 40,
      categoria: "Consultas",
    },
    {
      codigo: "DERM_002",
      nombre: "Biopsia de Piel",
      descripcion: "Toma de muestra para análisis",
      precio: 60,
      categoria: "Procedimientos",
    },
  ],
  Ginecología: [
    {
      codigo: "GIN_001",
      nombre: "Consulta Ginecológica",
      descripcion: "Evaluación ginecológica integral",
      precio: 40,
      categoria: "Consultas",
    },
    { codigo: "GIN_002", nombre: "Papanicolaou", descripcion: "Citología cervical", precio: 30, categoria: "Exámenes" },
  ],
  Traumatología: [
    {
      codigo: "TRAUM_001",
      nombre: "Consulta Traumatológica",
      descripcion: "Evaluación del sistema músculo-esquelético",
      precio: 45,
      categoria: "Consultas",
    },
    {
      codigo: "TRAUM_002",
      nombre: "Infiltración",
      descripcion: "Inyección terapéutica articular",
      precio: 35,
      categoria: "Procedimientos",
    },
  ],
  Oftalmología: [
    {
      codigo: "OFT_001",
      nombre: "Consulta Oftalmológica",
      descripcion: "Evaluación visual completa",
      precio: 35,
      categoria: "Consultas",
    },
    {
      codigo: "OFT_002",
      nombre: "Examen de Fondo de Ojo",
      descripcion: "Evaluación de retina",
      precio: 25,
      categoria: "Exámenes",
    },
  ],
}

export default function ConfiguracionInicial() {
  const [medico, setMedico] = useState<any>(null)
  const [servicios, setServicios] = useState<ServicioConfig[]>([])
  const [serviciosSugeridos, setServiciosSugeridos] = useState<any[]>([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nuevoServicio, setNuevoServicio] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    precio: "",
    iva: "12",
    categoria: "Consultas",
  })
  const router = useRouter()

  useEffect(() => {
    const session = localStorage.getItem("medico-session")
    if (session) {
      const medicoData = JSON.parse(session)
      setMedico(medicoData)

      // Cargar servicios sugeridos por especialidad
      const especialidad = getEspecialidadFromNombre(medicoData.nombre)
      if (especialidad && serviciosPorEspecialidad[especialidad]) {
        setServiciosSugeridos(serviciosPorEspecialidad[especialidad])
      }

      // Verificar si ya tiene servicios configurados
      const serviciosExistentes = localStorage.getItem(`servicios-medico-${medicoData.id}`)
      if (serviciosExistentes) {
        router.push("/medico/dashboard")
      }
    }
  }, [])

  const getEspecialidadFromNombre = (nombre: string) => {
    const especialidades = {
      "Dr. Juan Martínez": "Cardiología",
      "Dra. Ana Gómez": "Pediatría",
      "Dr. Carlos Sánchez": "Dermatología",
      "Dra. María López": "Ginecología",
      "Dr. Luis Ramírez": "Traumatología",
      "Dra. Carmen Torres": "Oftalmología",
    }
    return especialidades[nombre as keyof typeof especialidades]
  }

  const agregarServicioSugerido = (servicioSugerido: any) => {
    const nuevoServicio: ServicioConfig = {
      id: Date.now().toString(),
      codigo: servicioSugerido.codigo,
      nombre: servicioSugerido.nombre,
      descripcion: servicioSugerido.descripcion,
      precio: servicioSugerido.precio,
      iva: 12,
      categoria: servicioSugerido.categoria,
    }
    setServicios([...servicios, nuevoServicio])
  }

  const agregarServicioPersonalizado = () => {
    if (!nuevoServicio.codigo || !nuevoServicio.nombre || !nuevoServicio.precio) return

    const servicio: ServicioConfig = {
      id: Date.now().toString(),
      codigo: nuevoServicio.codigo,
      nombre: nuevoServicio.nombre,
      descripcion: nuevoServicio.descripcion,
      precio: Number.parseFloat(nuevoServicio.precio),
      iva: Number.parseInt(nuevoServicio.iva),
      categoria: nuevoServicio.categoria,
    }

    setServicios([...servicios, servicio])
    setNuevoServicio({
      codigo: "",
      nombre: "",
      descripcion: "",
      precio: "",
      iva: "12",
      categoria: "Consultas",
    })
    setMostrarFormulario(false)
  }

  const eliminarServicio = (id: string) => {
    setServicios(servicios.filter((s) => s.id !== id))
  }

  const finalizarConfiguracion = () => {
    if (servicios.length === 0) {
      alert("Debe agregar al menos un servicio")
      return
    }

    // Guardar servicios del médico
    const serviciosCompletos = servicios.map((s) => ({
      ...s,
      activo: true,
      fechaCreacion: new Date().toISOString(),
      usos: 0,
    }))

    localStorage.setItem(`servicios-medico-${medico.id}`, JSON.stringify(serviciosCompletos))

    // Marcar configuración como completada
    localStorage.setItem(`configuracion-completada-${medico.id}`, "true")

    router.push("/medico/dashboard")
  }

  if (!medico) return <div>Cargando...</div>

  const especialidad = getEspecialidadFromNombre(medico.nombre)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración Inicial</h1>
            <p className="text-gray-600 mb-4">
              Bienvenido {medico.nombre} - Configure los servicios de su consulta de {especialidad}
            </p>
            <Alert className="max-w-2xl mx-auto">
              <AlertDescription>
                Configure los servicios que ofrece en su consulta. Estos aparecerán cuando valide pacientes para
                facturación.
              </AlertDescription>
            </Alert>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Servicios Sugeridos */}
            <Card>
              <CardHeader>
                <CardTitle>Servicios Sugeridos para {especialidad}</CardTitle>
                <CardDescription>Servicios comunes en su especialidad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {serviciosSugeridos.map((servicio, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{servicio.nombre}</h3>
                        <p className="text-sm text-gray-600">{servicio.descripcion}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{servicio.codigo}</Badge>
                          <Badge variant="secondary">${servicio.precio}</Badge>
                          <Badge variant="outline">{servicio.categoria}</Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => agregarServicioSugerido(servicio)}
                        disabled={servicios.some((s) => s.codigo === servicio.codigo)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button variant="outline" className="w-full" onClick={() => setMostrarFormulario(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Servicio Personalizado
                </Button>
              </CardContent>
            </Card>

            {/* Servicios Configurados */}
            <Card>
              <CardHeader>
                <CardTitle>Sus Servicios Configurados ({servicios.length})</CardTitle>
                <CardDescription>Servicios que aparecerán en su panel de facturación</CardDescription>
              </CardHeader>
              <CardContent>
                {servicios.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No ha agregado servicios aún</p>
                    <p className="text-sm">Seleccione servicios sugeridos o agregue personalizados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {servicios.map((servicio) => (
                      <div key={servicio.id} className="border rounded-lg p-4 bg-green-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium">{servicio.nombre}</h3>
                            <p className="text-sm text-gray-600">{servicio.descripcion}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{servicio.codigo}</Badge>
                              <Badge variant="secondary">${servicio.precio}</Badge>
                              <Badge variant="outline">IVA {servicio.iva}%</Badge>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => eliminarServicio(servicio.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {servicios.length > 0 && (
                  <Button className="w-full mt-6 bg-green-600 hover:bg-green-700" onClick={finalizarConfiguracion}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar Configuración
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Modal Servicio Personalizado */}
          {mostrarFormulario && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Agregar Servicio Personalizado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Código del Servicio</Label>
                    <Input
                      placeholder="CONS_001"
                      value={nuevoServicio.codigo}
                      onChange={(e) => setNuevoServicio({ ...nuevoServicio, codigo: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nombre del Servicio</Label>
                    <Input
                      placeholder="Consulta Especializada"
                      value={nuevoServicio.nombre}
                      onChange={(e) => setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      placeholder="Descripción del servicio"
                      value={nuevoServicio.descripcion}
                      onChange={(e) => setNuevoServicio({ ...nuevoServicio, descripcion: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Precio ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="25.00"
                        value={nuevoServicio.precio}
                        onChange={(e) => setNuevoServicio({ ...nuevoServicio, precio: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>IVA (%)</Label>
                      <Select
                        value={nuevoServicio.iva}
                        onValueChange={(value) => setNuevoServicio({ ...nuevoServicio, iva: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select
                      value={nuevoServicio.categoria}
                      onValueChange={(value) => setNuevoServicio({ ...nuevoServicio, categoria: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriasServicios.map((categoria) => (
                          <SelectItem key={categoria} value={categoria}>
                            {categoria}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={agregarServicioPersonalizado} className="flex-1">
                      Agregar Servicio
                    </Button>
                    <Button variant="outline" onClick={() => setMostrarFormulario(false)}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
