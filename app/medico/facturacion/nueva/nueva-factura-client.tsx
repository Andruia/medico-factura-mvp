"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Plus, Trash2, Save, Send, UserPlus, Search, BookOpen, AlertCircle, Calendar, DollarSign, QrCode } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { guardarFacturaBorradorAction } from "../actions"
import { getBorradorFacturaAction } from "../actions-borrador"
import { emitirFacturaAction } from "../actions-facturacion"
import { getServiciosAction } from "@/app/medico/servicios/actions"

interface Paciente {
    id: string
    razonSocial: string
    numeroIdentificacion: string
    email: string | null
    direccion: string | null
    tieneBorrador?: boolean // Indica si tiene un borrador guardado
}

interface FacturaItem {
    id: string
    descripcion: string
    cantidad: number
    precioUnitario: number
    descuento: number
    ivaTarifa: number // 0, 12, 15
    codigoPrincipal?: string
}

interface FormaPago {
    id: string
    codigo: string
    total: number
    plazo: number
    unidadTiempo: string
}

interface InfoAdicional {
    id: string
    nombre: string
    valor: string
}

interface NuevaFacturaClientProps {
    initialPacientes: Paciente[]
    config: {
        ivaPorcentaje: number
        moneda: string
        establecimiento: string
        puntoEmision: string
        secuencial?: string
    }
}

export default function NuevaFacturaClient({ initialPacientes, config }: NuevaFacturaClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pacientePreseleccionado = searchParams.get("pacienteId")

    // State
    const [pacienteSeleccionado, setPacienteSeleccionado] = useState<string>(pacientePreseleccionado || "")
    const [items, setItems] = useState<FacturaItem[]>([
        { id: '1', descripcion: 'Consulta Médica', cantidad: 1, precioUnitario: 40.00, descuento: 0, ivaTarifa: 0 }
    ])

    // Novedades: Pagos e Info Adicional
    const [formasPago, setFormasPago] = useState<FormaPago[]>([
        { id: '1', codigo: '20', total: 40.00, plazo: 0, unidadTiempo: 'Dias' }
    ])
    const [infoAdicional, setInfoAdicional] = useState<InfoAdicional[]>([])

    // Catalog Services State
    const [showCatalog, setShowCatalog] = useState(false)
    const [serviciosCatalog, setServiciosCatalog] = useState<any[]>([])
    const [catalogSearch, setCatalogSearch] = useState("")

    const [procesando, setProcesando] = useState(false)

    // Load resources
    useEffect(() => {
        // Load services
        getServiciosAction().then(data => setServiciosCatalog(data))

        // Load draft if selected
        if (pacienteSeleccionado) {
            setProcesando(true)

            // Reset state to defaults for new patient
            setItems([])
            setFormasPago([])
            setInfoAdicional([])

            getBorradorFacturaAction(pacienteSeleccionado)
                .then(borrador => {
                    if (borrador && (borrador as any).items.length > 0) {
                        setItems((borrador as any).items.map((i: any) => ({
                            ...i,
                            ivaTarifa: i.ivaTarifa !== undefined ? Number(i.ivaTarifa) : 0,
                            precioUnitario: Number(i.precioUnitario)
                        })))

                        if ((borrador as any).formasPago && (borrador as any).formasPago.length > 0) {
                            setFormasPago((borrador as any).formasPago)
                        } else {
                            // Default payment if not in draft
                            setFormasPago([{ id: '1', codigo: '20', total: 0, plazo: 0, unidadTiempo: 'Dias' }])
                        }

                        if ((borrador as any).infoAdicional) {
                            setInfoAdicional((borrador as any).infoAdicional)
                        }

                        console.log("Borrador cargado", borrador.id)
                    } else {
                        // No draft, set defaults
                        setItems([{ id: '1', descripcion: 'Consulta Médica', cantidad: 1, precioUnitario: 40.00, descuento: 0, ivaTarifa: 0 }])
                        setFormasPago([{ id: '1', codigo: '20', total: 40.00, plazo: 0, unidadTiempo: 'Dias' }])
                    }
                })
                .finally(() => setProcesando(false))
        }
    }, [pacienteSeleccionado])

    // Derived State
    const paciente = useMemo(() =>
        initialPacientes.find(p => p.id === pacienteSeleccionado),
        [pacienteSeleccionado, initialPacientes])

    const totales = useMemo(() => {
        let subtotal0 = 0
        let subtotal12 = 0
        let subtotal15 = 0
        let descuentoTotal = 0

        items.forEach(item => {
            const totalLinea = item.cantidad * item.precioUnitario
            descuentoTotal += item.descuento
            const baseImponible = totalLinea - item.descuento

            if (item.ivaTarifa === 0) subtotal0 += baseImponible
            else if (item.ivaTarifa === 12) subtotal12 += baseImponible
            else if (item.ivaTarifa === 15) subtotal15 += baseImponible
        })

        const iva12 = subtotal12 * 0.12
        const iva15 = subtotal15 * 0.15
        const totalIva = iva12 + iva15
        const subtotalGeneral = subtotal0 + subtotal12 + subtotal15
        const total = subtotalGeneral + totalIva

        return {
            subtotal: subtotalGeneral,
            descuento: descuentoTotal,
            subtotal12,
            subtotal15,
            subtotal0,
            iva: totalIva,
            total
        }
    }, [items])

    // Update default payment method amount when total changes
    useEffect(() => {
        if (formasPago.length === 1 && formasPago[0].codigo === '20') {
            setFormasPago([{ ...formasPago[0], total: totales.total }])
        }
    }, [totales.total])

    // Handlers
    const agregarItem = () => {
        setItems([...items, {
            id: Date.now().toString(),
            descripcion: "",
            cantidad: 1,
            precioUnitario: 0,
            descuento: 0,
            ivaTarifa: 0
        }])
    }

    const agregarDesdeCatalogo = (servicio: any) => {
        setItems([...items, {
            id: Date.now().toString(),
            descripcion: servicio.nombre,
            cantidad: 1,
            precioUnitario: Number(servicio.precioUnitario),
            descuento: 0,
            ivaTarifa: Number(servicio.ivaTarifa),
            codigoPrincipal: servicio.codigoPrincipal
        }])
        setShowCatalog(false)
    }

    const eliminarItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(i => i.id !== id))
        }
    }

    const actualizarItem = (id: string, campo: keyof FacturaItem, valor: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                return { ...item, [campo]: valor }
            }
            return item
        }))
    }

    // Handlers for Formas de Pago
    const agregarFormaPago = () => {
        const restante = Math.max(0, totales.total - formasPago.reduce((acc, p) => acc + p.total, 0))
        setFormasPago([...formasPago, {
            id: Date.now().toString(),
            codigo: '20',
            total: Number(restante.toFixed(2)),
            plazo: 0,
            unidadTiempo: 'Dias'
        }])
    }

    const eliminarFormaPago = (id: string) => {
        setFormasPago(formasPago.filter(f => f.id !== id))
    }

    const actualizarFormaPago = (id: string, campo: keyof FormaPago, valor: any) => {
        setFormasPago(formasPago.map(f => f.id === id ? { ...f, [campo]: valor } : f))
    }

    // Handlers for Info Adicional
    const agregarInfo = () => {
        setInfoAdicional([...infoAdicional, { id: Date.now().toString(), nombre: "", valor: "" }])
    }

    const eliminarInfo = (id: string) => {
        setInfoAdicional(infoAdicional.filter(i => i.id !== id))
    }

    const actualizarInfo = (id: string, campo: keyof InfoAdicional, valor: string) => {
        setInfoAdicional(infoAdicional.map(i => i.id === id ? { ...i, [campo]: valor } : i))
    }


    const emitirFactura = async () => {
        if (!paciente) {
            alert("Por favor seleccione un paciente")
            return
        }

        if (items.some(i => !i.descripcion || i.cantidad <= 0 || i.precioUnitario < 0)) {
            alert("Por favor verifique los detalles de la factura")
            return
        }

        // Validar Pagos
        const totalPagos = formasPago.reduce((acc, p) => acc + p.total, 0)
        if (Math.abs(totalPagos - totales.total) > 0.05) { // Tolerancia 5 centavos
            alert(`El total de formas de pago ($${totalPagos.toFixed(2)}) no coincide con el total de la factura ($${totales.total.toFixed(2)})`)
            return
        }

        setProcesando(true)

        try {
            const resultado = await emitirFacturaAction({
                pacienteId: paciente.id,
                items,
                totales,
                formasPago, // NEW
                infoAdicional // NEW
            })

            if (resultado.success) {
                const esPendiente = resultado.estado === "RECIBIDA"

                if (esPendiente) {
                    alert("✅ Documento RECIBIDO por el SRI.\n\nEl SRI está demorando en autorizar. La factura aparecerá como 'Autorizada' en su historial en unos momentos.\n\nPuede consultar el estado desde el Dashboard.")
                } else {
                    if (confirm("🚀 ¡Factura EMITIDA y AUTORIZADA con éxito!\n\n¿Desea ver el RIDE (PDF) ahora?")) {
                        window.open(`/api/facturacion/pdf/${resultado.facturaId}`, '_blank');
                    }
                }
                router.push("/medico/dashboard")
            } else {
                alert("Error al emitir factura: " + resultado.error)
                console.error(resultado.error)
            }
        } catch (error) {
            console.error("Error inesperado:", error)
            alert("Ocurrió un error inesperado al emitir la factura")
        } finally {
            setProcesando(false)
        }
    }

    const guardarBorrador = async () => {
        if (!paciente) {
            alert("Seleccione un paciente primero")
            return
        }

        setProcesando(true)
        try {
            const resultado = await guardarFacturaBorradorAction({
                pacienteId: paciente.id,
                items,
                totales,
                formasPago,
                infoAdicional
            })

            if (resultado.success) {
                alert("✅ Borrador guardado exitosamente.\n\nPuedes continuar editando o hacer clic en 'Emitir al SRI' cuando estés listo.")
                // NO redirigir - mantener al paciente en la cola para continuar editando
            } else {
                alert("Error: " + resultado.error)
            }
        } catch (error) {
            console.error(error)
            alert("Error al guardar borrador")
        } finally {
            setProcesando(false)
        }
    }

    const filteredCatalog = serviciosCatalog.filter(s =>
        s.nombre.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        s.codigoPrincipal?.toLowerCase().includes(catalogSearch.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" onClick={() => router.back()}>
                                <ArrowLeft className="h-5 w-5 mr-1" />
                                Volver
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Nueva Factura</h1>
                                <p className="text-sm text-gray-500">
                                    Secuencial: {config.establecimiento}-{config.puntoEmision}-{config.secuencial || "000000001"}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" disabled={procesando} onClick={guardarBorrador}>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Borrador
                            </Button>
                            <Button onClick={emitirFactura} disabled={procesando}>
                                <Send className="h-4 w-4 mr-2" />
                                {procesando ? "Procesando..." : "Emitir al SRI"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 grid lg:grid-cols-3 gap-8">

                {/* Left Column: Form */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Client Selection */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>Datos del Cliente</span>
                                <Button variant="ghost" size="sm" className="text-blue-600">
                                    + Nuevo Cliente
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Select onValueChange={setPacienteSeleccionado} value={pacienteSeleccionado}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar paciente de la cola..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {initialPacientes.length === 0 ? (
                                                    <div className="p-4 text-center text-sm text-gray-500">
                                                        No hay pacientes en cola.
                                                        <br />
                                                        Registra pacientes desde el Dashboard.
                                                    </div>
                                                ) : (
                                                    initialPacientes.map((p, index) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">#{index + 1}</span>
                                                                <span>{p.razonSocial} ({p.numeroIdentificacion})</span>
                                                                {(p as any).tieneBorrador && (
                                                                    <Badge variant="outline" className="ml-2 text-[10px] bg-yellow-50 text-yellow-700 border-yellow-300">
                                                                        Borrador
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {paciente ? (
                                    <div className="space-y-4">
                                        {(paciente as any).facturas?.length > 0 && (
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-blue-800 text-xs">
                                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-bold">Información</p>
                                                    <p>Este paciente ya tiene una emisión (Autorizada o en Proceso) el día de hoy. Verifique sus emisiones recientes en el Dashboard para evitar duplicados innecesarios.</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg text-sm">
                                            <div>
                                                <span className="text-gray-500 block">RUC/Cédula:</span>
                                                <span className="font-medium">{paciente.numeroIdentificacion}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 block">Email:</span>
                                                <span className="font-medium">{paciente.email || "No registrado"}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-gray-500 block">Dirección:</span>
                                                <span className="font-medium">{paciente.direccion || "No registrada"}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg dashed border-2 border-gray-200">
                                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>Seleccione un paciente para comenzar</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Items */}
                    <Card>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-base">Detalle de Factura</CardTitle>
                            <Button size="sm" variant="outline" onClick={() => setShowCatalog(true)}>
                                <BookOpen className="h-4 w-4 mr-2" />
                                Catálogo
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[35%]">Descripción</TableHead>
                                        <TableHead className="w-[10%] text-right">Cant.</TableHead>
                                        <TableHead className="w-[15%] text-right">Precio</TableHead>
                                        <TableHead className="w-[15%]">IVA</TableHead>
                                        <TableHead className="w-[15%] text-right">Total</TableHead>
                                        <TableHead className="w-[10%]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <Input
                                                    value={item.descripcion}
                                                    onChange={(e) => actualizarItem(item.id, 'descripcion', e.target.value)}
                                                    placeholder="Descripción del servicio"
                                                    className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.cantidad}
                                                    onChange={(e) => actualizarItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                                                    className="text-right w-16 ml-auto h-8 px-1"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.precioUnitario}
                                                    onChange={(e) => actualizarItem(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                                                    className="text-right w-20 ml-auto h-8 px-1"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={item.ivaTarifa.toString()}
                                                    onValueChange={(v) => actualizarItem(item.id, 'ivaTarifa', parseInt(v))}
                                                >
                                                    <SelectTrigger className="h-8 border-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="0">0%</SelectItem>
                                                        <SelectItem value="12">12%</SelectItem>
                                                        <SelectItem value="15">15%</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-sm">
                                                ${(item.cantidad * item.precioUnitario).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => eliminarItem(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="p-4 border-t">
                                <Button variant="outline" size="sm" onClick={agregarItem} className="w-full border-dashed">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Agregar Ítem Manual
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Formas de Pago */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Formas de Pago</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {formasPago.map((fp) => (
                                <div key={fp.id} className="flex gap-2 items-center text-sm">
                                    <div className="flex-1">
                                        <Select value={fp.codigo} onValueChange={(v) => actualizarFormaPago(fp.id, 'codigo', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="01">01 - SIN UTILIZACION DEL SISTEMA FINANCIERO (Efectivo)</SelectItem>
                                                <SelectItem value="20">20 - OTROS CON UTILIZACION DEL SISTEMA FINANCIERO</SelectItem>
                                                <SelectItem value="19">19 - TARJETA DE CREDITO</SelectItem>
                                                <SelectItem value="16">16 - TARJETA DE DEBITO</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-24">
                                        <Input
                                            type="number"
                                            placeholder="Valor"
                                            value={fp.total}
                                            onChange={(e) => actualizarFormaPago(fp.id, 'total', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="w-20">
                                        <Input
                                            type="number"
                                            placeholder="Plazo"
                                            value={fp.plazo}
                                            onChange={(e) => actualizarFormaPago(fp.id, 'plazo', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <Select value={fp.unidadTiempo} onValueChange={(v) => actualizarFormaPago(fp.id, 'unidadTiempo', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Dias">Días</SelectItem>
                                                <SelectItem value="Meses">Meses</SelectItem>
                                                <SelectItem value="Anios">Años</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => eliminarFormaPago(fp.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={agregarFormaPago} className="border-dashed w-full">
                                <Plus className="h-4 w-4 mr-2" /> Agregar Forma de Pago
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Info Adicional */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Información Adicional (Opcional)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {infoAdicional.map((info) => (
                                <div key={info.id} className="flex gap-2 items-center">
                                    <Input
                                        placeholder="Nombre (ej: Email, Dirección, Obs)"
                                        className="w-1/3"
                                        value={info.nombre}
                                        onChange={(e) => actualizarInfo(info.id, 'nombre', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Valor"
                                        className="flex-1"
                                        value={info.valor}
                                        onChange={(e) => actualizarInfo(info.id, 'valor', e.target.value)}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => eliminarInfo(info.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={agregarInfo} className="border-dashed w-full">
                                <Plus className="h-4 w-4 mr-2" /> Agregar Campo Adicional
                            </Button>
                        </CardContent>
                    </Card>

                </div>

                {/* Right Column: Totals */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Resumen de Valores</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal 12%:</span>
                                <span>${totales.subtotal12.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal 15%:</span>
                                <span>${totales.subtotal15.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal 0%:</span>
                                <span>${totales.subtotal0.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Descuento:</span>
                                <span>${totales.descuento.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">IVA Total:</span>
                                <span>${totales.iva.toFixed(2)}</span>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <div className="flex justify-between items-center font-bold text-lg">
                                    <span>Total a Pagar:</span>
                                    <span className="text-blue-600">${totales.total.toFixed(2)}</span>
                                </div>
                            </div>

                        </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-100">
                        <CardContent className="p-4">
                            <h4 className="font-semibold text-blue-900 mb-2 text-sm">Integración SRI</h4>
                            <p className="text-xs text-blue-700 mb-2">
                                Esta factura será enviada automáticamente al SRI.
                            </p>
                            <p className="text-xs text-blue-700">
                                Los valores de IVA se calculan automáticamente según la tarifa seleccionada por ítem.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Catalog Dialog */}
            <Dialog open={showCatalog} onOpenChange={setShowCatalog}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Catálogo de Servicios</DialogTitle>
                    </DialogHeader>

                    <div className="relative py-2">
                        <Search className="absolute left-2.5 top-5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Buscar..."
                            className="pl-8"
                            value={catalogSearch}
                            onChange={(e) => setCatalogSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Precio</TableHead>
                                    <TableHead>Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCatalog.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                                            No se encontraron servicios
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCatalog.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell>
                                                <div className="font-medium">{s.nombre}</div>
                                                <div className="text-xs text-gray-500">{s.codigoPrincipal}</div>
                                            </TableCell>
                                            <TableCell>${Number(s.precioUnitario).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button size="sm" onClick={() => agregarDesdeCatalogo(s)}>
                                                    Seleccionar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}
