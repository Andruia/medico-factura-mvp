"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, User } from "lucide-react"
import Link from "next/link"

const medicosDemo = [
  {
    id: "1",
    nombre: "Dr. Juan Martínez",
    especialidad: "Cardiología",
    avatar: "/placeholder.svg?height=80&width=80",
    disponible: true,
    color: "bg-red-100 border-red-200",
  },
  {
    id: "2",
    nombre: "Dra. Ana Gómez",
    especialidad: "Pediatría",
    avatar: "/placeholder.svg?height=80&width=80",
    disponible: true,
    color: "bg-blue-100 border-blue-200",
  },
  {
    id: "3",
    nombre: "Dr. Carlos Sánchez",
    especialidad: "Dermatología",
    avatar: "/placeholder.svg?height=80&width=80",
    disponible: true,
    color: "bg-green-100 border-green-200",
  },
  {
    id: "4",
    nombre: "Dra. María López",
    especialidad: "Ginecología",
    avatar: "/placeholder.svg?height=80&width=80",
    disponible: true,
    color: "bg-purple-100 border-purple-200",
  },
  {
    id: "5",
    nombre: "Dr. Luis Ramírez",
    especialidad: "Traumatología",
    avatar: "/placeholder.svg?height=80&width=80",
    disponible: false,
    color: "bg-orange-100 border-orange-200",
  },
  {
    id: "6",
    nombre: "Dra. Carmen Torres",
    especialidad: "Oftalmología",
    avatar: "/placeholder.svg?height=80&width=80",
    disponible: true,
    color: "bg-teal-100 border-teal-200",
  },
]

export default function SeleccionarMedico() {
  const [busqueda, setBusqueda] = useState("")
  const [medicosFiltrados, setMedicosFiltrados] = useState(medicosDemo)

  const handleBusqueda = (valor: string) => {
    setBusqueda(valor)
    const filtrados = medicosDemo.filter(
      (medico) =>
        medico.nombre.toLowerCase().includes(valor.toLowerCase()) ||
        medico.especialidad.toLowerCase().includes(valor.toLowerCase()),
    )
    setMedicosFiltrados(filtrados)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido a Clínica Médica Demo</h1>
          <p className="text-gray-600 mb-6">
            Por favor, seleccione el médico que le atendió para continuar con su facturación
          </p>

          {/* Búsqueda */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar médico o especialidad..."
              value={busqueda}
              onChange={(e) => handleBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Grid de Médicos */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {medicosFiltrados.map((medico) => (
            <Card
              key={medico.id}
              className={`hover:shadow-lg transition-all duration-200 cursor-pointer ${medico.color} ${
                !medico.disponible ? "opacity-60" : "hover:scale-105"
              }`}
            >
              <CardContent className="p-6 text-center">
                <div className="relative mb-4">
                  <img
                    src={medico.avatar || "/placeholder.svg"}
                    alt={medico.nombre}
                    className="w-20 h-20 rounded-full mx-auto border-4 border-white shadow-md"
                  />
                  {medico.disponible ? (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
                  ) : (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-400 rounded-full border-2 border-white"></div>
                  )}
                </div>

                <h3 className="font-bold text-lg text-gray-900 mb-1">{medico.nombre}</h3>
                <p className="text-gray-600 mb-3">{medico.especialidad}</p>

                <div className="flex justify-center mb-4">
                  {medico.disponible ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Disponible
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      No disponible
                    </Badge>
                  )}
                </div>

                {medico.disponible ? (
                  <Link href={`/paciente/formulario?medico=${medico.id}`}>
                    <Button className="w-full">
                      <User className="h-4 w-4 mr-2" />
                      Seleccionar
                    </Button>
                  </Link>
                ) : (
                  <Button disabled className="w-full">
                    No disponible
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {medicosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No se encontraron médicos con ese criterio de búsqueda</p>
            <Button
              variant="outline"
              onClick={() => {
                setBusqueda("")
                setMedicosFiltrados(medicosDemo)
              }}
              className="mt-4"
            >
              Mostrar todos los médicos
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>¿Necesita ayuda? Contacte a recepción</p>
        </div>
      </div>
    </div>
  )
}
