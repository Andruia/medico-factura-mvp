"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Download, TrendingUp, Users, DollarSign, FileText, Calendar } from "lucide-react"
import Link from "next/link"

interface ReporteData {
  periodo: string
  pacientesAtendidos: number
  facturasGeneradas: number
  ingresosTotales: number
  servicioMasUsado: string
  promedioFactura: number
  crecimiento: number
}

interface ServicioReporte {
  nombre: string
  cantidad: number
  ingresos: number
  porcentaje: number
}

export default function ReportesMedico() {
  const [periodo, setPeriodo] = useState("mes")
  const [reporteData, setReporteData] = useState<ReporteData | null>(null)
  const [serviciosReporte, setServiciosReporte] = useState<ServicioReporte[]>([])
  const [medico, setMedico] = useState<any>(null)

  useEffect(() => {
    const session = localStorage.getItem("medico-session")
    if (session) {
      setMedico(JSON.parse(session))
    }
    generarReporte()
  }, [periodo])

  const generarReporte = () => {
    // Simular datos de reporte basados en el período seleccionado
    const reportesSimulados = {
      semana: {
        periodo: "Última Semana",
        pacientesAtendidos: 12,
        facturasGeneradas: 10,
        ingresosTotales: 420.0,
        servicioMasUsado: "Consulta Cardiológica",
        promedioFactura: 42.0,
        crecimiento: 15,
      },
      mes: {
        periodo: "Último Mes",
        pacientesAtendidos: 48,
        facturasGeneradas: 42,
        ingresosTotales: 1680.0,
        servicioMasUsado: "Consulta Cardiológica",
        promedioFactura: 40.0,
        crecimiento: 22,
      },
      trimestre: {
        periodo: "Último Trimestre",
        pacientesAtendidos: 144,
        facturasGeneradas: 128,
        ingresosTotales: 5120.0,
        servicioMasUsado: "Consulta Cardiológica",
        promedioFactura: 40.0,
        crecimiento: 18,
      },
    }

    const serviciosSimulados = {
      semana: [
        { nombre: "Consulta Cardiológica", cantidad: 8, ingresos: 360.0, porcentaje: 85.7 },
        { nombre: "Electrocardiograma", cantidad: 2, ingresos: 60.0, porcentaje: 14.3 },
      ],
      mes: [
        { nombre: "Consulta Cardiológica", cantidad: 28, ingresos: 1260.0, porcentaje: 75.0 },
        { nombre: "Electrocardiograma", cantidad: 12, ingresos: 300.0, porcentaje: 17.9 },
        { nombre: "Ecocardiograma", cantidad: 2, ingresos: 120.0, porcentaje: 7.1 },
      ],
      trimestre: [
        { nombre: "Consulta Cardiológica", cantidad: 85, ingresos: 3825.0, porcentaje: 74.7 },
        { nombre: "Electrocardiograma", cantidad: 35, ingresos: 875.0, porcentaje: 17.1 },
        { nombre: "Ecocardiograma", cantidad: 8, ingresos: 420.0, porcentaje: 8.2 },
      ],
    }

    setReporteData(reportesSimulados[periodo as keyof typeof reportesSimulados])
    setServiciosReporte(serviciosSimulados[periodo as keyof typeof serviciosSimulados])
  }

  const exportarReporte = () => {
    // Simular exportación de reporte
    const csvContent = `Reporte Médico - ${reporteData?.periodo}
Pacientes Atendidos,${reporteData?.pacientesAtendidos}
Facturas Generadas,${reporteData?.facturasGeneradas}
Ingresos Totales,$${reporteData?.ingresosTotales}
Promedio por Factura,$${reporteData?.promedioFactura}

Servicios:
${serviciosReporte.map((s) => `${s.nombre},${s.cantidad},$${s.ingresos}`).join("\n")}`

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reporte-${periodo}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  if (!reporteData) return <div>Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/medico/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reportes y Analytics</h1>
                <p className="text-gray-600">Análisis de su práctica médica</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Última Semana</SelectItem>
                  <SelectItem value="mes">Último Mes</SelectItem>
                  <SelectItem value="trimestre">Último Trimestre</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportarReporte}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Métricas Principales */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pacientes Atendidos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reporteData.pacientesAtendidos}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+{reporteData.crecimiento}%</span> vs período anterior
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facturas Generadas</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reporteData.facturasGeneradas}</div>
              <p className="text-xs text-muted-foreground">
                {((reporteData.facturasGeneradas / reporteData.pacientesAtendidos) * 100).toFixed(1)}% tasa de
                facturación
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${reporteData.ingresosTotales.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Promedio: ${reporteData.promedioFactura.toFixed(2)} por factura
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Crecimiento</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+{reporteData.crecimiento}%</div>
              <p className="text-xs text-muted-foreground">Comparado con período anterior</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Servicios Más Utilizados */}
          <Card>
            <CardHeader>
              <CardTitle>Servicios Más Utilizados</CardTitle>
              <CardDescription>Análisis de servicios por {reporteData.periodo.toLowerCase()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {serviciosReporte.map((servicio, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">{servicio.nombre}</h3>
                    <p className="text-sm text-gray-600">{servicio.cantidad} consultas</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${servicio.porcentaje}%` }}></div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold">${servicio.ingresos.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">{servicio.porcentaje.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tendencias y Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Insights y Recomendaciones</CardTitle>
              <CardDescription>Análisis inteligente de su práctica</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2">📈 Crecimiento Positivo</h3>
                <p className="text-sm text-green-800">
                  Sus ingresos han crecido un {reporteData.crecimiento}% comparado con el período anterior. ¡Excelente
                  trabajo!
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">🎯 Servicio Principal</h3>
                <p className="text-sm text-blue-800">
                  "{reporteData.servicioMasUsado}" representa el {serviciosReporte[0]?.porcentaje.toFixed(1)}% de sus
                  ingresos. Considere optimizar este servicio.
                </p>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-medium text-yellow-900 mb-2">💡 Oportunidad</h3>
                <p className="text-sm text-yellow-800">
                  Su tasa de facturación es del{" "}
                  {((reporteData.facturasGeneradas / reporteData.pacientesAtendidos) * 100).toFixed(1)}%. Considere
                  revisar pacientes sin facturar.
                </p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-medium text-purple-900 mb-2">📊 Promedio</h3>
                <p className="text-sm text-purple-800">
                  Su factura promedio es ${reporteData.promedioFactura.toFixed(2)}, lo cual está dentro del rango
                  esperado para su especialidad.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumen del Período */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Resumen del Período: {reporteData.periodo}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{reporteData.pacientesAtendidos}</div>
                <p className="text-gray-600">Pacientes Únicos</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">${reporteData.ingresosTotales.toFixed(2)}</div>
                <p className="text-gray-600">Ingresos Totales</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {((reporteData.facturasGeneradas / reporteData.pacientesAtendidos) * 100).toFixed(1)}%
                </div>
                <p className="text-gray-600">Eficiencia de Facturación</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
