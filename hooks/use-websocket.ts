"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { WebSocketClient } from "@/lib/websocket/websocket-client"

interface UseWebSocketOptions {
  namespace: string
  token: string
  autoConnect?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: any) => void
}

export function useWebSocket(options: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<string>("disconnected")
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<WebSocketClient | null>(null)
  const eventListenersRef = useRef<Map<string, Function[]>>(new Map())

  const handleStateChange = useCallback(
    (state: string) => {
      setConnectionState(state)
      setIsConnected(state === "connected")

      if (state === "connected") {
        setError(null)
        options.onConnect?.()
      } else if (state === "disconnected") {
        options.onDisconnect?.()
      } else if (state === "error") {
        setError("Error de conexión")
        options.onError?.(error)
      }
    },
    [options, error],
  )

  const connect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.connect()
      return
    }

    clientRef.current = new WebSocketClient(options.namespace, options.token, handleStateChange)

    // Registrar event listeners pendientes
    eventListenersRef.current.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        clientRef.current?.on(event, handler)
      })
    })

    try {
      await clientRef.current.connect()
    } catch (err) {
      setError("Error al conectar")
      options.onError?.(err)
    }
  }, [options, handleStateChange])

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }
  }, [])

  const emit = useCallback((event: string, data?: any) => {
    if (clientRef.current) {
      clientRef.current.emit(event, data)
    }
  }, [])

  const on = useCallback((event: string, handler: Function) => {
    if (!eventListenersRef.current.has(event)) {
      eventListenersRef.current.set(event, [])
    }
    eventListenersRef.current.get(event)?.push(handler)

    if (clientRef.current) {
      clientRef.current.on(event, handler)
    }
  }, [])

  useEffect(() => {
    if (options.autoConnect !== false) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [connect, disconnect, options.autoConnect])

  return {
    connectionState,
    isConnected,
    error,
    connect,
    disconnect,
    emit,
    on,
  }
}
