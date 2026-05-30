/**
 * background-processor.ts
 * 
 * Procesador asíncrono de facturas electrónicas.
 * Invocado periódicamente por el Cron endpoint (app/api/cron/process-sri/route.ts).
 * 
 * Refactorizado para usar FiscalAdapter (API externa NestJS) en lugar de
 * firma XAdES local + envío SOAP directo al SRI.
 * 
 * Feature flag: FISCAL_USE_EXTERNAL_API
 *   - true (default): usa FiscalAdapter → API externa → SRI
 *   - false: fallback a lógica legacy (firma local + SOAP directo)
 * 
 * Flujo:
 *   1. sendPendingInvoices: PENDIENTE_ENVIO → FiscalMapper → FiscalAdapter → actualiza DB
 *   2. checkReceivedInvoices: RECIBIDO_SRI → FiscalAdapter.consultarAutorizacion → actualiza DB
 * 
 * @module background-processor
 */

import { prisma } from "@/lib/prisma"
import { FiscalAdapter } from "./fiscal-adapter"
import { mapFacturaToApiPayload, MappingValidationError } from "./fiscal-mapper"
import { getFiscalFeatureFlags } from "@/lib/config/fiscal-config"
import type { FacturaConRelaciones, MedicoProfileData, FiscalAdapterResult } from "./fiscal-types"

// ============================================================================
// Constants
// ============================================================================

const BATCH_SIZE = 3           // Facturas por ciclo (serverless-friendly)
const MAX_RETRY_COUNT = 10     // Máximo de reintentos antes de RECHAZADO definitivo

// ============================================================================
// BackgroundProcessor
// ============================================================================

export class BackgroundProcessor {
  /**
   * Procesa lotes de facturas pendientes y consulta estado de las recibidas.
   * Método público invocado por el Cron Job externo.
   */
  static async processAllPending(): Promise<{
    processedCount: number
    errors: string[]
    meta?: Record<string, unknown>
  }> {
    const errors: string[] = []
    let processedCount = 0
    const startTime = Date.now()

    const flags = getFiscalFeatureFlags()

    try {
      console.log(`[Processor] Iniciando ciclo de procesamiento (useFiscalAPI: ${flags.useFiscalAPI})...`)

      // 1. Enviar facturas PENDIENTES
      const sentCount = await this.sendPendingInvoices(errors)
      processedCount += sentCount

      // 2. Consultar autorizaciones para facturas RECIBIDAS
      const authorizedCount = await this.checkReceivedInvoices(errors)
      processedCount += authorizedCount

    } catch (error: any) {
      console.error("[Processor] Error crítico:", error.message)
      errors.push(error.message)
    }

    const elapsedMs = Date.now() - startTime
    console.log(`[Processor] Ciclo completado en ${elapsedMs}ms. Procesadas: ${processedCount}, Errores: ${errors.length}`)

    return {
      processedCount,
      errors,
      meta: {
        elapsedMs,
        useFiscalAPI: flags.useFiscalAPI,
        circuitBreaker: FiscalAdapter.getCircuitBreakerStatus(),
      },
    }
  }

  /**
   * Toma facturas en PENDIENTE_ENVIO, las bloquea con FOR UPDATE SKIP LOCKED,
   * las mapea al payload de la API fiscal y las envía.
   */
  private static async sendPendingInvoices(errors: string[]): Promise<number> {
    let count = 0

    // Obtener lote de facturas con pessimistic locking
    const lockedIds = await this.lockPendingInvoices()

    if (lockedIds.length === 0) return 0

    console.log(`[Processor] Enviando ${lockedIds.length} facturas pendientes...`)

    for (const facturaId of lockedIds) {
      try {
        // Cargar factura con todas las relaciones
        const factura = await this.loadFacturaWithRelations(facturaId)
        if (!factura) continue

        const medico = this.extractMedicoProfile(factura)
        if (!medico) {
          throw new Error("Médico no configurado o sin firma electrónica.")
        }

        const flags = getFiscalFeatureFlags()

        if (flags.useFiscalAPI) {
          // --- Flujo nuevo: API fiscal externa ---
          await this.processViaFiscalAPI(factura, medico)
        } else {
          // --- Flujo legacy: firma local + SOAP (mantener para rollback) ---
          await this.processViaLegacy(factura, medico)
        }

        count++

      } catch (error: any) {
        console.error(`[Processor] Error enviando factura ${facturaId}:`, error.message)
        errors.push(`Envío Factura ${facturaId}: ${error.message}`)

        // Determinar si es un error de validación (terminal) o transitorio
        const isValidationError = error instanceof MappingValidationError
        const newEstado = isValidationError ? "RECHAZADO" : "PENDIENTE_ENVIO"

        await prisma.factura.update({
          where: { id: facturaId },
          data: {
            estado: newEstado,
            mensajeError: `${isValidationError ? "Validación fallida" : "Error de envío"}: ${error.message}`.slice(0, 500),
          },
        }).catch((e: any) => console.error(`[Processor] Error actualizando estado:`, e.message))
      }
    }

    return count
  }

  /**
   * Procesa una factura usando la API fiscal externa (nuevo flujo).
   */
  private static async processViaFiscalAPI(
    factura: FacturaConRelaciones,
    medico: MedicoProfileData
  ): Promise<void> {
    // 1. Mapear a payload de la API
    const payload = mapFacturaToApiPayload(factura, medico)

    // 2. Enviar a la API fiscal
    const result = await FiscalAdapter.emitirFactura(payload)

    // 3. Actualizar DB según resultado
    await this.updateFacturaFromResult(factura.id, factura.secuencial, result)
  }

  /**
   * Fallback: procesa factura con lógica legacy (firma local + SOAP directo).
   * Se mantiene para zero-downtime rollback via feature flag.
   */
  private static async processViaLegacy(
    factura: FacturaConRelaciones,
    medico: MedicoProfileData
  ): Promise<void> {
    // Import dinámico para no cargar dependencias XAdES cuando no se usan
    const { XMLGenerator } = await import("./xml-generator")
    const { CertificateManager } = await import("./certificate-manager")
    const axios = (await import("axios")).default
    const https = await import("https")

    const httpsAgent = new https.Agent({ rejectUnauthorized: false })

    // Generar y firmar XML (lógica original)
    const xmlSigned = await this.generateAndSignXMLLegacy(
      factura, medico, XMLGenerator, CertificateManager
    )

    // Guardar XML firmado
    await prisma.factura.update({
      where: { id: factura.id },
      data: { xmlPath: xmlSigned },
    })

    // Enviar SOAP al SRI
    const endpointRecepcion = medico.ambiente?.toLowerCase() === "pruebas"
      ? "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline"
      : "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline"

    const xmlBase64 = Buffer.from(xmlSigned).toString("base64")
    const soapEnvelope = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
        <soapenv:Header/>
        <soapenv:Body>
          <ec:validarComprobante>
            <xml>${xmlBase64}</xml>
          </ec:validarComprobante>
        </soapenv:Body>
      </soapenv:Envelope>
    `.trim()

    const response = await axios.post(endpointRecepcion, soapEnvelope, {
      headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "" },
      httpsAgent,
      timeout: 20000,
    })

    const responseData = response.data
    const isReceived = responseData.includes("RECIBIDA")
    const isAlreadyProcessing = responseData.includes("DEVUELTA") && (responseData.includes("70") || responseData.includes("EN PROCESAMIENTO"))
    const isRejected = responseData.includes("DEVUELTA") && !isAlreadyProcessing

    if (isRejected) {
      const mensajeMatch = responseData.match(/<mensaje>([\s\S]*?)<\/mensaje>/)
      const identificadorMatch = responseData.match(/<identificador>([\s\S]*?)<\/identificador>/)
      const identificador = identificadorMatch ? identificadorMatch[1].trim() : ""
      const mensaje = mensajeMatch ? mensajeMatch[1].trim() : "Error de validación SRI"
      throw new Error(identificador ? `Error ${identificador}: ${mensaje}` : mensaje)
    }

    if (isReceived || isAlreadyProcessing) {
      await prisma.factura.update({
        where: { id: factura.id },
        data: {
          estado: "RECIBIDO_SRI",
          mensajeError: isAlreadyProcessing
            ? "Clave ya procesada, esperando autorización..."
            : "Recibido por SRI, esperando autorización...",
        },
      })
      console.log(`[Processor] Factura ${factura.secuencial} enviada (legacy, RECIBIDA).`)
    } else {
      throw new Error("Respuesta de recepción inesperada del SRI.")
    }
  }

  /**
   * Consulta autorización para facturas en RECIBIDO_SRI.
   */
  private static async checkReceivedInvoices(errors: string[]): Promise<number> {
    let count = 0

    const receivedInvoices = await prisma.factura.findMany({
      where: { estado: "RECIBIDO_SRI" },
      orderBy: { updatedAt: "asc" },
      take: BATCH_SIZE,
    })

    if (receivedInvoices.length === 0) return 0

    console.log(`[Processor] Consultando autorización para ${receivedInvoices.length} facturas recibidas...`)

    const flags = getFiscalFeatureFlags()

    for (const factura of receivedInvoices) {
      try {
        if (!factura.claveAcceso) {
          throw new Error("Factura sin clave de acceso, no se puede consultar autorización.")
        }

        if (flags.useFiscalAPI) {
          // --- Flujo nuevo: consultar via API fiscal ---
          const result = await FiscalAdapter.consultarAutorizacion(factura.claveAcceso)
          await this.updateFacturaFromResult(factura.id, factura.secuencial, result)
          if (result.success) count++
        } else {
          // --- Flujo legacy: SOAP directo ---
          const authorized = await this.checkAuthorizationLegacy(factura)
          if (authorized) count++
        }

      } catch (error: any) {
        console.error(`[Processor] Error consultando factura ${factura.id}:`, error.message)
        errors.push(`Consulta Factura ${factura.id}: ${error.message}`)
      }
    }

    return count
  }

  // ============================================================================
  // DB Operations
  // ============================================================================

  /**
   * Bloquea facturas PENDIENTE_ENVIO con FOR UPDATE SKIP LOCKED.
   * Retorna solo los IDs para minimizar la transacción.
   */
  private static async lockPendingInvoices(): Promise<string[]> {
    const lockedFacturas: { id: string }[] = await prisma.$transaction(async (tx) => {
      const pending: { id: string }[] = await tx.$queryRaw`
        SELECT f.id 
        FROM "Factura" f
        WHERE f.estado = 'PENDIENTE_ENVIO'
        ORDER BY f."createdAt" ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `

      if (pending.length === 0) return []

      const ids = pending.map((p) => p.id)

      // Marcar como "EN_PROCESO" transitorio para evitar re-procesamiento
      await tx.factura.updateMany({
        where: { id: { in: ids } },
        data: {
          mensajeError: "Procesando envío al SRI...",
        },
      })

      return pending
    })

    return lockedFacturas.map((f) => f.id)
  }

  /**
   * Carga factura con todas las relaciones necesarias.
   */
  private static async loadFacturaWithRelations(facturaId: string): Promise<FacturaConRelaciones | null> {
    const factura = await prisma.factura.findUnique({
      where: { id: facturaId },
      include: {
        paciente: true,
        items: true,
        formasPago: true,
        infoAdicional: true,
        user: {
          include: {
            medicoProfile: true,
          },
        },
      },
    })

    return factura as FacturaConRelaciones | null
  }

  /**
   * Extrae y valida el perfil del médico desde la factura cargada.
   */
  private static extractMedicoProfile(factura: any): MedicoProfileData | null {
    const medico = factura?.user?.medicoProfile
    if (!medico || !medico.firmaElectronicaPath || !medico.firmaPassword) {
      return null
    }
    return medico as MedicoProfileData
  }

  /**
   * Actualiza la factura en DB según el resultado del FiscalAdapter.
   * Lógica central de decisión de estados.
   */
  private static async updateFacturaFromResult(
    facturaId: string,
    secuencial: string,
    result: FiscalAdapterResult
  ): Promise<void> {
    switch (result.estado) {
      case "AUTORIZADO":
        await prisma.factura.update({
          where: { id: facturaId },
          data: {
            estado: "AUTORIZADO",
            numeroAutorizacion: result.numeroAutorizacion || undefined,
            fechaAutorizacion: result.fechaAutorizacion || new Date(),
            xmlPath: result.xmlAutorizado || undefined,
            mensajeError: null,
          },
        })
        console.log(`[Processor] ✅ Factura ${secuencial} AUTORIZADA`)
        break

      case "RECIBIDO_SRI":
      case "EN_COLA":
        await prisma.factura.update({
          where: { id: facturaId },
          data: {
            estado: "RECIBIDO_SRI",
            claveAcceso: result.claveAcceso || undefined,
            mensajeError: result.mensajes.join(" | ") || "Recibido por SRI, esperando autorización...",
          },
        })
        console.log(`[Processor] 📨 Factura ${secuencial} RECIBIDA por SRI`)
        break

      case "RECHAZADO":
        await prisma.factura.update({
          where: { id: facturaId },
          data: {
            estado: "RECHAZADO",
            mensajeError: result.mensajes.join(" | ") || "Rechazado por el SRI",
          },
        })
        console.log(`[Processor] ❌ Factura ${secuencial} RECHAZADA: ${result.mensajes[0]}`)
        break

      case "ERROR":
        if (result.retriable) {
          // Error transitorio → volver a PENDIENTE para retry en próximo ciclo
          await prisma.factura.update({
            where: { id: facturaId },
            data: {
              estado: "PENDIENTE_ENVIO",
              mensajeError: `Reintentando: ${result.mensajes.join(", ")}`.slice(0, 500),
            },
          })
          console.log(`[Processor] 🔄 Factura ${secuencial} volverá a intentarse: ${result.mensajes[0]}`)
        } else {
          await prisma.factura.update({
            where: { id: facturaId },
            data: {
              estado: "RECHAZADO",
              mensajeError: result.mensajes.join(" | ") || "Error no recuperable",
            },
          })
          console.log(`[Processor] ❌ Factura ${secuencial} ERROR terminal: ${result.mensajes[0]}`)
        }
        break
    }
  }

  // ============================================================================
  // Legacy helpers (solo cuando FISCAL_USE_EXTERNAL_API=false)
  // ============================================================================

  /**
   * Consulta autorización legacy via SOAP directo.
   */
  private static async checkAuthorizationLegacy(factura: any): Promise<boolean> {
    const medico = await prisma.medicoProfile.findFirst({
      where: { userId: factura.userId },
    })

    if (!medico) throw new Error("Médico no configurado.")

    const axios = (await import("axios")).default
    const https = await import("https")
    const httpsAgent = new https.Agent({ rejectUnauthorized: false })

    const endpointAutorizacion = medico.ambiente?.toLowerCase() === "pruebas"
      ? "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"
      : "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"

    const soapAuthEnvelope = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
        <soapenv:Header/>
        <soapenv:Body>
          <ec:autorizacionComprobante>
            <claveAccesoComprobante>${factura.claveAcceso}</claveAccesoComprobante>
          </ec:autorizacionComprobante>
        </soapenv:Body>
      </soapenv:Envelope>
    `.trim()

    const authResponse = await axios.post(endpointAutorizacion, soapAuthEnvelope, {
      headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "" },
      httpsAgent,
      timeout: 15000,
    })

    const authData = authResponse.data

    if (authData.includes("<estado>AUTORIZADO</estado>")) {
      const matchNum = authData.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/)
      const matchFecha = authData.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/)

      await prisma.factura.update({
        where: { id: factura.id },
        data: {
          estado: "AUTORIZADO",
          numeroAutorizacion: matchNum ? matchNum[1] : (factura.claveAcceso || ""),
          fechaAutorizacion: matchFecha ? new Date(matchFecha[1]) : new Date(),
          mensajeError: null,
        },
      })
      console.log(`[Processor] Factura ${factura.secuencial} AUTORIZADA (legacy).`)
      return true

    } else if (authData.includes("<estado>RECHAZADO</estado>") || authData.includes("<estado>NO AUTORIZADO</estado>")) {
      const mensajes = authData.match(/<mensaje>([\s\S]*?)<\/mensaje>/g)
      const errorMsg = mensajes
        ? mensajes.map((m: string) => m.replace(/<[^>]*>?/gm, "").trim()).join(" | ")
        : "Rechazada por SRI en autorización"

      await prisma.factura.update({
        where: { id: factura.id },
        data: {
          estado: "RECHAZADO",
          mensajeError: `Autorización falló: ${errorMsg}`,
        },
      })
      console.log(`[Processor] Factura ${factura.secuencial} RECHAZADA (legacy).`)
      return false

    } else {
      console.log(`[Processor] Factura ${factura.secuencial} sigue en procesamiento en el SRI...`)
      return false
    }
  }

  /**
   * Legacy: genera y firma XML con XAdES (lógica original de generateAndSignXML).
   */
  private static async generateAndSignXMLLegacy(
    factura: any,
    medico: any,
    XMLGenerator: any,
    CertificateManager: any,
  ): Promise<string> {
    const impuestosTotalizados = new Map<string, { baseImponible: number; valor: number }>()

    factura.items.forEach((item: any) => {
      const tarifa = item.ivaTarifa !== undefined ? parseInt(item.ivaTarifa) : 12
      const codigoPorcentaje = tarifa === 0 ? "0" : (tarifa === 15 ? "4" : "2")
      const base = (Number(item.cantidad) * Number(item.precioUnitario)) - Number(item.descuento || 0)
      const impuesto = base * (tarifa / 100)

      const current = impuestosTotalizados.get(codigoPorcentaje) || { baseImponible: 0, valor: 0 }
      impuestosTotalizados.set(codigoPorcentaje, {
        baseImponible: current.baseImponible + base,
        valor: current.valor + impuesto,
      })
    })

    const totalImpuestosArray = Array.from(impuestosTotalizados.entries()).map(([codigoPorcentaje, val]) => ({
      codigo: "2" as "2",
      codigoPorcentaje: codigoPorcentaje as "0" | "2" | "3" | "4",
      baseImponible: Number(val.baseImponible.toFixed(2)),
      tarifa: codigoPorcentaje === "0" ? 0 : (codigoPorcentaje === "4" ? 15 : 12),
      valor: Number(val.valor.toFixed(2)),
    }))

    const pagosArray = factura.formasPago.map((p: any) => {
      const pago: any = { formaPago: p.codigo, total: Number(p.total) }
      if (p.plazo && Number(p.plazo) > 0) {
        pago.plazo = Number(p.plazo)
        pago.unidadTiempo = p.unidadTiempo || "Dias"
      }
      return pago
    })

    const infoAdicionalArray = factura.infoAdicional.map((ia: any) => ({
      nombre: ia.nombre.trim(),
      valor: ia.valor.trim(),
    }))

    const facturaElectronica = {
      infoTributaria: {
        ambiente: (medico.ambiente?.toLowerCase() === "pruebas" ? "1" : "2") as "1" | "2",
        tipoEmision: "1" as "1",
        razonSocial: medico.nombreComercial || "Medico",
        nombreComercial: medico.nombreComercial || undefined,
        ruc: medico.ruc!,
        claveAcceso: factura.claveAcceso!,
        codDoc: "01" as "01",
        estab: medico.establecimiento || "001",
        ptoEmi: medico.puntoEmision || "001",
        secuencial: factura.secuencial,
        dirMatriz: medico.direccion || "Matriz",
      },
      infoFactura: {
        fechaEmision: factura.fechaEmision.toLocaleDateString("es-EC", {
          day: "2-digit", month: "2-digit", year: "numeric",
        }),
        dirEstablecimiento: medico.direccion || "Matriz",
        obligadoContabilidad: medico.obligadoContabilidad ? "SI" as "SI" : "NO" as "NO",
        tipoIdentificacionComprador: (factura.paciente.tipoIdentificacion === "cedula" ? "05" : "04") as "04" | "05",
        razonSocialComprador: factura.paciente.razonSocial,
        identificacionComprador: factura.paciente.numeroIdentificacion,
        totalSinImpuestos: Number(factura.subtotal),
        totalDescuento: Number(factura.items.reduce((acc: number, cur: any) => acc + Number(cur.descuento || 0), 0)),
        totalImpuestos: totalImpuestosArray,
        importeTotal: Number(factura.total),
        moneda: "DOLAR" as "DOLAR",
        pagos: pagosArray,
      },
      detalles: factura.items.map((item: any) => {
        const tarifa = item.ivaTarifa !== undefined ? parseInt(item.ivaTarifa) : 12
        const codigoPorcentaje = tarifa === 0 ? "0" : (tarifa === 15 ? "4" : "2")
        const baseImponible = (Number(item.cantidad) * Number(item.precioUnitario)) - Number(item.descuento || 0)
        const valorImpuesto = baseImponible * (tarifa / 100)

        return {
          codigoPrincipal: item.codigoPrincipal || "ITEM",
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad),
          precioUnitario: Number(item.precioUnitario),
          descuento: Number(item.descuento || 0),
          precioTotalSinImpuesto: baseImponible,
          impuestos: [{
            codigo: "2",
            codigoPorcentaje,
            tarifa,
            baseImponible: Number(baseImponible.toFixed(2)),
            valor: Number(valorImpuesto.toFixed(2)),
          }],
        }
      }),
      infoAdicional: infoAdicionalArray.length > 0 ? infoAdicionalArray : undefined,
    }

    const xmlUnsigned = XMLGenerator.generateFacturaXML(facturaElectronica as any)
    const decryptedPassword = CertificateManager.decryptPassword(medico.firmaPassword!)

    const signatureResult = await CertificateManager.signXML(
      xmlUnsigned,
      medico.firmaElectronicaPath!,
      decryptedPassword,
    )

    if (!signatureResult.success || !signatureResult.signedXML) {
      throw new Error("Firma falló: " + signatureResult.error)
    }

    return signatureResult.signedXML
  }
}
