/**
 * fiscal-mapper.ts
 * 
 * Función pura que convierte el modelo Prisma (Factura con relaciones + MedicoProfile)
 * al payload que espera la API fiscal externa (CreateFacturaDto de NestJS).
 * 
 * Decisiones de diseño:
 * - Función PURA: recibe datos tipados, devuelve payload. Sin side effects, sin DB access.
 * - Toda la lógica de cálculo de impuestos (totalización por tarifa) extraída del
 *   antiguo generateAndSignXML de background-processor.ts.
 * - Password del certificado se desencripta aquí (punto más cercano al consumo).
 * - Validaciones con Zod para asegurar integridad antes de enviar a la API.
 * - Prisma Decimals se convierten a Number de forma explícita y segura.
 * 
 * @module fiscal-mapper
 */

import { z } from "zod"
import { CertificateManager } from "./certificate-manager"
import type {
  FacturaConRelaciones,
  MedicoProfileData,
  CreateFacturaAPIPayload,
  AmbienteSRI,
  FiscalEmisorPayload,
  FiscalCompradorPayload,
  FiscalDetalleFactura,
  FiscalPagoPayload,
  FiscalCampoAdicional,
  FiscalImpuestoDetalle,
} from "./fiscal-types"

// Re-export types for backward compatibility
export type { FacturaConRelaciones, MedicoProfileData } from "./fiscal-types"

// ============================================================================
// Zod Schemas para validación pre-envío
// ============================================================================

const RucSchema = z.string().regex(/^\d{13}$/, "RUC debe tener exactamente 13 dígitos")

const EmisorSchema = z.object({
  ruc: RucSchema,
  razonSocial: z.string().min(1, "Razón social del emisor requerida"),
  dirMatriz: z.string().min(1, "Dirección matriz requerida"),
  establecimiento: z.string().regex(/^\d{3}$/, "Establecimiento debe tener 3 dígitos"),
  puntoEmision: z.string().regex(/^\d{3}$/, "Punto de emisión debe tener 3 dígitos"),
  obligadoContabilidad: z.enum(["SI", "NO"]),
})

const CompradorSchema = z.object({
  tipoIdentificacion: z.string().min(2, "Tipo de identificación requerido"),
  identificacion: z.string().min(1, "Identificación del comprador requerida"),
  razonSocial: z.string().min(1, "Razón social del comprador requerida"),
})

const DetalleSchema = z.object({
  codigoPrincipal: z.string().min(1),
  descripcion: z.string().min(1, "Descripción del item requerida"),
  cantidad: z.number().positive("Cantidad debe ser positiva"),
  precioUnitario: z.number().min(0, "Precio unitario no puede ser negativo"),
  descuento: z.number().min(0),
  impuestos: z.array(z.object({
    codigo: z.string(),
    codigoPorcentaje: z.string(),
    tarifa: z.number().min(0),
    baseImponible: z.number().min(0),
    valor: z.number().min(0),
  })).min(1, "Cada detalle debe tener al menos un impuesto"),
})

const PagoSchema = z.object({
  formaPago: z.string().min(2),
  total: z.number().min(0),
})

const PayloadSchema = z.object({
  fechaEmision: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Fecha debe ser dd/mm/yyyy"),
  emisor: EmisorSchema,
  comprador: CompradorSchema,
  detalles: z.array(DetalleSchema).min(1, "Al menos un detalle requerido"),
  pagos: z.array(PagoSchema).min(1, "Al menos una forma de pago requerida"),
})

// ============================================================================
// Excepciones
// ============================================================================

export class MappingValidationError extends Error {
  public readonly issues: z.ZodIssue[]

  constructor(message: string, issues: z.ZodIssue[]) {
    super(message)
    this.name = "MappingValidationError"
    this.issues = issues
  }
}

// ============================================================================
// Mapper principal
// ============================================================================

/**
 * Convierte el modelo Prisma (Factura con relaciones + MedicoProfile)
 * al payload que espera POST /sri/emitir/factura de la API NestJS.
 * 
 * @param factura - Factura con todas las relaciones incluidas
 * @param medico - Perfil del médico con configuración SRI
 * @returns Payload validado conforme a CreateFacturaDto
 * @throws MappingValidationError si los datos no pasan validación
 */
export function mapFacturaToApiPayload(
  factura: FacturaConRelaciones,
  medico: MedicoProfileData
): CreateFacturaAPIPayload {

  // --- Calcular impuestos totalizados por tarifa ---
  const impuestosTotalizados = calcularImpuestosTotalizados(factura.items)

  // --- Mapear detalles ---
  const detalles = mapDetalles(factura.items)

  // --- Mapear pagos ---
  const pagos = mapPagos(factura.formasPago)

  // --- Fecha de emisión dd/mm/yyyy ---
  const fechaEmision = formatFechaEmision(factura.fechaEmision)

  // --- Ambiente ---
  const ambiente = resolverAmbiente(medico.ambiente)

  // --- Info adicional ---
  const infoAdicional = mapInfoAdicional(factura.infoAdicional)

  // --- Construir payload ---
  const payload: CreateFacturaAPIPayload = {
    ambiente,
    tipoEmision: "1",
    fechaEmision,
    secuencial: factura.secuencial,
    emisor: mapEmisor(medico),
    comprador: mapComprador(factura.paciente),
    detalles,
    pagos,
    ...(infoAdicional.length > 0 && { infoAdicional }),
  }

  // --- Validación Zod ---
  const validationResult = PayloadSchema.safeParse(payload)
  if (!validationResult.success) {
    const issuesSummary = validationResult.error.issues
      .map(i => `${i.path.join(".")}: ${i.message}`)
      .join("; ")

    throw new MappingValidationError(
      `Validación fallida del payload fiscal: ${issuesSummary}`,
      validationResult.error.issues
    )
  }

  return payload
}

/**
 * Backward-compatible alias que incluye el certificado en el payload.
 * Se usa cuando FISCAL_SEND_CERT_IN_REQUEST=true (Opción A).
 * 
 * @deprecated Use mapFacturaToApiPayload + certificado separado
 */
export function mapFacturaToSriPayload(
  factura: FacturaConRelaciones,
  medico: MedicoProfileData
): CreateFacturaAPIPayload & { certificado: { archivo: string; password: string } } {

  const apiPayload = mapFacturaToApiPayload(factura, medico)
  const passwordPlano = CertificateManager.decryptPassword(medico.firmaPassword)

  return {
    ...apiPayload,
    certificado: {
      archivo: medico.firmaElectronicaPath,
      password: passwordPlano,
    },
  }
}

// ============================================================================
// Sub-mappers
// ============================================================================

function mapEmisor(medico: MedicoProfileData): FiscalEmisorPayload {
  return {
    ruc: medico.ruc,
    razonSocial: medico.razonSocial || medico.nombreComercial || "Médico",
    nombreComercial: medico.nombreComercial || undefined,
    dirMatriz: medico.direccionMatriz || medico.direccion || "Matriz",
    dirEstablecimiento: medico.direccion || undefined,
    establecimiento: medico.establecimiento || "001",
    puntoEmision: medico.puntoEmision || "001",
    obligadoContabilidad: medico.obligadoContabilidad ? "SI" : "NO",
    contribuyenteEspecial: medico.contribuyenteEspecial || undefined,
  }
}

function mapComprador(paciente: FacturaConRelaciones["paciente"]): FiscalCompradorPayload {
  return {
    tipoIdentificacion: resolverTipoIdentificacion(paciente.tipoIdentificacion),
    identificacion: paciente.numeroIdentificacion,
    razonSocial: paciente.razonSocial,
    direccion: paciente.direccion || undefined,
    email: paciente.email || undefined,
    telefono: paciente.telefono || undefined,
  }
}

function mapDetalles(items: FacturaConRelaciones["items"]): FiscalDetalleFactura[] {
  return items.map((item) => {
    const tarifa = item.ivaTarifa !== undefined ? item.ivaTarifa : 12
    const codigoPorcentaje = resolverCodigoPorcentaje(tarifa)
    const baseImponible = (toNum(item.cantidad) * toNum(item.precioUnitario)) - toNum(item.descuento || 0)
    const valorImpuesto = baseImponible * (tarifa / 100)

    return {
      codigoPrincipal: item.codigoPrincipal || "SRV-MED",
      descripcion: item.descripcion,
      cantidad: toNum(item.cantidad),
      precioUnitario: toNum(item.precioUnitario),
      descuento: toNum(item.descuento || 0),
      impuestos: [{
        codigo: "2",        // IVA
        codigoPorcentaje,
        tarifa,
        baseImponible: round2(baseImponible),
        valor: round2(valorImpuesto),
      }],
    }
  })
}

function mapPagos(formasPago: FacturaConRelaciones["formasPago"]): FiscalPagoPayload[] {
  return formasPago.map((p) => {
    const pago: FiscalPagoPayload = {
      formaPago: p.codigo,
      total: toNum(p.total),
    }
    if (p.plazo && Number(p.plazo) > 0) {
      pago.plazo = Number(p.plazo)
      pago.unidadTiempo = (p.unidadTiempo?.toLowerCase() as FiscalPagoPayload["unidadTiempo"]) || "dias"
    }
    return pago
  })
}

function mapInfoAdicional(
  info: FacturaConRelaciones["infoAdicional"]
): FiscalCampoAdicional[] {
  return info
    .filter((ia) => ia.nombre?.trim() && ia.valor?.trim())
    .map((ia) => ({
      nombre: ia.nombre.trim(),
      valor: ia.valor.trim(),
    }))
}

/**
 * Calcula impuestos totalizados por tarifa IVA.
 * Agrupa por codigoPorcentaje y suma baseImponible y valor.
 */
function calcularImpuestosTotalizados(
  items: FacturaConRelaciones["items"]
): FiscalImpuestoDetalle[] {
  const map = new Map<string, { baseImponible: number; valor: number }>()

  items.forEach((item) => {
    const tarifa = item.ivaTarifa !== undefined ? item.ivaTarifa : 12
    const codigoPorcentaje = resolverCodigoPorcentaje(tarifa)
    const base = (toNum(item.cantidad) * toNum(item.precioUnitario)) - toNum(item.descuento || 0)
    const impuesto = base * (tarifa / 100)

    const current = map.get(codigoPorcentaje) || { baseImponible: 0, valor: 0 }
    map.set(codigoPorcentaje, {
      baseImponible: current.baseImponible + base,
      valor: current.valor + impuesto,
    })
  })

  return Array.from(map.entries()).map(([codigoPorcentaje, val]) => ({
    codigo: "2",  // IVA
    codigoPorcentaje,
    baseImponible: round2(val.baseImponible),
    tarifa: codigoPorcentaje === "0" ? 0 : (codigoPorcentaje === "4" ? 15 : (codigoPorcentaje === "3" ? 14 : 12)),
    valor: round2(val.valor),
  }))
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resuelve el código de porcentaje SRI según la tarifa de IVA.
 * Catálogo SRI 2024: 0% → "0", 12% → "2", 14% → "3", 15% → "4"
 */
function resolverCodigoPorcentaje(tarifa: number): string {
  if (tarifa === 0) return "0"
  if (tarifa === 15) return "4"
  if (tarifa === 14) return "3"
  return "2"  // 12% default
}

/**
 * Resuelve tipo de identificación al código SRI.
 * Acepta tanto nombres ("cedula", "RUC") como códigos ("04", "05").
 */
function resolverTipoIdentificacion(tipo: string): string {
  const normalized = (tipo || "").toLowerCase().trim()
  if (normalized === "cedula" || normalized === "cédula") return "05"
  if (normalized === "ruc") return "04"
  if (normalized === "pasaporte") return "06"
  if (normalized === "consumidor_final") return "07"
  // Valores ya en formato código
  if (["04", "05", "06", "07", "08", "09"].includes(tipo)) return tipo
  return "05"  // Default cédula
}

/**
 * Resuelve el ambiente SRI al formato de la API.
 */
function resolverAmbiente(ambiente: string): string {
  const norm = (ambiente || "").toLowerCase()
  if (norm === "produccion" || norm === "2") return "2"
  return "1"  // Pruebas por defecto
}

/**
 * Formatea fecha en dd/mm/yyyy como requiere la API SRI.
 */
function formatFechaEmision(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0")
  const m = (date.getMonth() + 1).toString().padStart(2, "0")
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

/**
 * Convierte Prisma Decimal (o cualquier valor numérico) a Number de forma segura.
 */
function toNum(value: any): number {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return isNaN(n) ? 0 : n
}

/**
 * Redondea a 2 decimales (evita errores de floating point).
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}
