import forge from "node-forge"
import { DOMParser, XMLSerializer } from 'xmldom'
import { Crypto } from '@peculiar/webcrypto'
import { X509Certificate } from '@peculiar/x509'
import * as xades from 'xadesjs'
import * as xmldsig from 'xmldsigjs'

// Initialize WebCrypto engine for xadesjs & xmldsigjs
const crypto = new Crypto()
xades.Application.setEngine("NodeJS", crypto)
xmldsig.Application.setEngine("NodeJS", crypto)

// Register DOM dependencies for Node.js
xades.setNodeDependencies({
  DOMParser,
  XMLSerializer,
})

export class CertificateManager {
  /**
   * Valida un archivo .p12 (formato Base64) con su contraseña.
   * Extrae información del certificado (Titular, RUC, Fecha Validez).
   */
  static async validateCertificate(
    certificateBase64: string,
    password: string,
  ): Promise<{
    valid: boolean
    info?: {
      titular: string
      ruc: string
      fechaVencimiento: Date
      huella: string
    }
    error?: string
  }> {
    try {
      if (!certificateBase64 || !password) {
        return { valid: false, error: "Certificado o contraseña faltante" }
      }

      const p12Der = forge.util.decode64(certificateBase64)
      const p12Asn1 = forge.asn1.fromDer(p12Der)
      // Note: strict=false allows for partial parsing which is more robust
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password)

      let certBag: forge.pkcs12.Bag | null = null
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag })
      const certBags = bags[forge.pki.oids.certBag]

      if (certBags && certBags.length > 0) {
        certBag = certBags[0]
      }

      if (!certBag || !certBag.cert) {
        return { valid: false, error: "No se encontró ningún certificado en el archivo .p12" }
      }

      const cert = certBag.cert as forge.pki.Certificate
      const subject = cert.subject.attributes
      const getAttr = (name: string) => subject.find(attr => attr.shortName === name || attr.name === name || attr.type === name)?.value as string || ""

      // Función ultra-agresiva para buscar RUC/Cédula
      const findNumericId = (text: string) => {
        if (!text) return null
        // Limpiar el texto de caracteres especiales comunes en certificados
        const clean = text.replace(/[^0-9]/g, '')

        // Buscar 13 dígitos seguidos (RUC)
        const match13 = text.match(/\d{13}/)
        if (match13) return match13[0]

        // Si no hay 13, buscar 10 dígitos (Cédula)
        const match10 = text.match(/\d{10}/)
        if (match10) return match10[0] + "001"

        return null
      }

      let ruc = ""
      // 1. Intentar con todos los atributos del subject (el más seguro)
      for (const attr of subject) {
        const val = attr.value as string
        const found = findNumericId(val)
        if (found) {
          ruc = found
          break
        }
      }

      const commonName = getAttr('CN') || getAttr('commonName')
      const fechaVencimiento = cert.validity.notAfter
      const ahora = new Date()

      if (fechaVencimiento < ahora) {
        return {
          valid: false,
          error: `El certificado caducó el ${fechaVencimiento.toLocaleDateString()}`
        }
      }

      const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
      const md = forge.md.sha1.create()
      md.update(der)
      const huella = md.digest().toHex().toUpperCase()

      return {
        valid: true,
        info: {
          titular: commonName || "Desconocido",
          ruc: ruc || "No detectado",
          fechaVencimiento,
          huella
        }
      }

    } catch (error) {
      const msg = (error as Error).message
      if (msg.includes("Invalid password") || msg.includes("MAC verification failed")) {
        return { valid: false, error: "Contraseña incorrecta" }
      }
      return {
        valid: false,
        error: "Error leyendo certificado: " + msg,
      }
    }
  }

  /**
   * Genera la firma XAdES-BES para el XML proporcionado usando xadesjs y xmldsigjs.
   */
  static async signXML(
    xmlContent: string,
    certificateBase64: string,
    password: string,
  ): Promise<{
    success: boolean
    signedXML?: string
    error?: string
  }> {
    try {
      const validation = await this.validateCertificate(certificateBase64, password)
      if (!validation.valid) throw new Error(validation.error)

      console.log("[CertificateManager] Iniciando firma digital del XML...")

      // 1. Extraer Keys de Forge
      const p12Der = forge.util.decode64(certificateBase64)
      const p12Asn1 = forge.asn1.fromDer(p12Der)
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password)

      const bagsByOid = p12.getBags({ bagType: forge.pki.oids.certBag })
      const certBag = bagsByOid[forge.pki.oids.certBag]?.[0]
      if (!certBag || !certBag.cert) throw new Error("No cert in p12")
      const certificate = certBag.cert as forge.pki.Certificate

      const keyBagsByOid = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
      const keyBag = keyBagsByOid[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
      if (!keyBag || !keyBag.key) throw new Error("No private key in p12")
      const privateKey = keyBag.key as forge.pki.PrivateKey

      // 2. Convertir Key a WebCrypto
      const privateKeyInfo = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey as forge.pki.PrivateKey))
      const privateKeyBinary = forge.asn1.toDer(privateKeyInfo).getBytes()
      const privateKeyBuffer = new Uint8Array(privateKeyBinary.length)
      for (let i = 0; i < privateKeyBinary.length; i++) privateKeyBuffer[i] = privateKeyBinary.charCodeAt(i)

      const alg = {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-1'
      }

      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyBuffer.buffer,
        alg,
        true,
        ['sign']
      )

      // 3. Convertir Cert a X509Certificate
      const certDerBinary = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes()
      const certBuffer = new Uint8Array(certDerBinary.length)
      for (let i = 0; i < certDerBinary.length; i++) certBuffer[i] = certDerBinary.charCodeAt(i)
      const x509Cert = new X509Certificate(certBuffer)

      // 3.5 Importar Public Key para KeyValue
      const publicKeyInfo = forge.pki.publicKeyToAsn1(certificate.publicKey)
      const publicKeyBinary = forge.asn1.toDer(publicKeyInfo).getBytes()
      const publicKeyBuffer = new Uint8Array(publicKeyBinary.length)
      for (let i = 0; i < publicKeyBinary.length; i++) publicKeyBuffer[i] = publicKeyBinary.charCodeAt(i)

      const publicKey = await crypto.subtle.importKey(
        'spki',
        publicKeyBuffer.buffer,
        alg,
        true,
        ['verify']
      )

      // 4. Parsear XML (Sanitizado)
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent.replace(/\r/g, '').trim(), 'application/xml')

      const signedXml = new xades.SignedXml(xmlDoc) as any
      const xadesXml = (xades as any).xml

      // 5. Configurar Referencias (xmldsigjs para componentes core)
      const reference = new xmldsig.Reference()
      reference.Uri = ""
      reference.DigestMethod = "SHA-1" as any

      // Inicialización manual de colecciones para evitar errores de undefined
      if (!reference.Transforms) (reference as any).Transforms = new (xmldsig as any).Transforms();

      // Transform 1: Enveloped Signature
      reference.Transforms.Add(new xmldsig.XmlDsigEnvelopedSignatureTransform())

      // Transform 2: Inclusive C14N (Crucial para algunos validadores del SRI)
      const c14nTransform = new (xmldsig as any).XmlDsigC14NTransform();
      c14nTransform.Algorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
      reference.Transforms.Add(c14nTransform)

      if (!signedXml.References) (signedXml as any).References = new (xmldsig as any).References();
      signedXml.References.Add(reference)

      // 6. Configurar KeyInfo (xmldsigjs) con certificado en Base64
      const x509Data = new xmldsig.KeyInfoX509Data()

      // Convertir certificado a Base64 (PEM sin headers) para inclusión en XML
      const certPem = forge.pki.certificateToPem(certificate)
      const certBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\r?\n/g, '')
        .trim()

      // Agregar certificado usando el buffer binario para xmldsigjs
      const x509CertObj = new xmldsig.X509Certificate(certBuffer)
      x509Data.AddCertificate(x509CertObj)

      if (!signedXml.KeyInfo) (signedXml as any).KeyInfo = new xmldsig.KeyInfo()
      signedXml.KeyInfo.Add(x509Data)

      // Agregar KeyValue según documentación oficial SRI (SRI_CONTEXTO_TECNICO.md líneas 207-212)
      // El SRI REQUIERE tanto X509Data como KeyValue en KeyInfo
      const keyValue = new xmldsig.KeyValue()
      await keyValue.importKey(publicKey)
      signedXml.KeyInfo.Add(keyValue)

      // 7. Configurar XAdES Properties (v2.6.5 usa el getter .Properties)
      const xadesProps = signedXml.Properties;
      if (xadesProps && xadesProps.SignedProperties) {
        // Establecer un ID único para SignedProperties (Requerido para la referencia)
        const signedPropsId = "SignedProperties-" + Math.random().toString(36).substring(2, 9);
        xadesProps.SignedProperties.Id = signedPropsId;

        const sigProps = xadesProps.SignedProperties.SignedSignatureProperties;

        // SigningTime: Usar .Value para asignar el Date (evita error HasChanged)
        sigProps.SigningTime.Value = new Date()

        // Elemento para el certificado (Poblado manual con patrón drill-down)
        const xadesCert = new xadesXml.Cert()
        xadesCert.Uri = ""

        const x509Cert = new xmldsig.X509Certificate(certBuffer)

        // CertDigest: Drill-down para evitar colisiones de tipos
        xadesCert.CertDigest.DigestMethod.Algorithm = "http://www.w3.org/2000/09/xmldsig#sha1"

        const thumbprint = await x509Cert.Thumbprint("SHA-1")
        xadesCert.CertDigest.DigestValue = new Uint8Array(thumbprint)

        // IssuerSerial: Drill-down
        xadesCert.IssuerSerial.X509IssuerName = x509Cert.Issuer
        xadesCert.IssuerSerial.X509SerialNumber = x509Cert.SerialNumber

        // Agregar a la colección de certificados
        if (!sigProps.SigningCertificate) {
          (sigProps as any).SigningCertificate = new xadesXml.SigningCertificate()
        }
        sigProps.SigningCertificate.Add(xadesCert)

        // IMPORTANTE: Agregar Referencia explícita a SignedProperties para SRI
        const propsReference = new xmldsig.Reference()
        propsReference.Uri = "#" + signedPropsId
        propsReference.Type = "http://uri.etsi.org/01903#SignedProperties"
        propsReference.DigestMethod = "SHA-1" as any

        // C14N para esta referencia
        if (!propsReference.Transforms) (propsReference as any).Transforms = new (xmldsig as any).Transforms();
        const propsC14n = new (xmldsig as any).XmlDsigC14NTransform();
        propsC14n.Algorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
        propsReference.Transforms.Add(propsC14n)

        signedXml.References.Add(propsReference)
      }

      // Explicitly set CanonicalizationMethod for SRI (SignedInfo level)
      if (signedXml.XmlSignature && signedXml.XmlSignature.SignedInfo) {
        signedXml.XmlSignature.SignedInfo.CanonicalizationMethod.Algorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
      }

      // 8. Firmar con opción x509 para incluir certificado en KeyInfo
      const signature = await signedXml.Sign(
        alg,
        cryptoKey,
        xmlDoc,
        {
          id: "Signature-" + Math.random().toString(36).substring(2, 9),
          x509: [certBase64] // Incluir certificado en Base64 para que se serialice en KeyInfo
        }
      )

      // 9. Append Signature
      const signatureNode = signature.GetXml()
      if (signatureNode) {
        xmlDoc.documentElement.appendChild(signatureNode)
      }

      // 10. Verificar y corregir inclusión del certificado X509
      let signedXML = new XMLSerializer().serializeToString(xmlDoc).replace(/\r/g, '')

      // Verificar si el certificado está presente en el XML
      if (!signedXML.includes('<ds:X509Certificate>') && !signedXML.includes('<X509Certificate>')) {
        console.warn("[CertificateManager] ⚠️ Certificado X509 no encontrado en XML firmado. Insertando manualmente...")

        // Buscar dónde termina SignedInfo para insertar KeyInfo después
        const signedInfoEndMatch = signedXML.match(/<\/ds:SignedInfo>/)

        if (signedInfoEndMatch) {
          const insertPosition = signedXML.indexOf(signedInfoEndMatch[0]) + signedInfoEndMatch[0].length

          // Construir KeyInfo completo con X509Data
          const keyInfoXml = `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`

          signedXML = signedXML.slice(0, insertPosition) + keyInfoXml + signedXML.slice(insertPosition)
          console.log("[CertificateManager] ✅ KeyInfo con certificado X509 insertado manualmente después de SignedInfo")

          // Debug: Mostrar fragmento del XML alrededor de KeyInfo
          const keyInfoStart = signedXML.indexOf('<ds:KeyInfo>')
          if (keyInfoStart !== -1) {
            const fragment = signedXML.substring(keyInfoStart - 100, keyInfoStart + 500)
            console.log("[CertificateManager] 🔍 Fragmento XML con KeyInfo:", fragment)
          }
        } else {
          console.error("[CertificateManager] ❌ No se encontró </ds:SignedInfo> para insertar KeyInfo")
        }
      } else {
        console.log("[CertificateManager] ✅ Certificado X509 presente en XML firmado")
      }

      console.log("[CertificateManager] XML firmado exitosamente")

      return { success: true, signedXML }
    } catch (error) {
      console.error("[CertificateManager] Error firmando XML:", error)
      return { success: false, error: (error as Error).message }
    }
  }

  // ... (rest of methods)
  private static getKey(): string {
    return process.env.CERT_ENCRYPTION_KEY || "default-secret-key-change-in-prod"
  }

  static encryptPassword(password: string): string {
    try {
      const key = this.getKey()
      const iv = forge.random.getBytesSync(16)
      const cipher = forge.cipher.createCipher('AES-CBC', forge.util.createBuffer(key.padEnd(32, '0').slice(0, 32)))
      cipher.start({ iv: iv })
      cipher.update(forge.util.createBuffer(password))
      cipher.finish()
      const encrypted = cipher.output
      return forge.util.encode64(iv + encrypted.data)
    } catch (e) {
      return password
    }
  }

  static decryptPassword(encryptedPassword: string): string {
    try {
      const key = this.getKey()
      const decoded = forge.util.decode64(encryptedPassword)
      const iv = decoded.slice(0, 16)
      const encrypted = decoded.slice(16)
      const decipher = forge.cipher.createDecipher('AES-CBC', forge.util.createBuffer(key.padEnd(32, '0').slice(0, 32)))
      decipher.start({ iv: iv })
      decipher.update(forge.util.createBuffer(encrypted))
      const result = decipher.finish()
      if (result) return decipher.output.toString()
      return encryptedPassword
    } catch (e) {
      return encryptedPassword
    }
  }
}
