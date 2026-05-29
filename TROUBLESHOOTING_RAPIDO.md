# 🔧 TROUBLESHOOTING RÁPIDO - SRI Ecuador

## 🚨 PROBLEMA: No recibo aprobación del SRI

### Paso 1: Verificar Respuesta de Recepción (5 min)

```javascript
// Loguea EXACTAMENTE qué devuelve el SRI
console.log('RESPUESTA RECEPCIÓN:', JSON.stringify(respuestaRecepcion, null, 2));

// ✅ ESPERADO:
{
  estado: "RECIBIDA",
  comprobantes: []
}

// ❌ SI DICE "DEVUELTA":
{
  estado: "DEVUELTA",
  comprobantes: [{
    mensajes: [{
      identificador: 35,  // ← CÓDIGO DE ERROR
      mensaje: "DOCUMENTO INVÁLIDO",
      informacionAdicional: "..."
    }]
  }]
}
```

**Acción:** Si `estado !== "RECIBIDA"`, ve a "Tabla de Errores por Código"

---

### Paso 2: Verificar Tiempo de Espera (2 min)

```javascript
console.log('Tiempo espera actual:', process.env.TIEMPO_ESPERA_SRI || 'NO CONFIGURADO');

// ❌ PROBLEMAS COMUNES:
// - Espera = 0 ms (intentas autorizar inmediatamente)
// - Espera = 500 ms (muy rápido)
// - Espera = 1000 ms (marginal)

// ✅ VALORES RECOMENDADOS:
// - Pruebas rápidas: 3000 ms (3 seg)
// - Producción: 5000 ms (5 seg)
// - Conexión lenta: 10000 ms (10 seg)
```

**Acción:** 
```bash
export TIEMPO_ESPERA_SRI=5000
# Luego reinicia tu aplicación
```

---

### Paso 3: Validar Clave de Acceso (3 min)

```javascript
function validarClaveAcceso(clave) {
  console.log('=== VALIDACIÓN CLAVE DE ACCESO ===');
  console.log('Clave:', clave);
  
  // Check 1: Longitud
  if (clave.length !== 49) {
    console.error('❌ Longitud INCORRECTA:', clave.length, '(debe ser 49)');
    return false;
  }
  console.log('✅ Longitud: 49 dígitos');
  
  // Check 2: Solo dígitos
  if (!/^\d+$/.test(clave)) {
    console.error('❌ Contiene caracteres NO numéricos');
    return false;
  }
  console.log('✅ Solo dígitos');
  
  // Check 3: Desglose estructura
  console.log('\nESTRUCTURA:');
  console.log('Fecha:      ', clave.substring(0, 8), '(ddmmaaaa)');
  console.log('Tipo doc:   ', clave.substring(8, 10), '(01=Factura)');
  console.log('RUC:        ', clave.substring(10, 23), '(13 dígitos)');
  console.log('Ambiente:   ', clave.substring(23, 24), '(1=Pruebas, 2=Prod)');
  console.log('Serie:      ', clave.substring(24, 30), '(001001)');
  console.log('Secuencial: ', clave.substring(30, 39), '(9 dígitos)');
  console.log('Código:     ', clave.substring(39, 47), '(8 dígitos)');
  console.log('Tipo emisión:', clave.substring(47, 48), '(1=Normal)');
  console.log('Verificador:', clave.substring(48, 49), '(dígito mod11)');
  
  // Check 4: Dígito verificador (Módulo 11)
  const digitoCalculado = calcularModulo11(clave.substring(0, 48));
  const digitoReal = parseInt(clave.substring(48, 49));
  
  console.log('\n✅ Dígito verificador: Calculado=', digitoCalculado, ', Real=', digitoReal);
  
  if (digitoCalculado !== digitoReal) {
    console.error('❌ DÍGITO VERIFICADOR INCORRECTO!');
    console.error('   Esperado:', digitoCalculado);
    console.error('   Recibido:', digitoReal);
    return false;
  }
  console.log('✅ Dígito verificador VÁLIDO');
  
  return true;
}

function calcularModulo11(cadena48) {
  const factores = [3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  
  for (let i = 0; i < 48; i++) {
    const factor = factores[i % 8];
    suma += parseInt(cadena48[i]) * factor;
  }
  
  let digito = 11 - (suma % 11);
  if (digito === 11) digito = 0;
  if (digito === 10) digito = 1;
  
  return digito;
}

// USO:
validarClaveAcceso('0503201201176001321000110010030009900641234567814');
```

**Acción:** Si falla validación, regenera la clave con dígito verificador correcto

---

### Paso 4: Validar Firma XAdES-BES (5 min)

```javascript
function validarFirma(xmlFirmado) {
  console.log('=== VALIDACIÓN FIRMA XAdES-BES ===');
  
  const checks = [
    {
      name: 'Raíz <factura>',
      test: () => xmlFirmado.includes('<factura')
    },
    {
      name: 'ID="comprobante"',
      test: () => xmlFirmado.includes('id="comprobante"')
    },
    {
      name: 'Version 1.0.0 o 1.1.0',
      test: () => /version="1\.[01]\.0"/.test(xmlFirmado)
    },
    {
      name: '<ds:Signature>',
      test: () => xmlFirmado.includes('<ds:Signature')
    },
    {
      name: '<ds:SignedInfo>',
      test: () => xmlFirmado.includes('<ds:SignedInfo')
    },
    {
      name: '<ds:SignatureValue>',
      test: () => xmlFirmado.includes('<ds:SignatureValue')
    },
    {
      name: '<ds:KeyInfo>',
      test: () => xmlFirmado.includes('<ds:KeyInfo')
    },
    {
      name: '<X509Certificate>',
      test: () => xmlFirmado.includes('<ds:X509Certificate>')
    },
    {
      name: 'etsi:SignedProperties',
      test: () => xmlFirmado.includes('etsi:SignedProperties')
    },
    {
      name: 'etsi:SigningTime',
      test: () => xmlFirmado.includes('etsi:SigningTime')
    }
  ];
  
  let pasadasOK = 0;
  checks.forEach(check => {
    const result = check.test() ? '✅' : '❌';
    console.log(`${result} ${check.name}`);
    if (check.test()) pasadasOK++;
  });
  
  console.log(`\nResultado: ${pasadasOK}/${checks.length} validaciones pasadas`);
  
  if (pasadasOK < checks.length) {
    console.error('❌ LA FIRMA ESTÁ INCOMPLETA O MALFORMADA');
    console.error('   El SRI rechazará este comprobante');
    return false;
  }
  
  console.log('✅ FIRMA PARECE VÁLIDA');
  return true;
}

// USO:
const xmlFirmado = fs.readFileSync('factura-firmada.xml', 'utf8');
validarFirma(xmlFirmado);
```

**Acción:** Si falla, usar XOLIDOSIGN (herramienta online) para validar firma

---

### Paso 5: Verificar RUC (2 min)

```javascript
function verificarRUC(ruc) {
  console.log('=== VERIFICACIÓN RUC ===');
  console.log('RUC:', ruc);
  
  // Check 1: Formato
  if (ruc.length !== 13) {
    console.error('❌ RUC debe tener 13 dígitos, tiene:', ruc.length);
    return false;
  }
  console.log('✅ Longitud: 13 dígitos');
  
  if (!/^\d+$/.test(ruc)) {
    console.error('❌ RUC debe contener solo dígitos');
    return false;
  }
  console.log('✅ Solo dígitos');
  
  // Check 2: Debe terminar en 001 (tipo jurídico)
  if (!ruc.endsWith('001')) {
    console.warn('⚠️  RUC no termina en 001');
    console.warn('   Si es persona natural sin RUC, usar código 07');
  }
  console.log('✅ Formato RUC válido');
  
  // Check 3: ¿Está activo?
  console.log('\n⚠️  VERIFICAR MANUALMENTE EN: https://www.sri.gob.ec/web/guest/catastros');
  console.log('   Estado debe ser: ACTIVO');
  console.log('   Status debe ser: AL DÍA');
  
  return true;
}

// USO:
verificarRUC('1760013210001');
```

**Acción:** Si no está activo, contactar SRI (1700 774 774)

---

### Paso 6: Revisar Respuesta de Autorización (3 min)

```javascript
function analizarRespuestaAutorizacion(respuesta) {
  console.log('=== RESPUESTA AUTORIZACIÓN ===');
  console.log(JSON.stringify(respuesta, null, 2));
  
  try {
    const auth = respuesta.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion;
    
    if (!auth || auth.length === 0) {
      console.error('❌ NO HAY AUTORIZACIONES EN RESPUESTA');
      return;
    }
    
    const primera = Array.isArray(auth) ? auth[0] : auth;
    
    console.log('\n=== ANÁLISIS ===');
    console.log('Estado:', primera.estado);
    
    switch (primera.estado) {
      case 'AUTORIZADO':
        console.log('✅ ¡ÉXITO!');
        console.log('Número autorización:', primera.numeroAutorizacion);
        console.log('Fecha:', primera.fechaAutorizacion);
        console.log('Ambiente:', primera.ambiente);
        break;
        
      case 'RECHAZADO':
        console.error('❌ RECHAZADO');
        if (primera.mensajes?.mensaje) {
          const msgs = Array.isArray(primera.mensajes.mensaje) 
            ? primera.mensajes.mensaje 
            : [primera.mensajes.mensaje];
          
          msgs.forEach(msg => {
            console.error(`\nError ${msg.identificador}: ${msg.mensaje}`);
            console.error(`Info: ${msg.informacionAdicional}`);
          });
        }
        break;
        
      case 'PPR':
        console.warn('⏳ EN PROCESAMIENTO');
        console.warn('Reintentar en 5 segundos...');
        break;
        
      default:
        console.warn('❓ Estado desconocido:', primera.estado);
    }
    
  } catch (error) {
    console.error('Error parseando respuesta:', error.message);
  }
}

// USO:
analizarRespuestaAutorizacion(respuestaSRI);
```

---

## 📊 Tabla de Errores por Código

| Código | Error | Solución |
|--------|-------|----------|
| 2 | RUC NO ACTIVO | Activar RUC en SRI |
| 10 | Establecimiento clausurado | Contactar SRI |
| 26 | Tamaño archivo excedido | XML > 320KB, simplificar |
| 27 | Clase no permitida | RUC no autorizado para e-facturación |
| 28 | Acuerdo medios electrónicos no aceptado | Aceptar en servicios en línea SRI |
| 35 | Documento inválido | XML malformado, validar XSD |
| 36 | Versión esquema descontinuada | Usar versión 1.0.0 o 1.1.0 |
| 37 | RUC sin autorización emisión | Solicitar certificación en SRI |
| 39 | Firma inválida | Validar firma con XOLIDOSIGN |
| 40 | Error en certificado | Renovar certificado |
| 43 | Clave acceso registrada | Generar nueva clave (cambiar secuencial) |
| 45 | Secuencial registrado | Incrementar secuencial |
| 46 | RUC no existe | Verificar RUC en catastro |
| 47 | Tipo comprobante no existe | Verificar código (01, 04, 05, 06, 07) |
| 48 | Esquema XSD no existe | Descargar XSD actualizado de SRI |
| 49 | Argumentos nulos | No enviar parámetros vacíos |
| 50 | Error interno general | Reintentar o contactar SRI |
| 52 | Error en diferencias | Validar cálculos IVA/subtotales |
| 56 | Establecimiento cerrado | Reopener establecimiento o cambiar |
| 57 | Autorización suspendida | Contactar SRI (control) |
| 58 | Error estructura clave acceso | Regenerar clave correctamente |
| 63 | RUC clausurado | Contactar SRI |
| 65 | Fecha emisión extemporánea | Usar fecha actual, no futura |
| 67 | Fecha inválida | Formato debe ser ddmmaaaa |
| 70 | Clave en procesamiento | Esperamos (máximo 24 horas) |

---

## 🎯 Checklist Rápido

Cuando no funcione, ejecuta en orden:

```bash
# 1. Validar clave de acceso
node -e "require('./validar').claveAcceso('YOUR_CLAVE_HERE')"

# 2. Validar firma
node -e "require('./validar').firma(fs.readFileSync('factura.xml', 'utf8'))"

# 3. Validar RUC
node -e "require('./validar').ruc('1760013210001')"

# 4. Hacer prueba real
node script-diagnostico.js factura-firmada.xml

# 5. Si sigue fallando, contactar:
#    SRI: 1700 774 774
#    Portal: www.sri.gob.ec
```

---

## 📝 Logs Que Debes Capturar

Cuando reportes problema, incluye:

```
1. RESPUESTA RECEPCIÓN:
   - Estado (RECIBIDA, DEVUELTA?)
   - Código de error (si hay)
   - Mensaje exacto

2. TIEMPOS:
   - Cuándo envías a recepción
   - Cuánto esperas
   - Cuándo consultas autorización

3. CLAVE DE ACCESO:
   - Valor exacto (49 dígitos)
   - Resultado validación módulo 11

4. FIRMA:
   - ¿Tiene ds:Signature?
   - ¿Tiene X509Certificate?
   - ¿Verificaste con XOLIDOSIGN?

5. RUC:
   - Valor exacto
   - Estado en SRI (ACTIVO?)
```

---

## 🔗 Enlaces Útiles

- **Catastro RUC:** https://www.sri.gob.ec/web/guest/catastros
- **Servicios en línea:** https://servicios.sri.gob.ec
- **XOLIDOSIGN:** http://www.xolido.com/
- **Validador XSD Online:** http://www.utilities-online.info/xsdvalidation/

---

**Última actualización:** Febrero 2025
