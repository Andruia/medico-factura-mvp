# Auditoría de Seguridad: Gestión de Certificados .p12

**Fecha**: 2026-05-29  
**Auditor**: Implementación automatizada – Senior Full Stack Developer  
**Alcance**: Evaluación de opciones de transporte de certificados digitales .p12 entre el MVP (Next.js) y la API fiscal externa (NestJS)

---

## Resumen Ejecutivo

Se evaluaron dos opciones para gestionar los certificados de firma electrónica (.p12) en la comunicación entre el MVP y la API fiscal externa:

| | **Opción A: Base64 en cada request** | **Opción B: Upload único + ID referencia** |
|---|---|---|
| **Seguridad** | ⚠️ Media | ✅ Alta |
| **Performance** | ⚠️ Media | ✅ Alta |
| **Escalabilidad** | ✅ Alta | ⚠️ Media |
| **Complejidad** | ✅ Baja | ⚠️ Media |
| **Time-to-market** | ✅ Inmediato | ⚠️ Requiere setup |

**Recomendación**: **Opción A para MVP** con migración planificada a **Opción B** en producción escalada.

---

## Análisis Detallado

### Opción A: Certificado Base64 en cada request

#### Descripción
El certificado .p12 (ya almacenado como base64 en `MedicoProfile.firmaElectronicaPath`) se envía en el body de cada request POST a `/sri/emitir/factura` junto con la contraseña desencriptada.

#### Flujo
```
MVP → [HTTPS/TLS] → API NestJS
Body: {
  emisor: {...},
  certificado: { archivo: "base64...", password: "..." },
  ...
}
```

#### Análisis de riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Certificado interceptado en tránsito | Alta | TLS 1.2+ obligatorio. La API NestJS debe estar detrás de HTTPS. |
| Certificado en logs del servidor | Media | El adapter NO loguea el campo `certificado`. La API NestJS debe tener filtros de logging. |
| Certificado en memoria de la API | Baja | La API usa el certificado solo durante la firma y lo descarta. No se persiste en disco. |
| Password en texto plano en el body | Alta | La desencriptación AES-CBC se hace just-in-time en `fiscal-mapper.ts`. El password solo existe en memoria durante la request. |
| Replay attack | Baja | Cada request tiene JWT + datos únicos (claveAcceso). Sin embargo, un atacante con acceso al body podría reutilizar el certificado. |

#### Ventajas
1. **Zero setup**: No requiere registrar emisores ni subir certificados a la API
2. **Stateless**: Cada request es autónoma, no depende de estado previo en la API
3. **Consistencia**: La fuente de verdad del certificado es siempre la DB del MVP
4. **Recuperación**: Si la API pierde datos, no afecta porque el certificado viene en cada request

#### Desventajas
1. **Overhead de red**: ~10-20KB extra por request (tamaño típico .p12)
2. **Superficie de ataque**: El certificado viaja en cada transacción
3. **No cumple principio de mínimo privilegio**: La API recibe el certificado aunque ya lo tenga

---

### Opción B: Upload único + ID de referencia

#### Descripción
El certificado se sube UNA vez a la API via `POST /certificates/upload-cert` vinculado a un emisor (RUC). Las requests posteriores solo incluyen el RUC del emisor; la API busca el certificado en su DB.

#### Flujo
```
[Una vez] MVP → POST /certificates/upload-cert → API almacena .p12 encriptado en DB
[Cada factura] MVP → POST /sri/emitir/factura → API busca cert por RUC del emisor
```

#### Análisis de riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Certificado almacenado en dos sistemas | Media | La API encripta el .p12 con AES en `emisores.certificado_p12`. |
| Pérdida del certificado en la API | Media | Requiere flujo de re-upload si la DB de la API se pierde. |
| Sincronización de certificados | Media | Si se renueva el .p12 en el MVP, hay que re-subir a la API. |
| Acceso no autorizado al certificado almacenado | Media | La API valida tenant/RUC en cada operación. |

#### Ventajas
1. **Mínima superficie**: El certificado solo viaja una vez
2. **Requests ligeros**: Sin overhead de base64 en cada factura
3. **La API ya lo soporta**: `POST /certificates/upload-cert` con binding a emisor existe
4. **Audit trail**: La API trackea `certificado_updated_at` y puede alertar vencimientos

#### Desventajas
1. **Requiere onboarding**: Hay que crear el emisor y subir el certificado antes de facturar
2. **Estado compartido**: La API y el MVP deben estar sincronizados
3. **Single point of failure**: Si la API pierde el cert, el médico no puede facturar

---

## Evaluación de Compliance

### GDPR/Protección de datos personales
- Los certificados .p12 contienen datos personales del titular (nombre, RUC)
- **Opción A**: Datos en tránsito frecuente → requiere registro de tratamiento
- **Opción B**: Datos en reposo en dos sistemas → requiere cifrado en ambos

### PCI DSS (si aplica a pagos)
- No aplica directamente (certificados fiscales, no de pago)
- Sin embargo, los principios de seguridad de PCI son buenas prácticas

### Normativa SRI Ecuador
- El SRI no especifica requisitos sobre cómo se transportan los certificados entre sistemas propios
- El requisito es que la firma sea válida XAdES-BES con certificado vigente

---

## Recomendación Final

### Fase 1 – MVP (ahora)

**Implementar Opción A** con las siguientes mitigaciones:

1. ✅ TLS 1.2+ obligatorio (validar en configuración)
2. ✅ JWT authentication en cada request
3. ✅ Desencriptación just-in-time del password
4. ✅ No logging de certificados ni passwords
5. ✅ Circuit breaker (no enviar a API potencialmente comprometida)
6. ✅ Feature flag para rollback instantáneo

### Fase 2 – Producción (cuando la API esté estable)

**Migrar a Opción B**:
1. Crear flujo de onboarding: al configurar firma en el MVP, subir automáticamente a la API
2. Almacenar `certificadoExternalId` en MedicoProfile (referencia al cert en la API)
3. Eliminar envío de base64 en requests de facturación
4. Mantener Opción A como fallback en caso de desincronización

### Implementación del feature flag

```typescript
// Ya implementado en fiscal-config.ts
FISCAL_SEND_CERT_IN_REQUEST=true   // Opción A (default)
FISCAL_SEND_CERT_IN_REQUEST=false  // Opción B (futuro)
```

---

*Auditoría realizada como parte de la implementación del Fiscal Adapter Pattern. Documento de referencia: `docs/FISCAL_ADAPTER_IMPLEMENTATION.md`*
