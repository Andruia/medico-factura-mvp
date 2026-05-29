import { XMLGenerator } from "./xml-generator"
import { CertificateManager } from "./certificate-manager"
import type { FacturaElectronica, ConfiguracionSRI } from "./types"

interface SRIResponse {
  success: boolean
  claveAcceso?: string
  numeroAutorizacion?: string
  fechaAutorizacion?: Date
  estado?: string
  mensajes?: string[]
  xml?: string
  error?: string
}

export class SRIClient {
  public static readonly ENDPOINTS = {
    pruebas: {
      recepcion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
      autorizacion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
    },
    produccion: {
      recepcion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
      autorizacion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
    },
  }

  static async enviarComprobante(
    factura: FacturaElectronica,
    configuracion: ConfiguracionSRI,
    certificado: { archivo: string, password: string },
  ): Promise<SRIResponse> {
    try {
      // 1. Generar XML
      const xml = XMLGenerator.generateFacturaXML(factura)

      // 2. Firmar XML
      // Nota: El archivo certificado viene en base64 en certificado.archivo
      const firmaResult = await CertificateManager.signXML(xml, certificado.archivo, certificado.password)

      if (!firmaResult.success) {
        return {
          success: false,
          error: `Error firmando XML: ${firmaResult.error}`,
        }
      }

      // 3. Enviar a SRI (vía Proxy API route para evitar CORS y manejar SOAP)
      const endpoint = this.ENDPOINTS[configuracion.ambiente].recepcion

      console.log(`📤 Enviando comprobante a SRI (${configuracion.ambiente})...`)

      const response = await this.enviarASRIReal(firmaResult.signedXML!, endpoint)
      return response

    } catch (error) {
      console.error("Error en enviarComprobante:", error)
      return {
        success: false,
        error: `Error procesando comprobante: ${(error as Error).message}`,
      }
    }
  }

  static async consultarAutorizacion(claveAcceso: string, configuracion: ConfiguracionSRI): Promise<SRIResponse> {
    try {
      const endpoint = this.ENDPOINTS[configuracion.ambiente].autorizacion
      console.log(`🔍 Consultando autorización para: ${claveAcceso}`)

      return await this.consultarSRIReal(claveAcceso, endpoint)
    } catch (error) {
      return {
        success: false,
        error: `Error consultando autorización: ${(error as Error).message}`,
      }
    }
  }

  // --- MÉTODOS PRIVADOS DE CONEXIÓN ---

  static async enviarASRIReal(xml: string, endpoint: string): Promise<SRIResponse> {
    try {
      // Llamada a nuestro propio endpoint de API que actúa como proxy SOAP
      const response = await fetch("/api/sri/enviar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          xml,
          endpoint,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error("Error connecting to /api/sri/enviar", error)
      return {
        success: false,
        error: `Error de conexión con SRI: ${(error as Error).message}`,
      }
    }
  }

  private static async consultarSRIReal(claveAcceso: string, endpoint: string): Promise<SRIResponse> {
    try {
      const response = await fetch("/api/sri/consultar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claveAcceso,
          endpoint,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      return {
        success: false,
        error: `Error consultando SRI: ${(error as Error).message}`,
      }
    }
  }

  // Mantenemos la generación de estructuras de datos igual
  static generarFacturaElectronica(solicitudFacturacion: any, configuracion: ConfiguracionSRI): FacturaElectronica {
    const fechaEmision = new Date()
    const secuencial = this.generarSecuencial()
    const claveAcceso = XMLGenerator.generateClaveAcceso(
      fechaEmision,
      "01", // Factura
      configuracion.ruc,
      configuracion.ambiente === "pruebas" ? 1 : 2,
      configuracion.establecimiento || "001", // Serie Estab
      configuracion.puntoEmision || "001", // Serie PtoEmi
      secuencial,
      "12345678",
      1,
    )

    const subtotal = Number(solicitudFacturacion.servicio.precio)
    const ivaPorcentaje = Number(solicitudFacturacion.servicio.iva || 0)
    const iva = (subtotal * ivaPorcentaje) / 100
    const total = subtotal + iva

    return {
      infoTributaria: {
        ambiente: configuracion.ambiente === "pruebas" ? 1 : 2,
        tipoEmision: 1,
        razonSocial: configuracion.razonSocial,
        nombreComercial: configuracion.nombreComercial,
        ruc: configuracion.ruc,
        claveAcceso,
        codDoc: "01", // Factura
        estab: configuracion.establecimiento || "001",
        ptoEmi: configuracion.puntoEmision || "001",
        secuencial,
        dirMatriz: configuracion.direccionMatriz,
      },
      infoFactura: {
        fechaEmision: fechaEmision.toISOString().split("T")[0].replace(/-/g, "/"), // dd/mm/aaaa
        dirEstablecimiento: configuracion.direccionMatriz, // Idealmente dir sucursal
        contribuyenteEspecial: configuracion.contribuyenteEspecial,
        obligadoContabilidad: configuracion.obligadoContabilidad ? "SI" : "NO",
        tipoIdentificacionComprador: solicitudFacturacion.paciente.tipoIdentificacion === "cedula" ? "05" : "04", // 05 Cédula, 04 RUC, 06 Pasaporte
        razonSocialComprador: `${solicitudFacturacion.paciente.nombres} ${solicitudFacturacion.paciente.apellidos}`.trim(),
        identificacionComprador: solicitudFacturacion.paciente.numeroIdentificacion,
        direccionComprador: solicitudFacturacion.paciente.direccion || "S/D",
        totalSinImpuestos: subtotal,
        totalDescuento: 0,
        importeTotal: total,
        moneda: "DOLAR",
        pagos: [
          {
            formaPago: "01", // Sin utilización del sistema financiero
            total: total,
          },
        ],
      },
      detalles: [
        {
          codigoPrincipal: solicitudFacturacion.servicio.codigo || "SERV-001",
          descripcion: solicitudFacturacion.servicio.nombre,
          cantidad: 1,
          precioUnitario: subtotal,
          descuento: 0,
          precioTotalSinImpuesto: subtotal,
          impuestos: [
            {
              codigo: "2", // IVA
              codigoPorcentaje: ivaPorcentaje === 0 ? "0" : (ivaPorcentaje === 12 ? "2" : (ivaPorcentaje === 15 ? "4" : "0")), // Ajustar tabla SRI 2024 (15%)
              tarifa: ivaPorcentaje,
              baseImponible: subtotal,
              valor: iva,
            },
          ],
        },
      ],
      infoAdicional: [
        {
          nombre: "Médico",
          valor: solicitudFacturacion.medico.nombre,
        },
        {
          nombre: "Email",
          valor: solicitudFacturacion.paciente.email || "sin@email.com",
        },
      ],
    }
  }

  private static generarSecuencial(): string {
    // TODO: Obtener ultimo secuencial de DB
    const numero = Math.floor(Math.random() * 999999) + 1
    return numero.toString().padStart(9, "0")
  }
}
