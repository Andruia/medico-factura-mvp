export interface ConfiguracionValidation {
  certificadosValidos: boolean
  configuracionSRICompleta: boolean
  conexionSRIActiva: boolean
  listo: boolean
  errores: string[]
}

export class ConfigurationValidator {
  static async validarConfiguracionCompleta(medicoId: string): Promise<ConfiguracionValidation> {
    const errores: string[] = []
    let certificadosValidos = false
    let configuracionSRICompleta = false
    let conexionSRIActiva = false

    try {
      // Validar certificados
      const certificados = localStorage.getItem(`certificados-medico-${medicoId}`)
      if (certificados) {
        const certs = JSON.parse(certificados)
        const certificadosActivos = certs.filter((c: any) => c.estado === "activo")

        if (certificadosActivos.length > 0) {
          // Verificar que no estén vencidos
          const ahora = new Date()
          const certificadosVigentes = certificadosActivos.filter((c: any) => new Date(c.fechaVencimiento) > ahora)

          if (certificadosVigentes.length > 0) {
            certificadosValidos = true
          } else {
            errores.push("Todos los certificados están vencidos")
          }
        } else {
          errores.push("No hay certificados activos")
        }
      } else {
        errores.push("No se han cargado certificados digitales")
      }

      // Validar configuración SRI
      const configSRI = localStorage.getItem(`configuracion-sri-${medicoId}`)
      if (configSRI) {
        const config = JSON.parse(configSRI)

        if (
          config.ruc &&
          config.razonSocial &&
          config.direccionMatriz &&
          config.certificadoId &&
          config.configuracionEmail?.usuario &&
          config.configuracionEmail?.password
        ) {
          configuracionSRICompleta = true
        } else {
          errores.push("Configuración SRI incompleta")
        }
      } else {
        errores.push("No se ha configurado la integración SRI")
      }

      // En un sistema real, aquí se haría una llamada al SRI para verificar conectividad
      // Por ahora asumimos que si la configuración está completa, la conexión es posible
      conexionSRIActiva = configuracionSRICompleta
    } catch (error) {
      errores.push("Error validando configuración: " + (error as Error).message)
    }

    const listo = certificadosValidos && configuracionSRICompleta && conexionSRIActiva

    return {
      certificadosValidos,
      configuracionSRICompleta,
      conexionSRIActiva,
      listo,
      errores,
    }
  }

  static async probarConexionSRI(ambiente: "pruebas" | "produccion"): Promise<boolean> {
    try {
      // En producción, aquí se haría una llamada real al SRI
      // Por ahora simulamos con un delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Simular 80% de éxito
      return Math.random() > 0.2
    } catch (error) {
      return false
    }
  }
}
