export interface SocketUser {
  id: string
  tipo: "medico" | "facturador" | "administrador" | "paciente"
  medicoId?: string
  consultorioId?: string
  permisos: string[]
  ultimaActividad: Date
}

export interface NotificacionPaciente {
  id: string
  pacienteId: string
  medicoId: string
  tipo: "nuevo_paciente" | "datos_actualizados" | "validacion_pendiente"
  datos: any
  timestamp: Date
}

export interface CambioPrecio {
  servicioId: string
  precioAnterior: number
  precioNuevo: number
  motivo: string
  medicoId: string
  timestamp: Date
}

export interface EstadoFactura {
  facturaId: string
  pacienteId: string
  medicoId: string
  estado: "pendiente" | "procesando" | "completado" | "error"
  numeroFactura?: string
  timestamp: Date
}
