import { format } from "date-fns"

export class ClaveAccesoGenerator {
    /**
     * Genera la Clave de Acceso de 49 dígitos requerida por el SRI
     * Formato:
     * - Fecha Emisión (8 dígitos)
     * - Tipo Comprobante (2 dígitos)
     * - RUC (13 dígitos)
     * - Tipo Ambiente (1 dígito)
     * - Serie (Estab + PtoEmi) (6 dígitos)
     * - Secuencial (9 dígitos)
     * - Código Numérico (8 dígitos)
     * - Tipo Emisión (1 dígito)
     * - Dígito Verificador (1 dígito - Modulo 11)
     */
    static generate(
        fechaEmision: Date,
        tipoComprobante: string, // "01" Factura, etc
        ruc: string,
        ambiente: "1" | "2", // 1: Pruebas, 2: Producción
        serie: string, // "001001"
        secuencial: string, // "000000001"
        codigoNumerico: string, // Aleatorio 8 dígitos
        tipoEmision: "1" = "1" // Normal
    ): string {
        const fecha = format(fechaEmision, "ddMMyyyy") // 8

        // Validaciones básicas
        if (ruc.length !== 13) throw new Error("RUC debe tener 13 dígitos")
        if (serie.length !== 6) throw new Error("Serie debe tener 6 dígitos (Estab+PtoEmi)")
        if (secuencial.length !== 9) throw new Error("Secuencial debe tener 9 dígitos")
        if (codigoNumerico.length !== 8) throw new Error("Código numérico debe tener 8 dígitos")

        const claveBase = `${fecha}${tipoComprobante}${ruc}${ambiente}${serie}${secuencial}${codigoNumerico}${tipoEmision}`

        const digitoVerificador = this.calcularDigitoVerificador(claveBase)

        return `${claveBase}${digitoVerificador}`
    }

    /**
     * Algoritmo de Módulo 11 para obtener dígito verificador y la suma ponderada
     */
    private static calcularDigitoVerificador(claveBase: string): number {
        let factor = 2
        let suma = 0

        // Recorrer la cadena de derecha a izquierda
        for (let i = claveBase.length - 1; i >= 0; i--) {
            suma += parseInt(claveBase.charAt(i), 10) * factor
            factor++
            if (factor > 7) factor = 2
        }

        const modulo = 11 - (suma % 11)

        if (modulo === 11) return 0
        if (modulo === 10) return 1
        return modulo
    }
}
