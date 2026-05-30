/**
 * fiscal-types.ts
 * 
 * Tipos TypeScript centralizados para la integración con la API fiscal externa (NestJS).
 * Estos tipos reflejan el contrato de la API externa open-api-facturacion-sri y
 * los modelos intermedios usados internamente en el MVP.
 * 
 * @module fiscal-types
 */

// ============================================================================
// Enums – Reflejan los enums de la API externa NestJS
// ============================================================================

/** Ambiente SRI: "1" pruebas, "2" producción */
export enum AmbienteSRI {
  PRUEBAS = "1",
  PRODUCCION = "2",
}

/** Tipo de emisión SRI */
export enum TipoEmisionSRI {
  NORMAL = "1",
  CONTINGENCIA = "2",
}

/** Tipo de comprobante SRI */
export enum TipoComprobanteSRI {
  FACTURA = "01",
  NOTA_CREDITO = "04",
  NOTA_DEBITO = "05",
  GUIA_REMISION = "06",
  COMPROBANTE_RETENCION = "07",
}

/** Tipo de identificación del comprador SRI */
export enum TipoIdentificacionSRI {
  RUC = "04",
  CEDULA = "05",
  PASAPORTE = "06",
  CONSUMIDOR_FINAL = "07",
  IDENTIFICACION_EXTERIOR = "08",
}

/** Formas de pago SRI */
export enum FormaPagoSRI {
  SIN_UTILIZACION_SISTEMA_FINANCIERO = "01",
  COMPENSACION_DEUDAS = "15",
  TARJETA_DEBITO = "16",
  DINERO_ELECTRONICO = "17",
  TARJETA_PREPAGO = "18",
  TARJETA_CREDITO = "19",
  OTROS_CON_SISTEMA_FINANCIERO = "20",
  ENDOSO_TITULOS = "21",
}

/** Código de impuesto SRI */
export enum CodigoImpuestoSRI {
  IVA = "2",
  ICE = "3",
  IRBPNR = "5",
}

/** Código de porcentaje IVA SRI (actualizado 2024) */
export enum CodigoPorcentajeIVA {
  IVA_0 = "0",
  IVA_12 = "2",
  IVA_14 = "3",
  IVA_15 = "4",
  IVA_NO_OBJETO = "6",
  IVA_EXENTO = "7",
}

// ============================================================================
// Interfaces – Payload de la API externa (Request)
// ============================================================================

/** Datos del emisor en el payload de la API externa */
export interface FiscalEmisorPayload {
  ruc: string
  razonSocial: string
  nombreComercial?: string
  dirMatriz: string
  dirEstablecimiento?: string
  establecimiento: string
  puntoEmision: string
  obligadoContabilidad: "SI" | "NO"
  contribuyenteEspecial?: string
  agenteRetencion?: string
  contribuyenteRimpe?: "CONTRIBUYENTE RÉGIMEN RIMPE"
}

/** Datos del comprador en el payload de la API externa */
export interface FiscalCompradorPayload {
  tipoIdentificacion: TipoIdentificacionSRI | string
  identificacion: string
  razonSocial: string
  direccion?: string
  telefono?: string
  email?: string
}

/** Impuesto individual en un detalle */
export interface FiscalImpuestoDetalle {
  codigo: string
  codigoPorcentaje: string
  tarifa: number
  baseImponible: number
  valor: number
}

/** Detalle adicional en un item */
export interface FiscalDetalleAdicional {
  nombre: string
  valor: string
}

/** Item/detalle del comprobante */
export interface FiscalDetalleFactura {
  codigoPrincipal: string
  codigoAuxiliar?: string
  descripcion: string
  unidadMedida?: string
  cantidad: number
  precioUnitario: number
  descuento: number
  detallesAdicionales?: FiscalDetalleAdicional[]
  impuestos: FiscalImpuestoDetalle[]
}

/** Forma de pago */
export interface FiscalPagoPayload {
  formaPago: FormaPagoSRI | string
  total: number
  plazo?: number
  unidadTiempo?: "dias" | "meses" | "años"
}

/** Campo adicional de información */
export interface FiscalCampoAdicional {
  nombre: string
  valor: string
}

/**
 * Payload completo para POST /sri/emitir/factura
 * Refleja exactamente CreateFacturaDto de la API NestJS.
 */
export interface CreateFacturaAPIPayload {
  ambiente?: AmbienteSRI | string
  tipoEmision?: TipoEmisionSRI | string
  fechaEmision: string    // dd/mm/yyyy
  secuencial?: string
  emisor: FiscalEmisorPayload
  comprador: FiscalCompradorPayload
  detalles: FiscalDetalleFactura[]
  pagos: FiscalPagoPayload[]
  infoAdicional?: FiscalCampoAdicional[]
  guiaRemision?: string
}

// ============================================================================
// Interfaces – Respuestas de la API externa (Response)
// ============================================================================

/** Mensaje del SRI */
export interface SRIMensaje {
  identificador: string
  mensaje: string
  informacionAdicional?: string
  tipo: "ERROR" | "ADVERTENCIA" | "INFORMATIVO"
}

/** Respuesta de factura procesada sincrónicamente */
export interface FacturaAPIResponse {
  success: boolean
  claveAcceso: string
  estado: string
  fechaAutorizacion?: string
  numeroAutorizacion?: string
  xmlAutorizado?: string
  mensajes?: SRIMensaje[] | string[]
}

/** Respuesta de emisión encolada (asíncrona) */
export interface EmisionEncoladaResponse {
  mensaje: string
  jobId: string
  estado: string
}

/** Respuesta de autenticación */
export interface AuthAPIResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  expiresAt: string
  user: {
    id: string
    email: string
    rol: string
    tenantId: string | null
  }
}

/** Respuesta de consulta de autorización GET /sri/autorizar/:claveAcceso */
export interface ConsultaAutorizacionResponse {
  success: boolean
  claveAcceso: string
  estado: string
  fechaAutorizacion?: string
  numeroAutorizacion?: string
  xmlAutorizado?: string
  mensajes?: SRIMensaje[]
}

// ============================================================================
// Interfaces – Modelos internos del Adapter
// ============================================================================

/** Configuración del adapter fiscal */
export interface FiscalAdapterConfig {
  apiBaseUrl: string
  email: string
  password: string
  timeoutMs: number
  maxRetries: number
  retryBaseDelayMs: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
}

/**
 * Resultado normalizado que devuelve FiscalAdapter.
 * `retriable` determina si BackgroundProcessor debe reintentar:
 *   - true  → volver a PENDIENTE_ENVIO para retry en próximo ciclo
 *   - false → marcar como RECHAZADO (error terminal) o AUTORIZADO (éxito)
 */
export interface FiscalAdapterResult {
  success: boolean
  estado: "AUTORIZADO" | "RECHAZADO" | "RECIBIDO_SRI" | "EN_COLA" | "ERROR"
  claveAcceso?: string
  numeroAutorizacion?: string
  fechaAutorizacion?: Date
  xmlAutorizado?: string
  mensajes: string[]
  retriable: boolean
  /** Metadata for logging/debugging */
  meta?: {
    httpStatus?: number
    responseTimeMs?: number
    jobId?: string
  }
}

// ============================================================================
// Interfaces – Modelos Prisma con relaciones (input del mapper)
// ============================================================================

/**
 * Factura con TODAS las relaciones cargadas por BackgroundProcessor.
 * Definido aquí (no importado de Prisma) para desacoplar el mapper del ORM.
 */
export interface FacturaConRelaciones {
  id: string
  secuencial: string
  claveAcceso: string | null
  fechaEmision: Date
  subtotal: any  // Prisma Decimal → se convierte a Number en el mapper
  iva: any
  total: any
  estado: string
  paciente: {
    tipoIdentificacion: string
    numeroIdentificacion: string
    razonSocial: string
    direccion?: string | null
    email?: string | null
    telefono?: string | null
  }
  items: Array<{
    codigoPrincipal?: string | null
    descripcion: string
    cantidad: any
    precioUnitario: any
    descuento: any
    ivaTarifa: number
    impuestoValor?: any
  }>
  formasPago: Array<{
    codigo: string
    total: any
    plazo?: number | null
    unidadTiempo?: string | null
  }>
  infoAdicional: Array<{
    nombre: string
    valor: string
  }>
}

/** Datos del perfil médico necesarios para el mapper */
export interface MedicoProfileData {
  ruc: string
  razonSocial?: string | null
  nombreComercial?: string | null
  direccion?: string | null
  direccionMatriz?: string | null
  obligadoContabilidad: boolean
  contribuyenteEspecial?: string | null
  establecimiento: string
  puntoEmision: string
  ambiente: string
  firmaElectronicaPath: string   // base64 del .p12
  firmaPassword: string          // password encriptado con AES-CBC
}

// ============================================================================
// Tipos de error clasificados
// ============================================================================

export enum FiscalErrorCategory {
  /** Errores de red: timeout, conexión rechazada, DNS */
  NETWORK = "NETWORK",
  /** Errores del SRI: rechazado, no autorizado */
  SRI = "SRI",
  /** Errores de validación: datos inválidos, 400 */
  VALIDATION = "VALIDATION",
  /** Errores de timeout */
  TIMEOUT = "TIMEOUT",
  /** Errores de autenticación con la API */
  AUTH = "AUTH",
  /** Errores del servidor de la API (5xx) */
  SERVER = "SERVER",
  /** Errores desconocidos */
  UNKNOWN = "UNKNOWN",
}

export interface FiscalError {
  category: FiscalErrorCategory
  message: string
  retriable: boolean
  httpStatus?: number
  code?: string
  details?: unknown
}

// ============================================================================
// Feature flag type
// ============================================================================

export interface FiscalFeatureFlags {
  /** Usar API externa para firma/envío. false = fallback a lógica local legacy */
  useFiscalAPI: boolean
  /** Enviar certificado en cada request (Opción A) vs usar ID de referencia (Opción B) */
  sendCertificateInRequest: boolean
  /** Habilitar circuit breaker */
  enableCircuitBreaker: boolean
  /** Log nivel de detalle */
  verboseLogging: boolean
}
