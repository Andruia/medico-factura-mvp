import type { NotificacionPaciente } from "./types"

type EventHandler = (...args: any[]) => void

export class WebSocketClient {
  private eventHandlers: Map<string, EventHandler[]> = new Map()
  private connectionState: "disconnected" | "connecting" | "connected" | "error" = "disconnected"
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null

  constructor(
    private namespace: string,
    private token: string,
    private onStateChange?: (state: string) => void,
  ) { }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      this.connectionState = "connecting"
      this.onStateChange?.("connecting")

      // Simular conexión
      setTimeout(() => {
        this.connectionState = "connected"
        this.onStateChange?.("connected")
        this.reconnectAttempts = 0
        this.startHeartbeat()

        // console.log(`✅ Conectado a ${this.namespace}`)
        resolve()
      }, 1000)
    })
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      // Simular heartbeat
      if (Math.random() > 0.95) {
        // 5% chance de desconexión simulada
        this.simulateDisconnection()
      }
    }, 30000)
  }

  private simulateDisconnection(): void {
    // console.log(`❌ Desconectado de ${this.namespace}`)
    this.connectionState = "disconnected"
    this.onStateChange?.("disconnected")

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    this.attemptReconnection()
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // console.error("❌ Máximo de intentos de reconexión alcanzado")
      this.connectionState = "error"
      this.onStateChange?.("error")
      return
    }

    this.reconnectAttempts++
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1)

    // console.log(
    //   `🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    // )

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)?.push(handler)
  }

  emit(event: string, data?: any): void {
    if (this.connectionState === "connected") {
      // console.log(`📤 Emitiendo evento: ${event}`, data)

      // Simular respuesta del servidor
      setTimeout(() => {
        this.simulateServerResponse(event, data)
      }, 100)
    } else {
      // console.warn(`⚠️ Intento de emit en socket desconectado: ${event}`)
    }
  }

  private simulateServerResponse(event: string, data: any): void {
    // Simular respuestas del servidor basadas en el evento
    switch (event) {
      case "solicitar_pacientes_pendientes":
        this.triggerEvent("pacientes_pendientes", this.generateMockPatients())
        break
      case "validar_paciente":
        this.triggerEvent("paciente_validado", { success: true, pacienteId: data.pacienteId })
        break
      case "procesar_factura":
        this.triggerEvent("factura_procesada", {
          success: true,
          numeroFactura: `001-001-${Math.floor(Math.random() * 999999)
            .toString()
            .padStart(6, "0")}`,
          facturaId: data.facturaId,
        })
        break
    }
  }

  private triggerEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(data))
    }
  }

  private generateMockPatients(): NotificacionPaciente[] {
    return [
      {
        id: "1",
        pacienteId: "pac-001",
        medicoId: "1",
        tipo: "nuevo_paciente",
        datos: {
          nombres: "María",
          apellidos: "González",
          email: "maria@email.com",
        },
        timestamp: new Date(),
      },
    ]
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.connectionState = "disconnected"
    this.onStateChange?.("disconnected")
  }

  getConnectionState(): string {
    return this.connectionState
  }
}
