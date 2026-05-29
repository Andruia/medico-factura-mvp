# CONTEXTO TÉCNICO: INTEGRACIÓN CON SISTEMA FACTURACIÓN SRI - ECUADOR

## 📋 Resumen Ejecutivo

**Proyecto:** Conectar facturador avanzado (REST) con Web Services SOAP del SRI (Sistema de Facturación Electrónica)

**Estado Actual:** Sistema generador de XML + Firma XAdES-BES funcional. Problema: No recibe aprobación del SRI en ambiente de pruebas.

**Plataforma SRI:** Ecuador - Método offline (claveAcceso = número autorización automático)

---

## 🔌 Arquitectura de Integración Requerida

```
┌─────────────────────────────────────────────────────────────┐
│                  FACTURADOR (REST API)                      │
│            - Generación XML                                 │
│            - Firma XAdES-BES                                │
│            - Gestión de comprobantes                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ├─→ WRAPPER/GATEWAY (Este proyecto)
                         │   - Traduce REST a SOAP
                         │   - Maneja asincronía
                         │   - Reintentos y errores
                         │
                         └─→ WEB SERVICES SRI (SOAP 1.1)
                             - RecepcionComprobantesOffline
                             - AutorizacionComprobantesOffline
                             - ConsultaComprobante
```

---

## 📡 Endpoints SRI Críticos

### Ambiente de PRUEBAS (Testing):
```
RECEPCIÓN:    https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
AUTORIZACIÓN: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
CONSULTA:     https://celcer.sri.gob.ec/comprobantes-electronicos-ws/ConsultaComprobante?wsdl
```

### Ambiente de PRODUCCIÓN:
```
RECEPCIÓN:    https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
AUTORIZACIÓN: https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
CONSULTA:     https://cel.sri.gob.ec/comprobantes-electronicos-ws/ConsultaComprobante?wsdl
```

---

## 🔄 Flujo Correcto de Autorización (CRÍTICO)

El SRI es **ASÍNCRONO**. Esto NO se puede saltear:

### Paso 1: RECEPCIÓN (Sincrónico)
```
POST /RecepcionComprobantesOffline
INPUT:  { xml: <Buffer de XML firmado> }
OUTPUT: { 
  estado: "RECIBIDA",      ← Comprobante fue recibido
  comprobantes: []         ← Si hay errores, los lista aquí
}
```

### Paso 2: ESPERAR (OBLIGATORIO - 2-5 segundos MÍNIMO)
```javascript
// El SRI procesa en background
// Tu aplicación DEBE esperar
await sleep(parseInt(process.env.TIEMPO_ESPERA_SRI || 3000));
```

### Paso 3: AUTORIZACIÓN (Asincrónico)
```
POST /AutorizacionComprobantesOffline
INPUT:  { claveAccesoComprobante: "0503201201176001321000110010030009900641234567814" }
OUTPUT: {
  claveAccesoConsultada: "050320120117600132100011001003000990064123456781",
  numeroComprobantes: 1,
  autorizaciones: [{
    estado: "AUTORIZADO",            ← ¡ESTO ES LO QUE ESPERAS!
    numeroAutorizacion: "...",
    fechaAutorizacion: "2012-03-05T16:57:34.997-05:00",
    ambiente: "PRUEBAS",
    comprobante: "<![CDATA[...]]>"   ← XML autorizado firmado
    mensajes: [...]
  }]
}
```

**POSIBLES ESTADOS:**
- `AUTORIZADO`: ✅ Éxito, factura válida
- `RECHAZADO`: ❌ Errores de validación
- `PPR` (En Procesamiento): ⏳ Aún procesando, reintentar en 5 seg

---

## 🔑 Clave de Acceso (49 dígitos) - ESTRUCTURA CRÍTICA

La clave de acceso ES el número de autorización en modo offline:

```
Posición   Tipo        Formato      Descripción
────────────────────────────────────────────────
1-8        Numérico    ddmmaaaa     Fecha emisión (05032012)
9-10       Tabla 3     01-07        Tipo comprobante (01=Factura)
11-23      RUC         1760013210001 RUC emisor (13 dígitos)
24         Tabla 4     1 o 2        Ambiente (1=Pruebas, 2=Producción)
25-30      Numérico    001001       Serie (estab 001 + punto emisión 001)
31-39      Numérico    000000001    Secuencial (9 dígitos)
40-47      Numérico    00000001     Código numérico (8 dígitos, definido por emisor)
48         Tabla 2     1            Tipo emisión (siempre 1 = normal)
49         Numérico    (verificador) Dígito verificador (Módulo 11)
```

**VALIDACIÓN MÓDULO 11:**
```javascript
function calcularModulo11(cadena48Digitos) {
  const factores = [3, 2, 7, 6, 5, 4, 3, 2]; // Se repite
  let suma = 0;
  
  for (let i = 0; i < 48; i++) {
    const factor = factores[i % 8];
    suma += parseInt(cadena48Digitos[i]) * factor;
  }
  
  let digito = 11 - (suma % 11);
  if (digito === 11) digito = 0;
  if (digito === 10) digito = 1;
  
  return digito; // Este debe ser el dígito 49
}
```

---

## 📄 Tipos de Comprobantes Permitidos

| Código | Tipo | Requisitos Especiales |
|--------|------|----------------------|
| 01 | **Factura** | Estándar, puede tener ítems múltiples |
| 03 | Liquidación Compra | Solo para compras a personas naturales sin RUC |
| 04 | Nota de Crédito | Modifica factura anterior (requiere referencia) |
| 05 | Nota de Débito | Aumenta monto de factura anterior (requiere referencia) |
| 06 | Guía de Remisión | Documento de transporte (transportista + placa) |
| 07 | Comprobante de Retención | Retenciones de IVA, IR, ISD |

---

## 🔐 Firma Electrónica (XAdES-BES) - ESPECIFICACIONES

**Estándar:** XAdES-BES (XML Advanced Electronic Signature)
**Versión:** 1.3.2
**Tipo:** ENVELOPED (firma dentro del XML mismo)
**Algoritmo:** RSA-SHA1
**Longitud Clave:** 2048 bits
**Formato:** PKCS#12 (.p12)

**ESTRUCTURA REQUERIDA:**
```xml
<factura id="comprobante" version="1.0.0">
  <!-- CONTENIDO COMPLETO -->
</factura>

<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" 
             xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" 
             Id="Signature620397">
  
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
    
    <!-- Referencia a SignedProperties (propiedades de firma) -->
    <ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#...">
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>...</ds:DigestValue>
    </ds:Reference>
    
    <!-- Referencia a certificado -->
    <ds:Reference URI="#Certificate...">
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>...</ds:DigestValue>
    </ds:Reference>
    
    <!-- Referencia al documento (factura) -->
    <ds:Reference URI="#comprobante">
      <ds:Transforms>
        <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
      </ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>...</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  
  <ds:SignatureValue Id="SignatureValue398963">
    [VALOR CIFRADO CON LLAVE PRIVADA]
  </ds:SignatureValue>
  
  <ds:KeyInfo Id="Certificate1562780">
    <ds:X509Data>
      <ds:X509Certificate>
        [CERTIFICADO EN BASE64]
      </ds:X509Certificate>
    </ds:X509Data>
    <ds:KeyValue>
      <ds:RSAKeyValue>
        <ds:Modulus>...</ds:Modulus>
        <ds:Exponent>AQAB</ds:Exponent>
      </ds:RSAKeyValue>
    </ds:KeyValue>
  </ds:KeyInfo>
  
  <ds:Object>
    <etsi:QualifyingProperties Target="#Signature620397">
      <etsi:SignedProperties>
        <etsi:SignedSignatureProperties>
          <etsi:SigningTime>2012-03-05T16:57:32-05:00</etsi:SigningTime>
          <etsi:SigningCertificate>
            <etsi:Cert>
              <etsi:CertDigest>
                <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                <ds:DigestValue>...</ds:DigestValue>
              </etsi:CertDigest>
              <etsi:IssuerSerial>
                <ds:X509IssuerName>...</ds:X509IssuerName>
                <ds:X509SerialNumber>...</ds:X509SerialNumber>
              </etsi:IssuerSerial>
            </etsi:Cert>
          </etsi:SigningCertificate>
        </etsi:SignedSignatureProperties>
      </etsi:SignedProperties>
    </etsi:QualifyingProperties>
  </ds:Object>
</ds:Signature>
```

**LIBRERÍAS RECOMENDADAS:**
- Node.js: `xmldsig`, `@digitalbazaar/xmldsig`
- Python: `zeep` (para SOAP) + `signxml`
- Java: Spring Web Services (soporte SOAP nativo)

---

## ❌ Errores Comunes y Soluciones

### Error 2: RUC del emisor NO ACTIVO
**Causa:** RUC inactivo, clausurado o sin autenticación
**Solución:** Verificar estado en www.sri.gob.ec > Catastros RUC

### Error 35: DOCUMENTO INVÁLIDO
**Causa:** XML malformado o no válido según XSD
**Solución:** Validar XML contra esquema publicado por SRI

### Error 37: RUC sin autorización de emisión
**Causa:** Contribuyente no ha solicitado certificación en SRI
**Solución:** Ingresar a servicios en línea del SRI y solicitar autorización

### Error 39: Firma inválida
**Causa:** Firma XAdES-BES malformada o certificado expirado
**Solución:** Usar herramienta XOLIDOSIGN para validar firma

### Error 40: Error en el certificado
**Causa:** Certificado X509 no es válido, está revocado o expirado
**Solución:** Renovar certificado digital ante entidad certificadora autorizada

### Error 43: Clave acceso registrada
**Causa:** Ya existe un comprobante con esta clave de acceso
**Solución:** Generar nueva clave (cambiar secuencial o código numérico)

### Error 52: Error en diferencias
**Causa:** Cálculos de IVA, subtotales o totales incorrectos
**Solución:** Validar fórmulas: subtotal + IVA = total

---

## 💰 Cálculos de Impuestos (CRITICALES)

### IVA (Impuesto al Valor Agregado)
```
Tarifas vigentes (2025):
- 0%:  Exportaciones, servicios en exterior
- 5%:  Algunos bienes de consumo básico
- 12%: Tarifa general (predeterminada)
- 14%: Algunos servicios
- 15%: Consumos especiales, algunos bienes

Fórmula:
IVA = SubtotalGravado × Tarifa / 100
Total = Subtotal + IVA + OtrosImpuestos - Descuentos + Propina
```

### ICE (Impuesto a Consumos Especiales)
```
Aplica a: Cigarrillos, bebidas alcohólicas, vehículos, etc.
Se calcula ANTES del IVA
IVA se aplica SOBRE (Subtotal + ICE)
```

### ISD (Impuesto a la Salida de Divisas)
```
Tasa actual (2025): 5% (sujeto a cambios)
Se aplica a transferencias al exterior
```

### IRBPNR (Impuesto a Régimen Simplificado)
```
Solo aplica a régimen simplificado (RISE)
Se configura por producto
```

---

## 📊 Formato XML Versiones

### Versión 1.0.0 (DEPRECATED)
- Decimales en cantidad/precio: Máximo 2
- Válida pero no recomendada

### Versión 1.1.0 (RECOMENDADA)
- Decimales en cantidad/precio: Hasta 6
- Mejor para productos con medidas variables

### Versión 2.0.0+
- Incluye rubros de terceros
- Factura sustitutiva de guía remisión
- Para comprobantes especiales

---

## 🏢 Tipos de Contribuyentes y Requisitos Especiales

| Tipo | Etiqueta XML | Requisitos |
|------|--------------|-----------|
| Contribuyente Normal | (ninguna) | Básico |
| Contribuyente Especial | `<contribuyenteEspecial>` | Número resolución |
| Agente de Retención | `<agenteRetencion>` | Número resolución |
| RIMPE | `<contribuyenteRimpe>` | Leyenda obligatoria |
| Gran Contribuyente | En infoAdicional | Leyenda + número resolución |
| Máquina Fiscal | `<maquinaFiscal>` | Marca, modelo, serie |

---

## 📱 Contacto SRI para Soporte

**Centro de Atención Telefónica:** 1700 774 774
**Portal Web:** www.sri.gob.ec
**Servicios en Línea:** https://servicios.sri.gob.ec
**Catastro RUC:** https://www.sri.gob.ec/web/guest/catastros

**Horario:** Lunes a viernes, 8:30-17:00 (Horario Ecuador)

---

## 🔧 Stack Técnico Recomendado

### Node.js/JavaScript
```json
{
  "soap": "^0.15.0",
  "xmldsig": "^1.2.0",
  "xml2js": "^0.4.23",
  "fast-xml-parser": "^4.1.2",
  "axios": "^1.3.0"
}
```

### Python
```
zeep==4.2.0          # Cliente SOAP
signxml==2.10.0      # Firmas XML
lxml==4.9.0          # Procesamiento XML
requests==2.28.0
```

### Variables de Entorno
```bash
# SRI Configuration
SRI_WSDL_RECEPCION=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_WSDL_AUTORIZACION=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
SRI_AMBIENTE=PRUEBAS  # o PRODUCCION

# Timing
TIEMPO_ESPERA_SRI=3000    # ms entre recepción y autorización
TIMEOUT_SRI=30000         # ms timeout máximo
REINTENTOS_SRI=3

# Certificado
RUTA_CERTIFICADO=./certs/empresa.p12
PASSWORD_CERTIFICADO=tuPassword123

# Proxy (si es necesario)
HTTP_PROXY=
HTTPS_PROXY=
```

---

## 📝 Checklist de Implementación

- [ ] RUC verificado y activo en SRI
- [ ] Certificado digital válido y no expirado
- [ ] XML generado válido según XSD
- [ ] Firma XAdES-BES correctamente implementada
- [ ] Clave de acceso con dígito verificador correcto
- [ ] Recepción devuelve estado "RECIBIDA"
- [ ] Espera implementada (mínimo 2-5 segundos)
- [ ] Autorización devuelve estado "AUTORIZADO"
- [ ] Comprobante autorizado firmado por SRI
- [ ] Notificación a cliente por email
- [ ] Logging y auditoría implementado
- [ ] Reintentos en caso de error 70 (en procesamiento)
- [ ] Manejo de errores según Tabla 11 (códigos error)
- [ ] Pruebas en ambiente PRUEBAS completadas
- [ ] Migración a PRODUCCION

---

## 📚 Referencias Documentales

- Ficha Técnica SRI: `FICHA_TÉCNICA_COMPROBANTES_ELECTRÓNICOS_ESQUEMA_OFFLINE_Versión_2.32.pdf`
- XSD Esquemas: Disponibles en portal SRI
- Estándar XAdES-BES: http://uri.etsi.org/01903/v1.3.2/ts_101903v010302p.pdf
- RFC 2313 (RSA): http://www.ietf.org/rfc/rfc2313.txt

---

## 🎯 Próximos Pasos (Para Antigravity)

1. Revisar esta documentación antes de cualquier sesión
2. Solicitar detalles específicos del error actual (respuesta SRI, logs, etc.)
3. Implementar script de diagnóstico proporcionado
4. Ajustar tiempo de espera según respuesta del SRI
5. Validar firma electrónica con herramientas externas
6. Contactar SRI si error persiste (código 37, 39, 40)

---

**Última actualización:** Febrero 2025
**Estado del documento:** ACTIVO
**Mantener actualizado:** Cada cambio de versión SRI
