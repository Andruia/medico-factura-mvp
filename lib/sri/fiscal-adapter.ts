import axios, { AxiosError, AxiosInstance } from "axios"

// ============================================================================
// Tipos del Adapter
// ============================================================================

export interface FiscalAdapterConfig {
    apiBaseUrl: string
    username: string
    password: string
    timeoutMs: number
}

/**
 * Payload que envía nuestro sistema a la API fiscal externa.
 * El mapper (fiscal-mapper.ts) se encarga de construirlo desde Prisma.
 */
export interface EmitirFacturaPayload {
    emisor: {
        ruc: string
        razonSocial: string
        nombreComercial?: string
        direccionMatriz: string
        direccionEstablecimiento?: string
        obligadoContabilidad: "SI" | "NO"
        contribuyenteEspecial?: string
        establecimiento: string
        puntoEmision: string
    }
    comprador: {
        tipoIdentificacion: string  // "04" RUC, "05" Cédula, "06" Pasaporte
        identificacion: string
        razonSocial: string
        direccion?: string
        email?: string
        telefono?: string
    }
    factura: {
        secuencial: string
        claveAcceso: string
        fechaEmision: string        // dd/mm/yyyy
        subtotal: number
        totalDescuento: number
        totalImpuestos: Array<{
            codigo: string
            codigoPorcentaje: string
            baseImponible: number
            tarifa: number
            valor: number
        }>
        importeTotal: number
        moneda: string
        items: Array<{
            codigoPrincipal: string
            descripcion: string
            cantidad: number
            precioUnitario: number
            descuento: number
            precioTotalSinImpuesto: number
            impuestos: Array<{
                codigo: string
                codigoPorcentaje: string
                tarifa: number
                baseImponible: number
                valor: number
            }>
        }>
        pagos: Array<{
            formaPago: string
            total: number
            plazo?: number
            unidadTiempo?: string
        }>
        infoAdicional?: Array<{
            nombre: string
            valor: string
        }>
    }
    certificado: {
        archivo: string     // .p12 en base64
        password: string    // contraseña en texto plano (desencriptada antes de enviar)
    }
    ambiente: "pruebas" | "produccion"
}

/**
 * Resultado normalizado que devuelve el adapter.
 * `retriable` es la clave para que BackgroundProcessor decida:
 *   - true  → volver a PENDIENTE_ENVIO para retry en próximo ciclo
 *   - false → marcar como RECHAZADO (error terminal)
 */
export interface FiscalAdapterResult {
    success: boolean
    estado: "AUTORIZADO" | "RECHAZADO" | "RECIBIDO_SRI" | "ERROR"
    claveAcceso?: string
    numeroAutorizacion?: string
    fechaAutorizacion?: Date
    mensajes: string[]
    retriable: boolean
}

// ============================================================================
// Adapter
// ============================================================================

/**
 * FiscalAdapter – Patrón Adapter para la API fiscal externa (NestJS).
 * 
 * Decisiones de diseño:
 * 1. Token JWT se cachea en memoria del módulo con margen de 60s antes de expirar.
 *    En serverless esto implica que cada cold start re-autentica, lo cual es aceptable
 *    porque el cron corre cada pocos minutos y procesa un lote completo en una sola invocación.
 * 2. No hace retries internos: esa responsabilidad es de BackgroundProcessor,
 *    que ya tiene control de lotes y estados.
 * 3. Clasifica errores en retriable (red/timeout/5xx) vs terminal (4xx/RECHAZADO)
 *    para que el processor decida el estado final.
 */
export class FiscalAdapter {
    private static token: string | null = null
    private static tokenExpiry: number = 0
    private static client: AxiosInstance | null = null

    /**
     * Lee la configuración desde variables de entorno.
     * Se invoca de forma lazy para no fallar en import-time si las vars no existen.
     */
    private static getConfig(): FiscalAdapterConfig {
        const apiBaseUrl = process.env.FISCAL_API_BASE_URL
        const username = process.env.FISCAL_API_USERNAME
        const password = process.env.FISCAL_API_PASSWORD
        const timeoutMs = parseInt(process.env.FISCAL_API_TIMEOUT_MS || "30000", 10)

        if (!apiBaseUrl || !username || !password) {
            throw new Error(
                "[FiscalAdapter] Variables de entorno faltantes: FISCAL_API_BASE_URL, FISCAL_API_USERNAME, FISCAL_API_PASSWORD"
            )
        }

        return { apiBaseUrl, username, password, timeoutMs }
    }

    /**
     * Crea o reutiliza la instancia de axios con la config base.
     */
    private static getClient(): AxiosInstance {
        if (!this.client) {
            const config = this.getConfig()
            this.client = axios.create({
                baseURL: config.apiBaseUrl,
                timeout: config.timeoutMs,
                headers: { "Content-Type": "application/json" }
            })
        }
        return this.client
    }

    /**
     * Autentica contra la API externa y cachea el JWT.
     * El token se renueva 60s antes de expirar para evitar race conditions.
     */
    static async authenticate(): Promise<string> {
        const now = Date.now()

        // Reutilizar token vigente (con margen de 60s)
        if (this.token && this.tokenExpiry > now + 60_000) {
            return this.token
        }

        const config = this.getConfig()
        const client = this.getClient()

        try {
            console.log("[FiscalAdapter] Autenticando contra API fiscal externa...")

            const response = await client.post("/auth/login", {
                username: config.username,
                password: config.password
            })

            const { access_token, expires_in } = response.data

            if (!access_token) {
                throw new Error("Respuesta de autenticación no contiene access_token")
            }

            this.token = access_token
            // expires_in viene en segundos; convertimos a ms y restamos margen
            this.tokenExpiry = now + ((expires_in || 3600) * 1000)

            console.log("[FiscalAdapter] Autenticación exitosa. Token válido por ~" +
                Math.round((this.tokenExpiry - now) / 60000) + " minutos.")

            return access_token
        } catch (error) {
            // Invalidar token en caso de fallo
            this.token = null
            this.tokenExpiry = 0
            throw new Error(
                `[FiscalAdapter] Error de autenticación: ${(error as Error).message}`
            )
        }
    }

    /**
     * Envía la factura a la API fiscal externa para firma + envío al SRI.
     * 
     * NO hace retries internos. Devuelve `retriable: true` si el error
     * es transitorio (red, timeout, 5xx) para que el caller decida reintentar.
     */
    static async emitirFactura(payload: EmitirFacturaPayload): Promise<FiscalAdapterResult> {
        try {
            const token = await this.authenticate()
            const client = this.getClient()

            console.log(`[FiscalAdapter] Emitiendo factura ${payload.factura.secuencial} ` +
                `(RUC: ${payload.emisor.ruc}, ambiente: ${payload.ambiente})...`)

            const response = await client.post("/sri/factura/emitir", payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            const data = response.data

            // Normalizar la respuesta de la API externa al formato interno
            return this.normalizeResponse(data)

        } catch (error) {
            return this.handleError(error)
        }
    }

    /**
     * Normaliza la respuesta exitosa (2xx) de la API externa.
     * La API puede devolver 200 pero con estado RECHAZADO (error de negocio SRI),
     * por eso se inspecciona el campo `estado`.
     */
    private static normalizeResponse(data: any): FiscalAdapterResult {
        const estado = (data.estado || "").toUpperCase()
        const mensajes: string[] = []

        // Recopilar mensajes de la API (pueden venir en distintos formatos)
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
                mensajes,
                retriable: false
            }
        }

        if (estado === "RECIBIDA" || estado === "RECIBIDO_SRI" || estado === "EN PROCESAMIENTO") {
            return {
                success: true,
                estado: "RECIBIDO_SRI",
                claveAcceso: data.claveAcceso || undefined,
                mensajes: mensajes.length > 0 ? mensajes : ["Comprobante recibido por SRI, pendiente de autorización."],
                retriable: false
            }
        }

        // RECHAZADO, DEVUELTA, NO AUTORIZADO → error terminal de negocio
        return {
            success: false,
            estado: "RECHAZADO",
            mensajes: mensajes.length > 0 ? mensajes : ["Rechazado por el SRI"],
            retriable: false  // Error de negocio, no tiene sentido reintentar con los mismos datos
        }
    }

    /**
     * Clasifica errores de la llamada HTTP.
     * 
     * Errores retriable (el processor debe reintentar):
     *   - Timeout (ECONNABORTED, ETIMEDOUT)
     *   - Error de red (ECONNREFUSED, ENOTFOUND)
     *   - HTTP 5xx (server error de la API)
     *   - HTTP 429 (rate limiting)
     * 
     * Errores terminal (el processor debe marcar RECHAZADO):
     *   - HTTP 4xx (excepto 429): datos inválidos, no autorizado, etc.
     *   - Errores de parseo o estructura
     */
    private static handleError(error: unknown): FiscalAdapterResult {
        if (error instanceof AxiosError) {
            const status = error.response?.status
            const errorData = error.response?.data

            // Errores de red / timeout → retriable
            if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" ||
                error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" ||
                error.code === "ERR_NETWORK") {
                console.warn(`[FiscalAdapter] Error de red (${error.code}): ${error.message}`)
                return {
                    success: false,
                    estado: "ERROR",
                    mensajes: [`Error de conexión con API fiscal: ${error.code} - ${error.message}`],
                    retriable: true
                }
            }

            // HTTP 5xx o 429 → retriable
            if (status && (status >= 500 || status === 429)) {
                console.warn(`[FiscalAdapter] Error del servidor API (HTTP ${status})`)
                return {
                    success: false,
                    estado: "ERROR",
                    mensajes: [`Error del servidor API fiscal (HTTP ${status}): ${errorData?.message || error.message}`],
                    retriable: true
                }
            }

            // HTTP 401 → el token expiró, forzar re-auth en próximo intento
            if (status === 401) {
                this.token = null
                this.tokenExpiry = 0
                console.warn("[FiscalAdapter] Token expirado (401), se re-autenticará en el próximo intento.")
                return {
                    success: false,
                    estado: "ERROR",
                    mensajes: ["Token de autenticación expirado. Se reintentará con nuevo token."],
                    retriable: true
                }
            }

            // HTTP 4xx (excepto 401 y 429) → error terminal
            const apiMessage = errorData?.message || errorData?.error || error.message
            console.error(`[FiscalAdapter] Error de la API (HTTP ${status}): ${apiMessage}`)
            return {
                success: false,
                estado: "RECHAZADO",
                mensajes: [`Error API fiscal (HTTP ${status}): ${apiMessage}`],
                retriable: false
            }
        }

        // Error no-axios (inesperado) → retriable por precaución
        console.error("[FiscalAdapter] Error inesperado:", (error as Error).message)
        return {
            success: false,
            estado: "ERROR",
            mensajes: [`Error inesperado: ${(error as Error).message}`],
            retriable: true
        }
    }

    /**
     * Invalida el token en cache. Útil para testing o forzar re-auth.
     */
    static invalidateToken(): void {
        this.token = null
        this.tokenExpiry = 0
        this.client = null
    }
}
