export interface CertificadoDigital {
  id: string
  medicoId: string
  archivo: string // Base64 del archivo .p12
  password: string // Encriptado
  fechaCarga: Date
  fechaVencimiento: Date
  titular: string
  ruc: string
  estado: "activo" | "vencido" | "revocado"
  huella: string // Fingerprint del certificado
}

export interface ConfiguracionSRI {
  id: string
  medicoId: string
  ambiente: "pruebas" | "produccion"
  ruc: string
  razonSocial: string
  nombreComercial?: string
  direccionMatriz: string
  contribuyenteEspecial?: string
  obligadoContabilidad: boolean
  certificadoId: string
  configuracionEmail: {
    servidor: string
    puerto: number
    usuario: string
    password: string
    ssl: boolean
  }
  ultimaActualizacion: Date
}

export interface FacturaElectronica {
  infoTributaria: {
    ambiente: number
    tipoEmision: number
    razonSocial: string
    nombreComercial?: string
    ruc: string
    claveAcceso: string
    codDoc: string
    estab: string
    ptoEmi: string
    secuencial: string
    dirMatriz: string
  }
  infoFactura: {
    fechaEmision: string
    dirEstablecimiento: string
    contribuyenteEspecial?: string
    obligadoContabilidad: string
    tipoIdentificacionComprador: string
    razonSocialComprador: string
    identificacionComprador: string
    direccionComprador: string
    totalSinImpuestos: number
    totalDescuento: number
    propina?: number
    importeTotal: number
    moneda: string
    pagos: Array<{
      formaPago: string
      total: number
      plazo?: number
      unidadTiempo?: string
    }>
  }
  detalles: Array<{
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
  infoAdicional?: Array<{
    nombre: string
    valor: string
  }>
}
