/**
 * fiscal-config.ts
 * 
 * Configuración centralizada para la integración fiscal.
 * Valida variables de entorno en runtime y proporciona defaults seguros.
 * 
 * @module fiscal-config
 */

import type { FiscalAdapterConfig, FiscalFeatureFlags } from "@/lib/sri/fiscal-types"

// ============================================================================
// Validación de variables de entorno
// ============================================================================

class FiscalConfigError extends Error {
  constructor(message: string) {
    super(`[FiscalConfig] ${message}`)
    this.name = "FiscalConfigError"
  }
}

/**
 * Variables de entorno requeridas para la integración fiscal.
 * Se validan lazy (en primera invocación) para no romper el build
 * si el módulo fiscal no se usa.
 */
const REQUIRED_ENV_VARS = [
  "FISCAL_API_BASE_URL",
  "FISCAL_API_EMAIL",
  "FISCAL_API_PASSWORD",
] as const

/**
 * Valida que todas las variables de entorno requeridas estén presentes.
 * Lanza error descriptivo si falta alguna.
 */
function validateEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new FiscalConfigError(
      `Variables de entorno faltantes: ${missing.join(", ")}. ` +
      `Consulta .env.example para ver la configuración requerida.`
    )
  }
}

// ============================================================================
// Configuración del Adapter
// ============================================================================

let _cachedConfig: FiscalAdapterConfig | null = null

/**
 * Obtiene la configuración del adapter fiscal.
 * Se cachea en memoria tras la primera validación exitosa.
 * 
 * @throws FiscalConfigError si faltan variables de entorno
 */
export function getFiscalAdapterConfig(): FiscalAdapterConfig {
  if (_cachedConfig) return _cachedConfig

  validateEnvVars()

  _cachedConfig = {
    apiBaseUrl: process.env.FISCAL_API_BASE_URL!.replace(/\/+$/, ""), // Elimina trailing slash
    email: process.env.FISCAL_API_EMAIL!,
    password: process.env.FISCAL_API_PASSWORD!,
    timeoutMs: parseInt(process.env.FISCAL_API_TIMEOUT_MS || "30000", 10),
    maxRetries: parseInt(process.env.FISCAL_API_MAX_RETRIES || "3", 10),
    retryBaseDelayMs: parseInt(process.env.FISCAL_API_RETRY_BASE_DELAY_MS || "1000", 10),
    circuitBreakerThreshold: parseInt(process.env.FISCAL_API_CB_THRESHOLD || "5", 10),
    circuitBreakerResetMs: parseInt(process.env.FISCAL_API_CB_RESET_MS || "60000", 10),
  }

  return _cachedConfig
}

// ============================================================================
// Feature Flags
// ============================================================================

let _cachedFlags: FiscalFeatureFlags | null = null

/**
 * Obtiene los feature flags de la integración fiscal.
 * Permite rollback instantáneo sin deploy cambiando variables de entorno.
 */
export function getFiscalFeatureFlags(): FiscalFeatureFlags {
  if (_cachedFlags) return _cachedFlags

  _cachedFlags = {
    useFiscalAPI: process.env.FISCAL_USE_EXTERNAL_API !== "false",
    sendCertificateInRequest: process.env.FISCAL_SEND_CERT_IN_REQUEST !== "false",
    enableCircuitBreaker: process.env.FISCAL_ENABLE_CIRCUIT_BREAKER !== "false",
    verboseLogging: process.env.FISCAL_VERBOSE_LOGGING === "true",
  }

  return _cachedFlags
}

// ============================================================================
// Utilidades
// ============================================================================

/**
 * Invalida la configuración cacheada.
 * Útil para testing o cuando se recargan variables de entorno dinámicamente.
 */
export function invalidateFiscalConfig(): void {
  _cachedConfig = null
  _cachedFlags = null
}

/**
 * Resumen de configuración (sin credenciales) para logging/debug.
 */
export function getFiscalConfigSummary(): Record<string, unknown> {
  try {
    const config = getFiscalAdapterConfig()
    const flags = getFiscalFeatureFlags()
    return {
      apiBaseUrl: config.apiBaseUrl,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      circuitBreakerThreshold: config.circuitBreakerThreshold,
      circuitBreakerResetMs: config.circuitBreakerResetMs,
      flags,
    }
  } catch {
    return { error: "Configuración no disponible (variables faltantes)" }
  }
}
