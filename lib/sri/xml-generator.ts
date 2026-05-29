import { format } from "date-fns"

interface FacturaData {
    infoTributaria: {
        ambiente: "1" | "2" // 1: Pruebas, 2: Producción
        tipoEmision: "1" // 1: Normal
        razonSocial: string
        nombreComercial?: string
        ruc: string
        claveAcceso: string // 49 dígitos
        codDoc: "01" // 01: Factura
        estab: string // 001
        ptoEmi: string // 001
        secuencial: string // 000000001
        dirMatriz: string
    }
    infoFactura: {
        fechaEmision: string // dd/mm/aaaa
        dirEstablecimiento: string
        obligadoContabilidad: "SI" | "NO"
        tipoIdentificacionComprador: "04" | "05" | "06" | "07" | "08" // 05: Cedula, 04: RUC
        razonSocialComprador: string
        identificacionComprador: string
        totalSinImpuestos: number
        totalDescuento: number
        totalImpuestos: {
            codigo: "2" // IVA
            codigoPorcentaje: "0" | "2" | "3" // 0: 0%, 2: 12%, 3: 14% (variable)
            baseImponible: number
            tarifa: number
            valor: number
        }[]
        importeTotal: number
        moneda: "DOLAR"
        pagos: {
            formaPago: string // 01: Sin utilización del sistema financiero
            total: number
            plazo?: number
            unidadTiempo?: string
        }[]
    }
    detalles: {
        codigoPrincipal: string
        descripcion: string
        cantidad: number
        precioUnitario: number
        descuento: number
        precioTotalSinImpuesto: number
        impuestos: {
            codigo: "2"
            codigoPorcentaje: string
            tarifa: number
            baseImponible: number
            valor: number
        }[]
    }[]
    infoAdicional?: {
        nombre: string
        valor: string
    }[]
}

export class XMLGenerator {
    static generateFacturaXML(data: FacturaData): string {
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
    <infoTributaria>
        <ambiente>${data.infoTributaria.ambiente}</ambiente>
        <tipoEmision>${data.infoTributaria.tipoEmision}</tipoEmision>
        <razonSocial>${this.escapeXml(data.infoTributaria.razonSocial)}</razonSocial>
        ${data.infoTributaria.nombreComercial ? `<nombreComercial>${this.escapeXml(data.infoTributaria.nombreComercial)}</nombreComercial>` : ''}
        <ruc>${data.infoTributaria.ruc}</ruc>
        <claveAcceso>${data.infoTributaria.claveAcceso}</claveAcceso>
        <codDoc>${data.infoTributaria.codDoc}</codDoc>
        <estab>${data.infoTributaria.estab}</estab>
        <ptoEmi>${data.infoTributaria.ptoEmi}</ptoEmi>
        <secuencial>${data.infoTributaria.secuencial}</secuencial>
        <dirMatriz>${this.escapeXml(data.infoTributaria.dirMatriz)}</dirMatriz>
    </infoTributaria>
    <infoFactura>
        <fechaEmision>${data.infoFactura.fechaEmision}</fechaEmision>
        <dirEstablecimiento>${this.escapeXml(data.infoFactura.dirEstablecimiento)}</dirEstablecimiento>
        <obligadoContabilidad>${data.infoFactura.obligadoContabilidad}</obligadoContabilidad>
        <tipoIdentificacionComprador>${data.infoFactura.tipoIdentificacionComprador}</tipoIdentificacionComprador>
        <razonSocialComprador>${this.escapeXml(data.infoFactura.razonSocialComprador)}</razonSocialComprador>
        <identificacionComprador>${data.infoFactura.identificacionComprador}</identificacionComprador>
        <totalSinImpuestos>${data.infoFactura.totalSinImpuestos.toFixed(2)}</totalSinImpuestos>
        <totalDescuento>${data.infoFactura.totalDescuento.toFixed(2)}</totalDescuento>
        <totalConImpuestos>
            ${data.infoFactura.totalImpuestos.map(imp => `
            <totalImpuesto>
                <codigo>${imp.codigo}</codigo>
                <codigoPorcentaje>${imp.codigoPorcentaje}</codigoPorcentaje>
                <baseImponible>${imp.baseImponible.toFixed(2)}</baseImponible>
                <tarifa>${imp.tarifa.toFixed(2)}</tarifa>
                <valor>${imp.valor.toFixed(2)}</valor>
            </totalImpuesto>
            `).join('')}
        </totalConImpuestos>
        <propina>0.00</propina>
        <importeTotal>${data.infoFactura.importeTotal.toFixed(2)}</importeTotal>
        <moneda>${data.infoFactura.moneda}</moneda>
        <pagos>
            ${data.infoFactura.pagos.map(pago => `
            <pago>
                <formaPago>${pago.formaPago}</formaPago>
                <total>${pago.total.toFixed(2)}</total>
                ${pago.plazo ? `<plazo>${pago.plazo}</plazo>` : ''}
                ${pago.unidadTiempo ? `<unidadTiempo>${pago.unidadTiempo}</unidadTiempo>` : ''}
            </pago>
            `).join('')}
        </pagos>
    </infoFactura>
    <detalles>
        ${data.detalles.map(det => `
        <detalle>
            <codigoPrincipal>${this.escapeXml(det.codigoPrincipal)}</codigoPrincipal>
            <descripcion>${this.escapeXml(det.descripcion)}</descripcion>
            <cantidad>${det.cantidad.toFixed(2)}</cantidad>
            <precioUnitario>${det.precioUnitario.toFixed(6)}</precioUnitario>
            <descuento>${det.descuento.toFixed(2)}</descuento>
            <precioTotalSinImpuesto>${det.precioTotalSinImpuesto.toFixed(2)}</precioTotalSinImpuesto>
            <impuestos>
                ${det.impuestos.map(imp => `
                <impuesto>
                    <codigo>${imp.codigo}</codigo>
                    <codigoPorcentaje>${imp.codigoPorcentaje}</codigoPorcentaje>
                    <tarifa>${imp.tarifa.toFixed(2)}</tarifa>
                    <baseImponible>${imp.baseImponible.toFixed(2)}</baseImponible>
                    <valor>${imp.valor.toFixed(2)}</valor>
                </impuesto>
                `).join('')}
            </impuestos>
        </detalle>
        `).join('')}
    </detalles>
    ${data.infoAdicional ? `
    <infoAdicional>
        ${data.infoAdicional.map(info => `
        <campoAdicional nombre="${this.escapeXml(info.nombre)}">${this.escapeXml(info.valor)}</campoAdicional>
        `).join('')}
    </infoAdicional>
    ` : ''}
</factura>`;

        return xmlContent.replace(/\r/g, '').replace(/>\s+</g, '><').replace(/<\s+/g, '<').trim();
    }

    private static escapeXml(unsafe: string): string {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }
}
