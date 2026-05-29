import { CertificateManager } from "./certificate-manager"
import type { EmitirFacturaPayload } from "./fiscal-adapter"

// ============================================================================
// Tipos de entrada – Modelos Prisma con relaciones incluidas
// ============================================================================

/**
 * Tipo que representa la factura con TODAS las relaciones que carga
 * BackgroundProcessor en su query (include: paciente, items, formasPago,
 * infoAdicional, user.medicoProfile).
 * 
 * Se define aquí en vez de importar de Prisma para:
 * 1. Desacoplar el mapper del ORM (testeable con objetos planos).
 * 2. Documentar explícitamente qué campos se consumen.
 */
export interface FacturaConRelaciones {
    id: string
    secuencial: string
    claveAcceso: string | null
    fechaEmision: Date
    subtotal: any  // Prisma Decimal
    iva: any       // Prisma Decimal
    total: any     // Prisma Decimal
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
        cantidad: any      // Prisma Decimal
        precioUnitario: any // Prisma Decimal
        descuento: any      // Prisma Decimal
        ivaTarifa: number
    }>
    formasPago: Array<{
        codigo: string
        total: any          // Prisma Decimal
        plazo?: number | null
        unidadTiempo?: string | null
    }>
    infoAdicional: Array<{
        nombre: string
        valor: string
    }>
}

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
// Mapper
// ============================================================================

/**
 * Convierte el modelo Prisma (Factura con relaciones + MedicoProfile)
 * al payload que espera la API fiscal externa.
 * 
 * Decisiones de diseño:
 * - Es una función PURA: recibe datos, devuelve payload. Sin side effects.
 * - Toda la lógica de cálculo de impuestos (totalización por tarifa)
 *   se extrae del antiguo generateAndSignXML de background-processor.ts.
 * - La desencriptación del password se hace aquí porque es el punto
 *   más cercano al consumo y evita pasar passwords en plano por más capas.
 * - Los Decimals de Prisma se convierten a Number explícitamente.
 */
export function mapFacturaToSriPayload(
    factura: FacturaConRelaciones,
    medico: MedicoProfileData
): EmitirFacturaPayload {

    // --- Cálculo de impuestos totalizados por tarifa ---
    // Replica exacta de la lógica de background-processor.ts L285-307
    const impuestosTotalizados = new Map<string, { baseImponible: number; valor: number }>()

    factura.items.forEach((item) => {
        const tarifa = item.ivaTarifa !== undefined ? item.ivaTarifa : 12
        const codigoPorcentaje = resolverCodigoPorcentaje(tarifa)

        const base = (Number(item.cantidad) * Number(item.precioUnitario)) - Number(item.descuento || 0)
        const impuesto = base * (tarifa / 100)

        const current = impuestosTotalizados.get(codigoPorcentaje) || { baseImponible: 0, valor: 0 }
        impuestosTotalizados.set(codigoPorcentaje, {
            baseImponible: current.baseImponible + base,
            valor: current.valor + impuesto
        })
    })

    const totalImpuestosArray = Array.from(impuestosTotalizados.entries()).map(([codigoPorcentaje, val]) => ({
        codigo: "2",  // IVA
        codigoPorcentaje,
        baseImponible: round2(val.baseImponible),
        tarifa: codigoPorcentaje === "0" ? 0 : (codigoPorcentaje === "4" ? 15 : 12),
        valor: round2(val.valor)
    }))

    // --- Mapeo de items ---
    const itemsMapped = factura.items.map((item) => {
        const tarifa = item.ivaTarifa !== undefined ? item.ivaTarifa : 12
        const codigoPorcentaje = resolverCodigoPorcentaje(tarifa)
        const baseImponible = (Number(item.cantidad) * Number(item.precioUnitario)) - Number(item.descuento || 0)
        const valorImpuesto = baseImponible * (tarifa / 100)

        return {
            codigoPrincipal: item.codigoPrincipal || "ITEM",
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            precioUnitario: Number(item.precioUnitario),
            descuento: Number(item.descuento || 0),
            precioTotalSinImpuesto: round2(baseImponible),
            impuestos: [{
                codigo: "2",
                codigoPorcentaje,
                tarifa,
                baseImponible: round2(baseImponible),
                valor: round2(valorImpuesto)
            }]
        }
    })

    // --- Mapeo de formas de pago ---
    const pagosMapped = factura.formasPago.map((p) => {
        const pago: { formaPago: string; total: number; plazo?: number; unidadTiempo?: string } = {
            formaPago: p.codigo,
            total: Number(p.total)
        }
        if (p.plazo && Number(p.plazo) > 0) {
            pago.plazo = Number(p.plazo)
            pago.unidadTiempo = p.unidadTiempo || "Dias"
        }
        return pago
    })

    // --- Fecha de emisión en formato dd/mm/yyyy ---
    const fechaEmision = factura.fechaEmision.toLocaleDateString("es-EC", {
        day: "2-digit", month: "2-digit", year: "numeric"
    })

    // --- Total de descuentos en items ---
    const totalDescuento = factura.items.reduce(
        (acc, item) => acc + Number(item.descuento || 0), 0
    )

    // --- Tipo de identificación SRI ---
    const tipoIdSri = resolverTipoIdentificacion(factura.paciente.tipoIdentificacion)

    // --- Desencriptar password del certificado ---
    const passwordPlano = CertificateManager.decryptPassword(medico.firmaPassword)

    // --- Ambiente normalizado ---
    const ambiente: "pruebas" | "produccion" = medico.ambiente?.toLowerCase() === "produccion"
        ? "produccion"
        : "pruebas"

    return {
        emisor: {
            ruc: medico.ruc,
            razonSocial: medico.razonSocial || medico.nombreComercial || "Médico",
            nombreComercial: medico.nombreComercial || undefined,
            direccionMatriz: medico.direccionMatriz || medico.direccion || "Matriz",
            direccionEstablecimiento: medico.direccion || undefined,
            obligadoContabilidad: medico.obligadoContabilidad ? "SI" : "NO",
            contribuyenteEspecial: medico.contribuyenteEspecial || undefined,
            establecimiento: medico.establecimiento || "001",
            puntoEmision: medico.puntoEmision || "001"
        },
        comprador: {
            tipoIdentificacion: tipoIdSri,
            identificacion: factura.paciente.numeroIdentificacion,
            razonSocial: factura.paciente.razonSocial,
            direccion: factura.paciente.direccion || undefined,
            email: factura.paciente.email || undefined,
            telefono: factura.paciente.telefono || undefined
        },
        factura: {
            secuencial: factura.secuencial,
            claveAcceso: factura.claveAcceso || "",
            fechaEmision,
            subtotal: Number(factura.subtotal),
            totalDescuento: round2(totalDescuento),
            totalImpuestos: totalImpuestosArray,
            importeTotal: Number(factura.total),
            moneda: "DOLAR",
            items: itemsMapped,
            pagos: pagosMapped,
            infoAdicional: factura.infoAdicional.length > 0
                ? factura.infoAdicional.map(ia => ({ nombre: ia.nombre.trim(), valor: ia.valor.trim() }))
                : undefined
        },
        certificado: {
            archivo: medico.firmaElectronicaPath,
            password: passwordPlano
        },
        ambiente
    }
}

// ============================================================================
// Helpers internos
// ============================================================================

/**
 * Resuelve el código de porcentaje SRI según la tarifa de IVA.
 * Catálogo actualizado SRI 2024: 0% → "0", 12% → "2", 14% → "3", 15% → "4"
 */
function resolverCodigoPorcentaje(tarifa: number): string {
    if (tarifa === 0) return "0"
    if (tarifa === 15) return "4"
    if (tarifa === 14) return "3"
    return "2"  // 12% por defecto
}

/**
 * Resuelve el tipo de identificación al código SRI.
 * "cedula"/"CEDULA" → "05", "ruc"/"RUC" → "04", "pasaporte"/"PASAPORTE" → "06"
 */
function resolverTipoIdentificacion(tipo: string): string {
    const normalized = (tipo || "").toLowerCase()
    if (normalized === "cedula" || normalized === "cédula") return "05"
    if (normalized === "ruc") return "04"
    if (normalized === "pasaporte") return "06"
    // Valores ya codificados ("04", "05", "06")
    if (["04", "05", "06", "07", "08"].includes(tipo)) return tipo
    return "05"  // Default a cédula
}

/**
 * Redondea a 2 decimales de forma segura (evita problemas de floating point).
 */
function round2(value: number): number {
    return Number(value.toFixed(2))
}
