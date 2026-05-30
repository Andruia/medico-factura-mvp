# Implementación del Fiscal Adapter – Documentación Técnica

## Tabla de Contenidos

1. [Arquitectura de la Solución](#arquitectura-de-la-solución)
2. [Auditoría de Seguridad: Gestión de Certificados](#auditoría-de-seguridad)
3. [Componentes Implementados](#componentes-implementados)
4. [Diagramas de Secuencia](#diagramas-de-secuencia)
5. [Configuración y Despliegue](#configuración-y-despliegue)
6. [Feature Flags y Rollback](#feature-flags-y-rollback)
7. [Troubleshooting](#troubleshooting)
8. [Changelog](#changelog)

---

## Arquitectura de la Solución

### Antes (Monolítico)

```
Server Action → BackgroundProcessor → XMLGenerator → CertificateManager (XAdES) → SOAP directo al SRI
```

**Problemas:**
- Firma XAdES-BES + envío SOAP > 10s → timeouts en serverless
- ~400 líneas de complejidad criptográfica en `certificate-manager.ts`
- Parsing XML de respuestas SOAP con regex (frágil)
- Código duplicado entre `checkReceivedInvoices` y `consultarEstadoFacturaAction`

### Después (Adapter Pattern)

```
Server Action → DB (PENDIENTE_ENVIO)
                    ↓
Cron → BackgroundProcessor → FiscalMapper → FiscalAdapter → API Externa NestJS → SRI
```

**Beneficios:**
- Firma y envío delegados a la API externa (sin timeouts serverless)
- Separación de responsabilidades limpia
- Error handling clasificado (retriable vs terminal)
- Circuit breaker para resiliencia
- Feature flag para rollback instantáneo

---

## Auditoría de Seguridad

### Gestión de Certificados .p12: Opción A vs Opción B

#### Opción A: Enviar certificado base64 en cada request

| Criterio | Evaluación |
|----------|------------|
| **Seguridad** | ⚠️ Media – El certificado viaja en cada request HTTP. Mitigado con TLS obligatorio y JWT auth. |
| **Performance** | ⚠️ Media – Overhead de ~5-20KB por request (tamaño típico .p12). Aceptable para volumen bajo (<100 facturas/día). |
| **Escalabilidad** | ✅ Alta – No requiere setup previo en la API. Cada médico puede empezar a facturar inmediatamente. |
| **Compliance** | ⚠️ Media – El certificado pasa por la red en cada transacción. Requiere TLS 1.2+ obligatorio. |
| **Simplicidad** | ✅ Alta – No se duplica almacenamiento. Los certificados ya están en `MedicoProfile.firmaElectronicaPath`. |
| **Disponibilidad** | ✅ Alta – No depende de estado previo en la API (stateless). |

#### Opción B: Subir certificado una vez a la API, usar ID de referencia

| Criterio | Evaluación |
|----------|------------|
| **Seguridad** | ✅ Alta – El certificado solo viaja una vez (upload). Requests posteriores solo envían el ID. |
| **Performance** | ✅ Alta – Requests ligeros (sin base64 del .p12). |
| **Escalabilidad** | ⚠️ Media – Requiere flujo de onboarding: upload → vincular a emisor → facturar. |
| **Compliance** | ✅ Alta – Minimiza tránsito del certificado. La API gestiona el ciclo de vida. |
| **Simplicidad** | ⚠️ Media – Requiere sincronizar certificados entre MVP y API. |
| **Disponibilidad** | ⚠️ Media – Si la API pierde el certificado, el médico no puede facturar hasta re-subir. |

### Recomendación

**Fase 1 (MVP): Opción A** (certificado en cada request)
- Permite arrancar sin modificar la API externa ni el flujo de onboarding
- Aceptable para el volumen esperado (<50 médicos, <100 facturas/día)
- Feature flag `FISCAL_SEND_CERT_IN_REQUEST=true`

**Fase 2 (Producción escalada): Migrar a Opción B**
- Cuando se establezca el flujo de onboarding de emisores en la API
- El adapter ya soporta ambos modos via feature flag
- La API externa ya tiene `POST /certificates/upload-cert` con binding a emisor

### Mitigaciones de seguridad implementadas

1. **TLS obligatorio**: La API debe estar detrás de HTTPS (validar en `fiscal-config.ts`)
2. **JWT auth**: Cada request requiere token válido
3. **Desencriptación just-in-time**: El password del .p12 se desencripta solo en `fiscal-mapper.ts`
4. **No logging de secrets**: El adapter nunca loguea certificados ni passwords
5. **Circuit breaker**: Evita enviar certificados a una API potencialmente comprometida

---

## Componentes Implementados

### `lib/sri/fiscal-types.ts`
Tipos TypeScript centralizados:
- Enums SRI (Ambiente, TipoEmision, TipoIdentificacion, FormaPago, etc.)
- Interfaces de payloads de la API externa (conformes a DTOs NestJS)
- Interfaces de respuestas
- Tipos internos del adapter (FiscalAdapterResult, FiscalError, etc.)
- Feature flags type

### `lib/sri/fiscal-adapter.ts`
Adapter principal con:
- **Autenticación JWT** con cache en memoria + renovación anticipada (60s margen)
- **`emitirFactura()`**: POST /sri/emitir/factura con retry exponential backoff
- **`consultarAutorizacion()`**: GET /sri/autorizar/:claveAcceso
- **Circuit breaker**: Se abre tras N fallos consecutivos, half-open tras timeout
- **Clasificación de errores**: 
  - Retriable: timeout, red, 5xx, 429, 401
  - Terminal: 4xx (datos inválidos), RECHAZADO por SRI
- **Logging estructurado**: timestamp, nivel, módulo, acción, metadata

### `lib/sri/fiscal-mapper.ts`
Función pura de mapeo:
- `mapFacturaToApiPayload()`: Prisma → CreateFacturaDto de la API NestJS
- Validación pre-envío con **Zod** (RUC, establecimiento, items, etc.)
- Cálculo de impuestos totalizados por tarifa
- Resolución de códigos SRI (tipoIdentificación, codigoPorcentaje, formaPago)
- Manejo seguro de Prisma Decimals

### `lib/config/fiscal-config.ts`
Configuración centralizada:
- Validación lazy de variables de entorno
- Cache de configuración en memoria
- Feature flags con defaults seguros
- Resumen de config sin credenciales (para logs)

### `lib/sri/background-processor.ts` (refactorizado)
Cambios principales:
- Integra `FiscalAdapter` y `mapFacturaToApiPayload`
- **Feature flag**: switch entre API externa y legacy
- **Pessimistic locking** mejorado (no cambia estado prematuro a RECIBIDO_SRI)
- **Retry inteligente**: errores retriable → PENDIENTE_ENVIO, terminal → RECHAZADO
- **Legacy preservado**: lógica original disponible via `FISCAL_USE_EXTERNAL_API=false`
- Imports dinámicos para XAdES/SOAP solo cuando se usa legacy (tree-shaking)

### `app/medico/facturacion/actions-facturacion.ts` (mejorado)
- Imports limpios (eliminados XMLGenerator, SRIClient, axios, https)
- Tipos explícitos en parámetros de `emitirFacturaAction`
- Error handling mejorado (P2002, validación de items)
- `consultarEstadoFacturaAction` usa FiscalAdapter cuando `useFiscalAPI=true`
- `revalidatePath` ampliado a `/medico/facturacion`

### `prisma/schema.prisma` (optimizado)
- `Factura.mensajeError`: `@db.Text` para mensajes largos del SRI
- `Factura.xmlPath`: `@db.Text` para XML completos
- `Factura.retryCount` + `Factura.lastRetryAt`: tracking de reintentos
- Índices compuestos: `[estado, createdAt]`, `[estado, updatedAt]`, `[userId, estado]`, `[userId, fechaEmision]`

---

## Diagramas de Secuencia

### Flujo Normal (API Externa)

```
┌──────────┐  ┌──────┐  ┌────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐  ┌─────┐
│  Médico  │  │  DB  │  │  Cron  │  │Processor │  │ Adapter  │  │  API  │  │ SRI │
└────┬─────┘  └──┬───┘  └───┬────┘  └────┬─────┘  └────┬─────┘  └──┬────┘  └──┬──┘
     │           │           │            │             │            │          │
     │──emitir──▶│           │            │             │            │          │
     │           │──create───│            │             │            │          │
     │           │ PENDIENTE │            │             │            │          │
     │◀──ok──────│           │            │             │            │          │
     │           │           │            │             │            │          │
     │           │           │──trigger──▶│             │            │          │
     │           │           │            │──lock──────▶│            │          │
     │           │           │            │             │            │          │
     │           │           │            │──map───────▶│            │          │
     │           │           │            │             │──auth─────▶│          │
     │           │           │            │             │◀──JWT──────│          │
     │           │           │            │             │──emitir───▶│──SOAP──▶│
     │           │           │            │             │            │◀────────│
     │           │           │            │             │◀──result───│          │
     │           │           │            │◀──result────│            │          │
     │           │◀──update──│            │             │            │          │
     │           │AUTORIZADO │            │             │            │          │
```

### Flujo con Error Retriable

```
Processor ──▶ Adapter ──▶ API ──▶ TIMEOUT
                               ◀── error(retriable=true)
         ◀── result(retriable=true)
         ──▶ DB: estado = PENDIENTE_ENVIO  ← retry en próximo ciclo del cron
```

### Flujo con Error Terminal

```
Processor ──▶ Adapter ──▶ API ──▶ 400 Bad Request
                               ◀── error(retriable=false)
         ◀── result(estado=RECHAZADO)
         ──▶ DB: estado = RECHAZADO, mensajeError = "..."
```

### Circuit Breaker

```
Fallo 1..4 ──▶ circuitBreaker.failures++
Fallo 5    ──▶ circuitBreaker.isOpen = true
                ↓
Siguiente request ──▶ CircuitBreakerOpenError (no llama a API)
                       ↓
60s después ──▶ Half-open: permite 1 intento
                ├── Éxito ──▶ Reset
                └── Fallo ──▶ Abierto de nuevo
```

---

## Configuración y Despliegue

### 1. Variables de entorno

Copiar `.env.example` a `.env` y configurar:

```bash
# Obligatorias para la API fiscal
FISCAL_API_BASE_URL="https://api-fiscal.tu-dominio.com"
FISCAL_API_EMAIL="admin@tuempresa.com"
FISCAL_API_PASSWORD="tu-password-seguro"
```

### 2. Migración de base de datos

```bash
npx prisma migrate dev --name add-factura-indexes-retry
```

### 3. Verificar build

```bash
npm run build
```

### 4. Despliegue gradual (recomendado)

1. Desplegar con `FISCAL_USE_EXTERNAL_API=false` (usa legacy)
2. Verificar que todo funciona como antes
3. Cambiar a `FISCAL_USE_EXTERNAL_API=true`
4. Monitorear logs del adapter
5. Si hay problemas, volver a `false` instantáneamente

### 5. Cron Job

El endpoint `/api/cron/process-sri` debe invocarse cada 2-5 minutos:
- **Vercel**: Cron en `vercel.json`
- **Railway**: Worker process o cron externo
- **Upstash QStash**: Webhook HTTP

---

## Feature Flags y Rollback

| Variable | Default | Descripción |
|----------|---------|-------------|
| `FISCAL_USE_EXTERNAL_API` | `true` | API externa vs legacy local |
| `FISCAL_SEND_CERT_IN_REQUEST` | `true` | Opción A vs Opción B |
| `FISCAL_ENABLE_CIRCUIT_BREAKER` | `true` | Circuit breaker on/off |
| `FISCAL_VERBOSE_LOGGING` | `false` | Logs detallados (debug) |

**Rollback instantáneo**: Cambiar `FISCAL_USE_EXTERNAL_API=false` en las variables de entorno del hosting. No requiere deploy nuevo.

---

## Troubleshooting

### "Variables de entorno faltantes: FISCAL_API_BASE_URL..."
**Causa**: No se configuraron las variables de la API fiscal.
**Solución**: Copiar `.env.example` a `.env` y configurar. Si usas legacy (`FISCAL_USE_EXTERNAL_API=false`), estas variables no son necesarias.

### "Circuit breaker abierto"
**Causa**: La API fiscal falló 5+ veces consecutivas.
**Solución**: 
1. Verificar que la API esté corriendo (`curl API_URL/status`)
2. El circuit breaker se re-abre automáticamente tras 60s
3. Para reset manual: restart del proceso Next.js

### "Error de autenticación: 401"
**Causa**: Credenciales incorrectas o token expirado.
**Solución**: Verificar `FISCAL_API_EMAIL` y `FISCAL_API_PASSWORD`. El adapter re-autentica automáticamente.

### "MappingValidationError: RUC debe tener 13 dígitos"
**Causa**: El perfil del médico tiene un RUC inválido.
**Solución**: Corregir en la UI de configuración del médico.

### "Error de conexión con API fiscal: ECONNREFUSED"
**Causa**: La API no está accesible.
**Solución**: Verificar URL y que la API esté desplegada. Si es temporal, el sistema reintentará automáticamente.

### Facturas quedaron en PENDIENTE_ENVIO sin procesarse
**Causa posible**: El cron no está corriendo o el circuit breaker está abierto.
**Diagnóstico**:
```sql
SELECT estado, COUNT(*), MAX("updatedAt") 
FROM "Factura" 
GROUP BY estado;
```

---

## Changelog

### v2.0.0 – Fiscal Adapter (2026-05-29)

#### Nuevos archivos
- `lib/sri/fiscal-types.ts` – Tipos centralizados
- `lib/sri/fiscal-adapter.ts` – Adapter con circuit breaker y retry
- `lib/sri/fiscal-mapper.ts` – Mapper con validación Zod
- `lib/config/fiscal-config.ts` – Configuración centralizada
- `.env.example` – Template de variables de entorno
- `docs/FISCAL_ADAPTER_IMPLEMENTATION.md` – Esta documentación

#### Archivos modificados
- `lib/sri/background-processor.ts` – Refactorizado con feature flag
- `app/medico/facturacion/actions-facturacion.ts` – Imports y error handling mejorados
- `prisma/schema.prisma` – Índices + campos retryCount/lastRetryAt

#### Archivos preservados (sin cambios)
- `lib/sri/certificate-manager.ts` – Mantiene `decryptPassword` y `validateCertificate`
- `lib/sri/xml-generator.ts` – Preservado para fallback legacy
- `lib/sri/sri-client.ts` – Preservado para fallback legacy
- `lib/sri/clave-acceso.ts` – Sin cambios (sigue usándose en actions)
- `lib/sri/types.ts` – Sin cambios (tipos internos)
- `lib/sri/validation.ts` – Sin cambios
- `app/api/cron/process-sri/route.ts` – Sin cambios (interfaz pública no cambió)

#### Justificación técnica
| Cambio | Razón |
|--------|-------|
| Patrón Adapter | Desacoplar firma/envío de la lógica de negocio |
| Feature flag | Zero-downtime rollback sin deploy |
| Circuit breaker | Prevenir cascada de fallos cuando API está caída |
| Retry con backoff | Manejar errores transitorios (red, timeouts) |
| Zod validation | Validar payload antes de enviar (fail fast) |
| Índices en schema | Optimizar queries del cron (FOR UPDATE SKIP LOCKED) |
| Legacy preservado | Rollback instantáneo cambiando variable de entorno |
