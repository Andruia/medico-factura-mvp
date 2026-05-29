"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
    Shield,
    Upload,
    AlertCircle,
    Calendar,
    User,
    Building,
    ArrowLeft,
    Download,
    Trash2,
    Eye,
    EyeOff,
} from "lucide-react"
import type { CertificadoDigital } from "@/lib/sri/types"
import { guardarCertificadoAction } from "./actions"

interface CertificadosClientProps {
    initialMedico: any
}

export default function CertificadosClient({ initialMedico }: CertificadosClientProps) {
    const router = useRouter()
    // Initialize medico directly from props, no loading state needed for auth
    const [medico] = useState<any>(initialMedico)

    const [certificados, setCertificados] = useState<CertificadoDigital[]>([])
    const [mostrarFormulario, setMostrarFormulario] = useState(false)
    const [cargandoCertificado, setCargandoCertificado] = useState(false)
    const [mostrarPassword, setMostrarPassword] = useState(false)

    const [formulario, setFormulario] = useState({
        archivo: null as File | null,
        password: "",
        confirmarPassword: "",
    })

    const [errores, setErrores] = useState<Record<string, string>>({})
    const [mensaje, setMensaje] = useState<{ tipo: "success" | "error"; texto: string } | null>(null)

    // Only load certificates on mount
    useEffect(() => {
        if (medico?.id) {
            cargarCertificados(medico.id)
        }
    }, [medico])

    const cargarCertificados = (medicoId: string) => {
        const certificadosGuardados = localStorage.getItem(`certificados-medico-${medicoId}`)
        if (certificadosGuardados) {
            setCertificados(JSON.parse(certificadosGuardados))
        }
    }

    const guardarCertificados = (nuevosCertificados: CertificadoDigital[]) => {
        if (!medico) return
        setCertificados(nuevosCertificados)
        localStorage.setItem(`certificados-medico-${medico.id}`, JSON.stringify(nuevosCertificados))
    }

    const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0]
        if (archivo) {
            if (archivo.name.endsWith(".p12") || archivo.name.endsWith(".pfx")) {
                setFormulario((prev) => ({ ...prev, archivo }))
                setErrores((prev) => ({ ...prev, archivo: "" }))
            } else {
                setErrores((prev) => ({ ...prev, archivo: "Solo se permiten archivos .p12 o .pfx" }))
            }
        }
    }

    const validarFormulario = (): boolean => {
        const nuevosErrores: Record<string, string> = {}

        if (!formulario.archivo) {
            nuevosErrores.archivo = "Debe seleccionar un archivo de certificado"
        }

        if (!formulario.password) {
            nuevosErrores.password = "La contraseña es requerida"
        }

        if (formulario.password !== formulario.confirmarPassword) {
            nuevosErrores.confirmarPassword = "Las contraseñas no coinciden"
        }

        setErrores(nuevosErrores)
        return Object.keys(nuevosErrores).length === 0
    }

    const subirCertificado = async () => {
        if (!validarFormulario() || !formulario.archivo) return

        setCargandoCertificado(true)
        setMensaje(null)

        try {
            // DEBUG: Alerta para confirmar inicio
            window.alert("DEBUG: Iniciando carga vía API Route (BYPASS CORS)...")
            console.log("🚀 [Client] Iniciando carga de certificado...")

            const formData = new FormData()
            formData.append("archivo", formulario.archivo)
            formData.append("password", formulario.password)

            const response = await fetch("/api/medico/validar-certificado", {
                method: "POST",
                body: formData,
            })

            const resultado = await response.json()

            console.log("✅ [Client] Respuesta API:", resultado)
            window.alert("DEBUG: API Respondió: " + JSON.stringify(resultado))

            if (!response.ok || !resultado.success) {
                throw new Error(resultado.error || "Error en la validación del certificado")
            }

            console.log("✅ [Client] Certificado validado correctamente")
            const { data } = resultado

            // NUEVO: Guardar en Base de Datos vía Server Action
            const saveResult = await guardarCertificadoAction({
                archivoBase64: data.archivoBase64,
                passwordEncriptada: data.passwordEncriptada,
                ruc: data.ruc,
                fechaVencimiento: new Date(data.fechaVencimiento)
            })

            if (!saveResult.success) {
                throw new Error(saveResult.error)
            }

            console.log("✅ [Client] Certificado guardado en DB")

            const nuevoCertificado: CertificadoDigital = {
                id: Date.now().toString(),
                medicoId: medico.id,
                archivo: data.archivoBase64,
                password: data.passwordEncriptada,
                fechaCarga: new Date(),
                fechaVencimiento: new Date(data.fechaVencimiento),
                titular: data.titular,
                ruc: data.ruc,
                estado: "activo",
                huella: data.huella,
            }

            const certificadosActualizados = [...certificados, nuevoCertificado]
            guardarCertificados(certificadosActualizados)

            setMensaje({ tipo: "success", texto: "Certificado cargado y guardado exitosamente" })
            setMostrarFormulario(false)
            setFormulario({ archivo: null, password: "", confirmarPassword: "" })

        } catch (error) {
            console.error("❌ [Client] Error subiendo certificado:", error)
            window.alert("ERROR API: " + (error instanceof Error ? error.message : String(error)))
            setMensaje({
                tipo: "error",
                texto: "Error: " + (error instanceof Error ? error.message : "Error desconocido")
            })
        } finally {
            setCargandoCertificado(false)
        }
    }

    const eliminarCertificado = (id: string) => {
        if (confirm("¿Está seguro de eliminar este certificado?")) {
            const certificadosActualizados = certificados.filter((c) => c.id !== id)
            guardarCertificados(certificadosActualizados)
            setMensaje({ tipo: "success", texto: "Certificado eliminado" })
        }
    }

    const descargarCertificado = (certificado: CertificadoDigital) => {
        alert("Funcionalidad de descarga disponible en producción")
    }

    const formatearFecha = (fecha: Date | string) => {
        return new Date(fecha).toLocaleDateString("es-EC", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
    }

    const diasParaVencimiento = (fechaVencimiento: Date | string) => {
        const ahora = new Date()
        const vencimiento = new Date(fechaVencimiento)
        const diferencia = vencimiento.getTime() - ahora.getTime()
        return Math.ceil(diferencia / (1000 * 60 * 60 * 24))
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push("/medico/configuracion")}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Configuración
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Certificados Digitales</h1>
                                <p className="text-gray-600">Gestione sus certificados para firma electrónica</p>
                            </div>
                        </div>
                        <Button onClick={() => setMostrarFormulario(true)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Cargar Certificado
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* Mensajes */}
                {mensaje && (
                    <Alert
                        className={`mb-6 ${mensaje.tipo === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
                    >
                        <AlertDescription className={mensaje.tipo === "success" ? "text-green-800" : "text-red-800"}>
                            {mensaje.texto}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Información importante */}
                <Alert className="mb-6">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Importante:</strong> Los certificados digitales son necesarios para la firma electrónica de
                        facturas. Asegúrese de que su certificado esté vigente y sea emitido por una entidad certificadora
                        autorizada por el SRI.
                    </AlertDescription>
                </Alert>

                {/* Lista de certificados */}
                <div className="grid gap-6">
                    {certificados.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No hay certificados configurados</h3>
                                <p className="text-gray-600 mb-4">
                                    Necesita cargar un certificado digital para poder emitir facturas electrónicas
                                </p>
                                <Button onClick={() => setMostrarFormulario(true)}>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Cargar Primer Certificado
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        certificados.map((certificado) => {
                            const diasVencimiento = diasParaVencimiento(certificado.fechaVencimiento)
                            const proximoVencimiento = diasVencimiento <= 30

                            return (
                                <Card key={certificado.id} className={proximoVencimiento ? "border-orange-200 bg-orange-50" : ""}>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Shield className="h-6 w-6 text-blue-600" />
                                                <div>
                                                    <CardTitle className="text-lg">{certificado.titular}</CardTitle>
                                                    <div className="flex items-center gap-2">
                                                        <CardDescription>RUC: {certificado.ruc}</CardDescription>
                                                        {certificado.ruc === "No detectado" && (
                                                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[10px] py-0">
                                                                RUC no extraído
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={certificado.estado === "activo" ? "default" : "destructive"}>
                                                    {certificado.estado}
                                                </Badge>
                                                {proximoVencimiento && <Badge variant="destructive">Vence en {diasVencimiento} días</Badge>}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-gray-500" />
                                                <div>
                                                    <p className="text-sm text-gray-600">Titular</p>
                                                    <p className="font-medium">{certificado.titular}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Building className="h-4 w-4 text-gray-500" />
                                                <div>
                                                    <p className="text-sm text-gray-600">RUC</p>
                                                    <p className="font-medium">{certificado.ruc}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-gray-500" />
                                                <div>
                                                    <p className="text-sm text-gray-600">Fecha de carga</p>
                                                    <p className="font-medium">{formatearFecha(certificado.fechaCarga)}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-gray-500" />
                                                <div>
                                                    <p className="text-sm text-gray-600">Vencimiento</p>
                                                    <p className={`font-medium ${proximoVencimiento ? "text-red-600" : ""}`}>
                                                        {formatearFecha(certificado.fechaVencimiento)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {certificado.ruc === "No detectado" && (
                                            <Alert className="mb-4 py-2 border-orange-100 bg-orange-50/50">
                                                <AlertCircle className="h-4 w-4 text-orange-600" />
                                                <AlertDescription className="text-xs text-orange-800">
                                                    <strong>Nota:</strong> No logramos extraer el RUC automáticamente de este certificado.
                                                    Asegúrese de que el RUC configurado en la <strong>"Configuración SRI"</strong> coincida con el de este certificado.
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <div className="bg-gray-50 p-3 rounded-lg mb-4">
                                            <p className="text-sm text-gray-600">Huella digital</p>
                                            <p className="font-mono text-xs break-all">{certificado.huella}</p>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => descargarCertificado(certificado)}>
                                                <Download className="h-4 w-4 mr-1" />
                                                Descargar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => eliminarCertificado(certificado.id)}
                                                className="text-red-600 hover:text-red-700"
                                                style={{ marginLeft: "auto" }} // Example cleanup
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Eliminar
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>

                {/* Modal de carga de certificado */}
                {mostrarFormulario && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <Card className="w-full max-w-md">
                            <CardHeader>
                                <CardTitle>Cargar Certificado Digital</CardTitle>
                                <CardDescription>Suba su archivo .p12 o .pfx con la contraseña correspondiente</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="archivo">Archivo de Certificado (.p12 / .pfx)</Label>
                                    <Input
                                        id="archivo"
                                        type="file"
                                        accept=".p12,.pfx"
                                        onChange={handleArchivoChange}
                                        className={errores.archivo ? "border-red-500" : ""}
                                    />
                                    {errores.archivo && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4" />
                                            {errores.archivo}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Contraseña del Certificado</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={mostrarPassword ? "text" : "password"}
                                            placeholder="Ingrese la contraseña"
                                            value={formulario.password}
                                            onChange={(e) => setFormulario((prev) => ({ ...prev, password: e.target.value }))}
                                            className={errores.password ? "border-red-500" : ""}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3"
                                            onClick={() => setMostrarPassword(!mostrarPassword)}
                                        >
                                            {mostrarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    {errores.password && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4" />
                                            {errores.password}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmarPassword">Confirmar Contraseña</Label>
                                    <Input
                                        id="confirmarPassword"
                                        type="password"
                                        placeholder="Confirme la contraseña"
                                        value={formulario.confirmarPassword}
                                        onChange={(e) => setFormulario((prev) => ({ ...prev, confirmarPassword: e.target.value }))}
                                        className={errores.confirmarPassword ? "border-red-500" : ""}
                                    />
                                    {errores.confirmarPassword && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4" />
                                            {errores.confirmarPassword}
                                        </p>
                                    )}
                                </div>

                                <Alert>
                                    <Shield className="h-4 w-4" />
                                    <AlertDescription>
                                        Su contraseña se almacena de forma segura y encriptada. Solo se usa para firmar documentos.
                                    </AlertDescription>
                                </Alert>

                                <div className="flex gap-2 pt-4">
                                    <Button onClick={subirCertificado} disabled={cargandoCertificado} className="flex-1">
                                        {cargandoCertificado ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                Validando...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-4 w-4 mr-2" />
                                                TEST UPLOAD API
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setMostrarFormulario(false)
                                            setFormulario({ archivo: null, password: "", confirmarPassword: "" })
                                            setErrores({})
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    )
}
