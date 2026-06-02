# medico-factura-mvp — AGENTS.md

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | `next build` (TS + ESLint errors suprimidos en config) |
| `npm test` | Jest (ts-jest, node env) |
| `npm run lint` | `next lint` |

## Estructura del proyecto

- **`app/`** — Next.js App Router (páginas, layouts, API routes, server actions)
- **`lib/`** — Prisma client, lógica SRI (firma, XML, adapter fiscal), config
- **`src/`** — Clases estilo NestJS (`@Injectable`, `@nestjs/testing`). Solo las usan los tests. NO es un servidor NestJS en ejecución
- **`components/`** — shadcn/ui; `@/components/ui/*` resuelve desde la raíz del proyecto

## Estado Actual

El ecosistema de pruebas existe pero es frágil. `src/modules/` contiene servicios NestJS incompletos que dependen de entidades TypeORM que nunca fueron creadas (`PatientRequest`, `MedicoProfile`). El test existente pasa usando:
- `jest.mock()` hoisted para interceptar módulos con imports rotos
- Stubs locales (`abstract class`) para tokens de DI que no existen en el código real
- String tokens (`'PatientRequestRepository'`, `'FiscalAdapter'`, `'CORRELATION_ID'`) en vez de class tokens para evitar resolver dependencias TypeORM

`scratch/` contiene un proyecto NestJS ajeno que fue excluido de Jest con `testPathIgnorePatterns`.

## Arquitectura de Pruebas

**Config**: Jest + ts-jest + node environment. El `moduleNameMapper` redirige `@/modules/(.*)` a `src/modules/$1` y `@/(.*)` a `src/$1`.

**Inyección de dependencias**: `@nestjs/testing` crea un módulo NestJS en memoria. Cada dependencia externa se reemplaza con un mock manual:

```
Test.createTestingModule({
  providers: [
    FiscalOrchestrator,                          // clase bajo prueba
    { provide: 'PatientRequestRepository', ... }, // string token
    { provide: AuditLogger, ... },                // class token con useValue
    { provide: 'FiscalAdapter', ... },            // string token
    { provide: CertificatePreflightValidator, ... }, // class token (jest.mock)
    { provide: 'CORRELATION_ID', ... },           // string token
  ],
})
```

**Patrón de mocks**: Cada mock se declara como `jest.Mocked<T>` con `as unknown as` para evitar checks de tipo estrictos. El mock de `PatientRequestRepository` usa `Object.assign` interno para que `findOneOrFail` refleje los cambios de `update`.

**Hoisting**: `jest.mock('@/modules/fiscal/services/...')` se coloca antes de los `import` para que Jest intercepte el módulo antes de que Node resuelva sus imports internos (que apuntan a entidades TypeORM inexistentes).

## Reglas de Oro

### Alias `@/`

- **Runtime (Next.js)**: `@/` apunta a la **raíz del proyecto** → `@/lib/prisma` = `lib/prisma.ts`
- **Jest**: `@/` apunta a `src/` → `@/modules/...` = `src/modules/...`, pero `@/lib/...` falla porque `src/lib/` no existe
- **tsconfig.json**: declara `@/* -> src/*` solo para el IDE; el bundler lo ignora
- No importar nada de `app/` o `lib/` desde `src/modules/` — esas rutas no existen para Jest

### Jerarquía `src/modules/`

```
src/modules/
  facturacion/services/   → FiscalOrchestrator (orquestador bajo prueba)
  fiscal/
    services/             → CertificatePreflightValidator (valida certificados localmente)
    errors/               → CertificateValidationError
  logging/                → AuditLogger + AuditLog entity (única entidad TypeORM que existe)
  database/entities/      → No existe en el repositorio actual
  resilience/             → MacroFailureRecoveryService
```

Los imports relativos entre módulos deben mantenerse dentro de `src/`. Preferir `@/modules/...` sobre rutas relativas cuando sea posible.

### Uso de decoradores NestJS en `src/`

- `experimentalDecorators: true` está habilitado porque TypeORM 1.0 no soporta los decoradores nativos de ES (stage 3)
- Preferir `@Inject('STRING_TOKEN')` sobre `@InjectRepository(Entity)` o class tokens cuando la entidad no existe como archivo real
- TypeORM `@InjectRepository('string')` con string no funciona en `@nestjs/typeorm` v11 (genera el token `undefinedRepository` al hacer `entity.name` sobre un string)

## Deuda Técnica

- **`src/modules/` sin entidades TypeORM**: Servicios como `CertificatePreflightValidator` importan entidades (`PatientRequest`, `MedicoProfile`) que nunca fueron creadas como archivos. Cualquier test que instancie el validador real (en vez de mockearlo) fallará
- **Sin `TypeOrmModule.forRoot()`**: No hay configuración de conexión a DB para TypeORM. El stack ORM en `src/` está a medio camino entre TypeORM y Prisma
- **Capa duplicada**: `src/` (NestJS) y `app/` + `lib/` (Next.js) implementan lógica similar (firma, envío SRI) sin tipos compartidos. Si `FiscalOrchestrator` necesita correr en producción, requiere adaptación
- **Sin cobertura mínima**: No hay thresholds en Jest ni integración con CI
- **Mock vs stub**: El test usa `jest.mock()` para interceptar módulos con imports rotos. Esto oculta errores de compilación que deberían resolverse en el código fuente (entidades faltantes, imports incorrectos)

## Auth

- NextAuth v5 beta, Credentials provider + PrismaAdapter, JWT sessions
- Roles: `MEDICO` y `FACTURADOR` (enum Prisma `Role`)
- Dev auto-seed: login como `medico@demo.com` / `demo123` crea el usuario + `MedicoProfile` si no existe
- `auth.config.ts` — guardias de ruta (`authorized` callback + propagación de role en JWT)
- `app/lib/actions.ts` — server action `authenticate()` que envuelve `signIn('credentials', ...)`
- Middleware: `middleware.ts` usa el matcher de NextAuth (excluye `/api`, `_next/static`, `_next/image`, `.png`)

## Base de datos

- PostgreSQL vía `DATABASE_URL`
- Schema Prisma: `prisma/schema.prisma` (12 modelos: User, MedicoProfile, PuntoEmisionConfig, Paciente, Factura + relacionados, ProductoServicio, AtencionMedica, y tablas de NextAuth)
- Client singleton: `lib/prisma.ts` (cache globalThis en dev)

## Integración SRI / Fiscal

**Dual mode** (env var `FISCAL_USE_EXTERNAL_API`):
- `true` (default): `BackgroundProcessor` → `FiscalMapper` → `FiscalAdapter` (HTTP a API NestJS externa)
- `false`: Firma XAdES-BES local + SOAP directo a SRI

**Archivos clave** (todo en `lib/sri/`):
- `background-processor.ts` — orquesta ciclos de envío+consulta; usa `FOR UPDATE SKIP LOCKED` (lote de 3)
- `fiscal-adapter.ts` — adapter HTTP con cache JWT, circuit breaker, retry con exponential backoff, clasificación de errores
- `fiscal-mapper.ts` — modelos Prisma → payload API, validación Zod, IVA por tarifa
- `certificate-manager.ts` — firma XAdES-BES (node-forge + xadesjs + @peculiar/webcrypto)
- `xml-generator.ts` — generación de XML compatible con SRI
- `clave-acceso.ts` — clave de acceso de 49 dígitos con Módulo 11
- `ride-generator.tsx` — componente React-PDF para el RIDE

**Proxy SOAP** (legacy): `app/api/sri/enviar/route.ts` y `app/api/sri/consultar/route.ts` — reenvían XML firmado, `rejectUnauthorized: false`

## Cron / Background processor

- Endpoint: `GET /api/cron/process-sri` (POST también aceptado)
- Llama a `BackgroundProcessor.processAllPending()`
- `CRON_SECRET` existe como env var pero **no se verifica** en la ruta — la autenticación debe agregarse o asegurarse a nivel de infraestructura
- Máquina de estados de Factura: `BORRADOR → PENDIENTE_ENVIO → RECIBIDO_SRI → AUTORIZADO` (con ramas `RECHAZADO`, `ERROR`, `DEVUELTA`)

## Config & env

- `.env.example` documenta todas las vars requeridas (DB, NextAuth, encryption key, API fiscal, feature flags)
- Feature flags manejadas por env vars, rollback zero-deploy:
  - `FISCAL_USE_EXTERNAL_API`, `FISCAL_SEND_CERT_IN_REQUEST`, `FISCAL_ENABLE_CIRCUIT_BREAKER`, `FISCAL_VERBOSE_LOGGING`
- `ENCRYPTION_KEY` — clave AES-CBC de 32 caracteres para cifrado de contraseña .p12

## Package manager

Existen `pnpm-lock.yaml` y `package-lock.json` (artefacto de migración). No hay campo `packageManager` en `package.json`. Usar `pnpm`.

## Next.js config quirks

`next.config.mjs`:
- `eslint.ignoreDuringBuilds: true` — el build no falla por errores de ESLint
- `typescript.ignoreBuildErrors: true` — el build no falla por errores de TS
- `allowedDevOrigins: ["192.168.2.12:3000", "192.168.2.12:3001", ...]` — acceso LAN por IP local
