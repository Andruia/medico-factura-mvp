"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { QrCode, Download, Share, Copy } from "lucide-react"
import Link from "next/link"

export default function GenerarQR() {
  const [qrConfig, setQrConfig] = useState({
    nombre: "QR Principal Consultorio",
    tipo: "permanente",
    duracion: "ilimitado",
    usos: "ilimitado",
  })
  const [qrGenerado, setQrGenerado] = useState(false)
  const [qrUrl, setQrUrl] = useState("")

  const handleGenerar = () => {
    // Simular generación de QR
    const baseUrl = window.location.origin
    const qrId = Math.random().toString(36).substring(7)
    const url = `${baseUrl}/paciente/seleccionar-medico?qr=${qrId}`
    setQrUrl(url)
    setQrGenerado(true)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrUrl)
    alert("URL copiada al portapapeles")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/medico/dashboard" className="text-blue-600 hover:underline">
            ← Volver al Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Generar Código QR</h1>
          <p className="text-gray-600">Crea un código QR unificado para tu consultorio</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Configuración */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración del QR</CardTitle>
              <CardDescription>Personaliza las opciones de tu código QR unificado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del QR</Label>
                <Input
                  id="nombre"
                  value={qrConfig.nombre}
                  onChange={(e) => setQrConfig({ ...qrConfig, nombre: e.target.value })}
                  placeholder="Ej: QR Principal Consultorio"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de QR</Label>
                <Select value={qrConfig.tipo} onValueChange={(value) => setQrConfig({ ...qrConfig, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanente">Permanente</SelectItem>
                    <SelectItem value="temporal">Temporal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {qrConfig.tipo === "temporal" && (
                <div className="space-y-2">
                  <Label>Duración</Label>
                  <Select
                    value={qrConfig.duracion}
                    onValueChange={(value) => setQrConfig({ ...qrConfig, duracion: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 hora</SelectItem>
                      <SelectItem value="4h">4 horas</SelectItem>
                      <SelectItem value="8h">8 horas</SelectItem>
                      <SelectItem value="24h">24 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Límite de usos</Label>
                <Select value={qrConfig.usos} onValueChange={(value) => setQrConfig({ ...qrConfig, usos: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ilimitado">Ilimitado</SelectItem>
                    <SelectItem value="10">10 usos</SelectItem>
                    <SelectItem value="50">50 usos</SelectItem>
                    <SelectItem value="100">100 usos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <QrCode className="h-4 w-4" />
                <AlertDescription>
                  Este QR permitirá a los pacientes seleccionar cualquier médico de tu consultorio
                </AlertDescription>
              </Alert>

              <Button onClick={handleGenerar} className="w-full" disabled={qrGenerado}>
                <QrCode className="h-4 w-4 mr-2" />
                {qrGenerado ? "QR Generado" : "Generar QR"}
              </Button>
            </CardContent>
          </Card>

          {/* Resultado */}
          <Card>
            <CardHeader>
              <CardTitle>Código QR Generado</CardTitle>
              <CardDescription>Tu código QR unificado está listo para usar</CardDescription>
            </CardHeader>
            <CardContent>
              {qrGenerado ? (
                <div className="space-y-4">
                  {/* QR Code Placeholder */}
                  <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <QrCode className="h-32 w-32 mx-auto text-gray-400 mb-4" />
                    <p className="text-sm text-gray-600">Código QR Unificado</p>
                    <p className="text-xs text-gray-500 mt-2">{qrConfig.nombre}</p>
                  </div>

                  {/* URL */}
                  <div className="space-y-2">
                    <Label>URL del QR</Label>
                    <div className="flex gap-2">
                      <Input value={qrUrl} readOnly className="text-xs" />
                      <Button size="sm" variant="outline" onClick={copyToClipboard}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Descargar PNG
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Share className="h-4 w-4 mr-2" />
                      Compartir
                    </Button>
                  </div>

                  {/* Test Link */}
                  <Alert>
                    <AlertDescription>
                      <Link href={`/paciente/seleccionar-medico?qr=demo`} className="text-blue-600 hover:underline">
                        Probar QR como paciente →
                      </Link>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <QrCode className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Configure las opciones y genere su QR</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
