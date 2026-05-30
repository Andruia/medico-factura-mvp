/**
 * fiscal-adapter.ts
 * 
 * Patrón Adapter para la API fiscal externa (NestJS open-api-facturacion-sri).
 * Encapsula toda la comunicación HTTP, autenticación JWT, clasificación de errores,
 * circuit breaker y logging estructurado.
 * 
 * Decisiones de diseño:
 * 1. Token JWT se cachea en memoria con margen de 60s antes de expiración.
 *    En serverless (Vercel/Railway) cada cold start re-autentica; aceptable
 *    porque el cron procesa un lote completo en una sola invocación.
 * 2. Circuit breaker protege contra cascadas de fallos cuando la API está caída.
 * 3. Retry con exponential backoff integrado para errores transitorios.
 * 4. Errores clasificados en retriable vs terminal para que BackgroundProcessor
 *    decida el estado final de la factura.
 * 
 * @module fiscal-adapter
 */

import axios, { AxiosError, AxiosInstance } from "axios"
import { getFiscalAdapterConfig, getFiscalFeatureFlags } from "@/lib/config/fiscal-config"
import type {
  FiscalAdapterConfig,
  FiscalAdapterResult,
  CreateFacturaAPIPayload,
  AuthAPIResponse,
  FacturaAPIResponse,
  EmisionEncoladaResponse,
  ConsultaAutorizacionResponse,
  FiscalErrorCategory,
  FiscalError,
} from "./fiscal-types"

// ============================================================================
// Structured Logger
// ============================================================================

interface LogEntry {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR" | "DEBUG"
  module: string
  action: string
  message: string
  meta?: Record<string, unknown>
}

function log(entry: Omit<LogEntry, "timestamp" | "module">): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    module: "FiscalAdapter",
    ...entry,
  }

  const flags = getFiscalFeatureFlags()
  if (entry.level === "DEBUG" && !flags.verboseLogging) return

  const prefix = `[${logEntry.module}][${logEntry.action}]`
  const metaStr = logEntry.meta ? ` ${JSON.stringify(logEntry.meta)}` : ""

  switch (entry.level) {
    case "ERROR":
      console.error(`${prefix} ${logEntry.message}${metaStr}`)
      break
    case "WARN":
      console.warn(`${prefix} ${logEntry.message}${metaStr}`)
      break
    case "DEBUG":
      console.debug(`${prefix} ${logEntry.message}${metaStr}`)
      break
    default:
      console.log(`${prefix} ${logEntry.message}${metaStr}`)
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

interface CircuitBreakerState {
  failures: number
  lastFailure: number
  isOpen: boolean
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
}

function checkCircuitBreaker(): void {
  const flags = getFiscalFeatureFlags()
  if (!flags.enableCircuitBreaker) return

  const config = getFiscalAdapterConfig()

  if (circuitBreaker.isOpen) {
    const elapsed = Date.now() - circuitBreaker.lastFailure
    if (elapsed >= config.circuitBreakerResetMs) {
      // Half-open: allow one attempt
      log({
        level: "INFO",
        action: "circuit_breaker",
        message: "Circuit breaker half-open, allowing attempt",
        meta: { elapsedMs: elapsed },
      })
      circuitBreaker.isOpen = false
      circuitBreaker.failures = 0
    } else {
      throw new CircuitBreakerOpenError(
        `Circuit breaker abierto. Se reabrirá en ${Math.ceil((config.circuitBreakerResetMs - elapsed) / 1000)}s`
      )
    }
  }
}

function recordCircuitBreakerSuccess(): void {
  circuitBreaker.failures = 0
  circuitBreaker.isOpen = false
}

function recordCircuitBreakerFailure(): void {
  const flags = getFiscalFeatureFlags()
  if (!flags.enableCircuitBreaker) return

  const config = getFiscalAdapterConfig()
  circuitBreaker.failures++
  circuitBreaker.lastFailure = Date.now()

  if (circuitBreaker.failures >= config.circuitBreakerThreshold) {
    circuitBreaker.isOpen = true
    log({
      level: "WARN",
      action: "circuit_breaker",
      message: `Circuit breaker ABIERTO tras ${circuitBreaker.failures} fallos consecutivos`,
      meta: { threshold: config.circuitBreakerThreshold },
    })
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CircuitBreakerOpenError"
  }
}

// ============================================================================
// FiscalAdapter
// ============================================================================

export class FiscalAdapter {
  // --- Auth cache (module-level singleton) ---
  private static token: string | null = null
  private static refreshToken: string | null = null
  private static tokenExpiry: number = 0
  private static client: AxiosInstance | null = null

  // ---- Client management ----

  private static getClient(): AxiosInstance {
    if (!this.client) {
      const config = getFiscalAdapterConfig()
      this.client = axios.create({
        baseURL: config.apiBaseUrl,
        timeout: config.timeoutMs,
        headers: { "Content-Type": "application/json" },
      })
    }
    return this.client
  }

  // ---- Authentication ----

  /**
   * Autentica contra POST /auth/login y cachea el JWT.
   * El token se renueva 60s antes de expirar para evitar race conditions.
   */
  static async authenticate(): Promise<string> {
    const now = Date.now()

    // Reutilizar token vigente (con margen de 60s)
    if (this.token && this.tokenExpiry > now + 60_000) {
      return this.token
    }

    const config = getFiscalAdapterConfig()
    const client = this.getClient()

    try {
      log({ level: "INFO", action: "authenticate", message: "Autenticando contra API fiscal..." })

      const response = await client.post<AuthAPIResponse>("/auth/login", {
        email: config.email,
        password: config.password,
      })

      const data = response.data
      const accessToken = data.accessToken

      if (!accessToken) {
        throw new Error("Respuesta de autenticación no contiene accessToken")
      }

      this.token = accessToken
      this.refreshToken = data.refreshToken || null
      // expiresIn en segundos → ms
      this.tokenExpiry = now + ((data.expiresIn || 3600) * 1000)

      log({
        level: "INFO",
        action: "authenticate",
        message: "Autenticación exitosa",
        meta: {
          expiresInMin: Math.round((this.tokenExpiry - now) / 60000),
          userId: data.user?.id,
        },
      })

      return accessToken
    } catch (error) {
      this.token = null
      this.tokenExpiry = 0
      log({
        level: "ERROR",
        action: "authenticate",
        message: `Error de autenticación: ${(error as Error).message}`,
      })
      throw new Error(`[FiscalAdapter] Error de autenticación: ${(error as Error).message}`)
    }
  }

  // ---- Emitir Factura ----

  /**
   * Envía factura a POST /sri/emitir/factura con retry + circuit breaker.
   * Payload conforma CreateFacturaDto de la API NestJS.
   */
  static async emitirFactura(payload: CreateFacturaAPIPayload): Promise<FiscalAdapterResult> {
    const startTime = Date.now()
    const config = getFiscalAdapterConfig()

    try {
      checkCircuitBreaker()
    } catch (e) {
      return {
        success: false,
        estado: "ERROR",
        mensajes: [(e as Error).message],
        retriable: true,
        meta: { responseTimeMs: Date.now() - startTime },
      }
    }

    // Retry loop con exponential backoff
    let lastError: FiscalAdapterResult | null = null

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const token = await this.authenticate()
        const client = this.getClient()

        log({
          level: "INFO",
          action: "emitir_factura",
          message: `Intento ${attempt}/${config.maxRetries} - Emitiendo factura`,
          meta: {
            secuencial: payload.secuencial,
            ruc: payload.emisor.ruc,
            ambiente: payload.ambiente,
          },
        })

        const response = await client.post("/sri/emitir/factura", payload, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const result = this.normalizeResponse(response.data, Date.now() - startTime)
        recordCircuitBreakerSuccess()

        log({
          level: result.success ? "INFO" : "WARN",
          action: "emitir_factura",
          message: `Resultado: ${result.estado}`,
          meta: { ...result.meta, attempt },
        })

        return result

      } catch (error) {
        lastError = this.handleError(error, Date.now() - startTime)

        // Si NO es retriable, no tiene sentido reintentar
        if (!lastError.retriable) {
          recordCircuitBreakerFailure()
          return lastError
        }

        // Si hay más intentos, esperar con backoff exponencial
        if (attempt < config.maxRetries) {
          const delay = config.retryBaseDelayMs * Math.pow(2, attempt - 1)
          log({
            level: "WARN",
            action: "emitir_factura",
            message: `Reintentando en ${delay}ms (intento ${attempt}/${config.maxRetries})`,
            meta: { error: lastError.mensajes[0] },
          })
          await sleep(delay)
        }
      }
    }

    // Agotados todos los reintentos
    recordCircuitBreakerFailure()
    log({
      level: "ERROR",
      action: "emitir_factura",
      message: `Agotados ${config.maxRetries} reintentos`,
    })

    return lastError || {
      success: false,
      estado: "ERROR",
      mensajes: ["Error desconocido tras agotar reintentos"],
      retriable: true,
      meta: { responseTimeMs: Date.now() - startTime },
    }
  }

  // ---- Consultar Autorización ----

  /**
   * Consulta el estado de autorización de un comprobante via GET /sri/autorizar/:claveAcceso.
   * NO hace retries internos (la consulta es idempotente y se puede reinvocar en próximo ciclo).
   */
  static async consultarAutorizacion(claveAcceso: string): Promise<FiscalAdapterResult> {
    const startTime = Date.now()

    try {
      checkCircuitBreaker()
    } catch (e) {
      return {
        success: false,
        estado: "ERROR",
        mensajes: [(e as Error).message],
        retriable: true,
        meta: { responseTimeMs: Date.now() - startTime },
      }
    }

    try {
      const token = await this.authenticate()
      const client = this.getClient()

      log({
        level: "INFO",
        action: "consultar_autorizacion",
        message: `Consultando autorización para clave ${claveAcceso}`,
      })

      const response = await client.get<ConsultaAutorizacionResponse>(
        `/sri/autorizar/${claveAcceso}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const result = this.normalizeResponse(response.data, Date.now() - startTime)
      recordCircuitBreakerSuccess()
      return result

    } catch (error) {
      const result = this.handleError(error, Date.now() - startTime)
      if (!result.retriable) recordCircuitBreakerFailure()
      return result
    }
  }

  // ---- Response normalization ----

  /**
   * Normaliza respuesta exitosa (2xx) de la API al formato interno.
   * La API puede devolver 200/201 con distintos formatos según modo sync/async.
   */
  private static normalizeResponse(
    data: FacturaAPIResponse | EmisionEncoladaResponse | any,
    responseTimeMs: number
  ): FiscalAdapterResult {
    // Detectar respuesta encolada (asíncrona)
    if ("jobId" in data && data.jobId) {
      return {
        success: true,
        estado: "EN_COLA",
        claveAcceso: data.claveAcceso,
        mensajes: [data.mensaje || "Comprobante encolado para procesamiento asíncrono"],
        retriable: false,
        meta: { responseTimeMs, jobId: data.jobId },
      }
    }

    const estado = (data.estado || "").toUpperCase()
    const mensajes: string[] = []

    // Recopilar mensajes (pueden venir como strings o como SRIMensaje objects)
    if (data.mensajes && Array.isArray(data.mensajes)) {
      mensajes.push(...data.mensajes.map((m: any) =>
        typeof m === "string" ? m : (m.mensaje || m.message || JSON.stringify(m))
      ))
    }
    if (data.mensaje) mensajes.push(data.mensaje)
    if (data.error) mensajes.push(data.error)

    if (estado === "AUTORIZADO") {
      return {
        success: true,
        estado: "AUTORIZADO",
        claveAcceso: data.claveAcceso || undefined,
        numeroAutorizacion: data.numeroAutorizacion || data.claveAcceso || undefined,
        fechaAutorizacion: data.fechaAutorizacion ? new Date(data.fechaAutorizacion) : new Date(),
        xmlAutorizado: data.xmlAutorizado || undefined,
        mensajes,
        retriable: false,
        meta: { responseTimeMs },
      }
    }

    if (estado === "RECIBIDA" || estado === "RECIBIDO_SRI" || estado === "EN PROCESAMIENTO" || estado === "EN_PROCESO" || estado === "PENDIENTE") {
      return {
        success: true,
        estado: "RECIBIDO_SRI",
        claveAcceso: data.claveAcceso || undefined,
        mensajes: mensajes.length > 0 ? mensajes : ["Comprobante recibido por SRI, pendiente de autorización."],
        retriable: false,
        meta: { responseTimeMs },
      }
    }

    // RECHAZADO, DEVUELTA, NO AUTORIZADO → error terminal de negocio
    return {
      success: false,
      estado: "RECHAZADO",
      claveAcceso: data.claveAcceso || undefined,
      mensajes: mensajes.length > 0 ? mensajes : ["Rechazado por el SRI"],
      retriable: false,
      meta: { responseTimeMs },
    }
  }

  // ---- Error handling ----

  /**
   * Clasifica errores HTTP en categorías para decidir si reintentar.
   * 
   * Retriable: timeout, red, 5xx, 429, 401 (token expirado)
   * Terminal: 4xx (excepto 401/429) → datos inválidos
   */
  private static handleError(error: unknown, responseTimeMs: number): FiscalAdapterResult {
    if (error instanceof AxiosError) {
      const status = error.response?.status
      const errorData = error.response?.data

      // Errores de red / timeout
      if (
        error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" ||
        error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" ||
        error.code === "ERR_NETWORK" || !error.response
      ) {
        const category: FiscalErrorCategory = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
          ? "TIMEOUT" as FiscalErrorCategory
          : "NETWORK" as FiscalErrorCategory

        log({
          level: "WARN",
          action: "handle_error",
          message: `Error de ${category} (${error.code}): ${error.message}`,
        })

        return {
          success: false,
          estado: "ERROR",
          mensajes: [`Error de conexión con API fiscal: ${error.code} - ${error.message}`],
          retriable: true,
          meta: { httpStatus: status, responseTimeMs },
        }
      }

      // HTTP 5xx o 429 → retriable
      if (status && (status >= 500 || status === 429)) {
        log({
          level: "WARN",
          action: "handle_error",
          message: `Error del servidor API (HTTP ${status})`,
        })
        return {
          success: false,
          estado: "ERROR",
          mensajes: [`Error del servidor API fiscal (HTTP ${status}): ${errorData?.message || error.message}`],
          retriable: true,
          meta: { httpStatus: status, responseTimeMs },
        }
      }

      // HTTP 401 → token expirado, forzar re-auth
      if (status === 401) {
        this.token = null
        this.tokenExpiry = 0
        log({
          level: "WARN",
          action: "handle_error",
          message: "Token expirado (401), se re-autenticará en próximo intento",
        })
        return {
          success: false,
          estado: "ERROR",
          mensajes: ["Token de autenticación expirado. Se reintentará con nuevo token."],
          retriable: true,
          meta: { httpStatus: 401, responseTimeMs },
        }
      }

      // HTTP 4xx → error terminal (datos inválidos, recurso no encontrado, etc.)
      const apiMessage = errorData?.message || errorData?.error || error.message
      const apiMessages = Array.isArray(errorData?.message) ? errorData.message : [apiMessage]

      log({
        level: "ERROR",
        action: "handle_error",
        message: `Error de la API (HTTP ${status}): ${apiMessages.join("; ")}`,
      })

      return {
        success: false,
        estado: "RECHAZADO",
        mensajes: apiMessages.map((m: string) => `Error API (HTTP ${status}): ${m}`),
        retriable: false,
        meta: { httpStatus: status, responseTimeMs },
      }
    }

    // Error no-axios → retriable por precaución
    log({
      level: "ERROR",
      action: "handle_error",
      message: `Error inesperado: ${(error as Error).message}`,
    })
    return {
      success: false,
      estado: "ERROR",
      mensajes: [`Error inesperado: ${(error as Error).message}`],
      retriable: true,
      meta: { responseTimeMs },
    }
  }

  // ---- Utilities ----

  /** Invalida tokens y client. Para testing o forzar re-auth. */
  static invalidateToken(): void {
    this.token = null
    this.refreshToken = null
    this.tokenExpiry = 0
    this.client = null
  }

  /** Reset del circuit breaker. Para testing o recuperación manual. */
  static resetCircuitBreaker(): void {
    circuitBreaker.failures = 0
    circuitBreaker.lastFailure = 0
    circuitBreaker.isOpen = false
  }

  /** Obtener estado actual del circuit breaker (para health checks). */
  static getCircuitBreakerStatus(): { isOpen: boolean; failures: number; lastFailure: number } {
    return { ...circuitBreaker }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
