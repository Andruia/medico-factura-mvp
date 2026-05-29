"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Pencil, Trash2, Search, ArrowLeft, Loader2 } from "lucide-react"
import { getServiciosAction, saveServicioAction, deleteServicioAction } from "./actions"

interface Servicio {
  id: string
  nombre: string
  precioUnitario: number
  codigoPrincipal?: string | null
  codigoAuxiliar?: string | null
  descripcion?: string | null
  ivaTarifa: number
}

export default function ServiciosPage() {
  const router = useRouter()
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Modal State
  const [isOpen, setIsOpen] = useState(false)
  const [currentServicio, setCurrentServicio] = useState<Partial<Servicio>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargarServicios()
  }, [])

  const cargarServicios = async () => {
    setLoading(true)
    const data = await getServiciosAction()
    setServicios(data as Servicio[])
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await saveServicioAction(currentServicio)
    if (result.success) {
      setIsOpen(false)
      cargarServicios()
      setCurrentServicio({})
    } else {
      alert("Error: " + result.error)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Está seguro de eliminar este servicio?")) {
      await deleteServicioAction(id)
      cargarServicios()
    }
  }

  const openEdit = (servicio: Servicio) => {
    setCurrentServicio(servicio)
    setIsOpen(true)
  }

  const openNew = () => {
    setCurrentServicio({ ivaTarifa: 12, precioUnitario: 0 })
    setIsOpen(true)
  }

  const filteredServicios = servicios.filter(s =>
    s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.codigoPrincipal?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push("/medico/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Catálogo de Servicios</h1>
              <p className="text-gray-500">Administre sus productos y servicios frecuentes</p>
            </div>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Servicio
          </Button>
        </div>

        {/* Search & List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar por nombre o código..."
                className="pl-8 max-w-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredServicios.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No se encontraron servicios.</p>
                <Button variant="link" onClick={openNew}>Crear el primero</Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre / Descripción</TableHead>
                      <TableHead>IVA</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServicios.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-gray-600">
                          {item.codigoPrincipal || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{item.nombre}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[300px]">{item.descripcion}</div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${item.ivaTarifa > 0 ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                            {item.ivaTarifa}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${Number(item.precioUnitario).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit/Create Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{currentServicio.id ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
              <DialogDescription>
                Complete la información del producto o servicio para facturación.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código Principal</Label>
                  <Input
                    id="codigo"
                    placeholder="Ej: CON-001"
                    value={currentServicio.codigoPrincipal || ""}
                    onChange={(e) => setCurrentServicio({ ...currentServicio, codigoPrincipal: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigoAux">Código Auxiliar (Opcional)</Label>
                  <Input
                    id="codigoAux"
                    value={currentServicio.codigoAuxiliar || ""}
                    onChange={(e) => setCurrentServicio({ ...currentServicio, codigoAuxiliar: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Servicio *</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Consulta General"
                  value={currentServicio.nombre || ""}
                  onChange={(e) => setCurrentServicio({ ...currentServicio, nombre: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción / Detalle Adicional</Label>
                <Input
                  id="descripcion"
                  placeholder="Detalle que aparecerá en la factura..."
                  value={currentServicio.descripcion || ""}
                  onChange={(e) => setCurrentServicio({ ...currentServicio, descripcion: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio Unitario ($) *</Label>
                  <Input
                    id="precio"
                    type="number"
                    step="0.01"
                    value={currentServicio.precioUnitario || ""}
                    onChange={(e) => setCurrentServicio({ ...currentServicio, precioUnitario: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iva">Tarifa IVA</Label>
                  <Select
                    value={currentServicio.ivaTarifa?.toString()}
                    onValueChange={(v) => setCurrentServicio({ ...currentServicio, ivaTarifa: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
