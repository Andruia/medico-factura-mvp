"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Stethoscope, FileText, QrCode, Shield, Users, ArrowRight, CheckCircle, Clock, Globe } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">MedicoFactura</h1>
                <p className="text-sm text-gray-600">Facturación Electrónica Médica</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/medico/login">
                <Button variant="outline">Médicos</Button>
              </Link>
              <Link href="/facturador/login">
                <Button>Facturadores</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="secondary">
            <Globe className="h-4 w-4 mr-2" />
            Integrado con SRI Ecuador
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Facturación Electrónica
            <span className="text-blue-600 block">para Médicos</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Sistema completo de facturación electrónica diseñado específicamente para consultorios médicos en Ecuador.
            Cumple con todas las normativas del SRI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/medico/login">
              <Button size="lg" className="w-full sm:w-auto">
                <Stethoscope className="h-5 w-5 mr-2" />
                Acceso Médicos
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href="/paciente/seleccionar-medico">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <Users className="h-5 w-5 mr-2" />
                Soy Paciente
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <QrCode className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Código QR Unificado</CardTitle>
              <CardDescription>
                Un solo QR para todos los servicios de tu consultorio. Los pacientes escanean y completan sus datos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Generación automática
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Múltiples servicios
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Fácil impresión
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Facturación SRI</CardTitle>
              <CardDescription>
                Genera facturas electrónicas válidas que cumplen con todas las normativas del SRI Ecuador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  XML firmado digitalmente
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Envío automático al SRI
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Autorización en tiempo real
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Certificados Digitales</CardTitle>
              <CardDescription>
                Gestión segura de certificados digitales para firma electrónica de documentos tributarios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Almacenamiento seguro
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Múltiples certificados
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Alertas de vencimiento
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Process Flow */}
        <div className="bg-white rounded-2xl p-8 shadow-lg mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">¿Cómo Funciona?</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Paciente Escanea QR</h3>
              <p className="text-gray-600 text-sm">El paciente escanea el código QR del consultorio</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Completa Datos</h3>
              <p className="text-gray-600 text-sm">Ingresa sus datos personales y selecciona el servicio</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Médico Valida</h3>
              <p className="text-gray-600 text-sm">El médico revisa y valida la información del paciente</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="font-semibold mb-2">Factura Automática</h3>
              <p className="text-gray-600 text-sm">Se genera y envía la factura electrónica al SRI</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">100%</div>
            <p className="text-gray-600">Cumplimiento SRI</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">
              <Clock className="h-10 w-10 mx-auto mb-2" />
              2min
            </div>
            <p className="text-gray-600">Tiempo promedio de facturación</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">24/7</div>
            <p className="text-gray-600">Disponibilidad del sistema</p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-blue-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">¿Listo para Digitalizar tu Consultorio?</h2>
          <p className="text-xl mb-8 opacity-90">Únete a los médicos que ya están usando facturación electrónica</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/medico/configuracion-inicial">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Configurar Consultorio
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href="/paciente/seleccionar-medico">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto bg-transparent border-white text-white hover:bg-white hover:text-blue-600"
              >
                Ver Demo como Paciente
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Stethoscope className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold">MedicoFactura</h3>
                  <p className="text-sm text-gray-400">Facturación Médica</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                Sistema de facturación electrónica diseñado específicamente para el sector médico en Ecuador.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Médicos</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link href="/medico/login" className="hover:text-white">
                    Iniciar Sesión
                  </Link>
                </li>
                <li>
                  <Link href="/medico/configuracion-inicial" className="hover:text-white">
                    Configuración Inicial
                  </Link>
                </li>
                <li>
                  <Link href="/medico/servicios" className="hover:text-white">
                    Gestionar Servicios
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Pacientes</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link href="/paciente/seleccionar-medico" className="hover:text-white">
                    Buscar Médico
                  </Link>
                </li>
                <li>
                  <Link href="/paciente/formulario" className="hover:text-white">
                    Completar Datos
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Soporte</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Documentación
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contacto
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    SRI Ecuador
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2024 MedicoFactura. Sistema de facturación electrónica para médicos en Ecuador.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
