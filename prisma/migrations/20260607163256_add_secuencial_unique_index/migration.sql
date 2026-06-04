-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEDICO', 'FACTURADOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEDICO',
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "MedicoProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT,
    "direccion" TEXT,
    "direccionMatriz" TEXT,
    "telefono" TEXT,
    "logoUrl" TEXT,
    "firmaElectronicaPath" TEXT,
    "firmaPassword" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'PRUEBAS',
    "puntoEmision" TEXT NOT NULL DEFAULT '001',
    "establecimiento" TEXT NOT NULL DEFAULT '001',
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT true,
    "contribuyenteEspecial" TEXT,
    "smtpServidor" TEXT,
    "smtpPuerto" INTEGER,
    "smtpUsuario" TEXT,
    "smtpPassword" TEXT,
    "smtpSsl" BOOLEAN NOT NULL DEFAULT true,
    "especialidad" TEXT,
    "numeroLicencia" TEXT,
    "notificacionesPacientes" BOOLEAN NOT NULL DEFAULT true,
    "notificacionesFacturas" BOOLEAN NOT NULL DEFAULT true,
    "notificacionesReportes" BOOLEAN NOT NULL DEFAULT false,
    "emailNotificaciones" BOOLEAN NOT NULL DEFAULT true,
    "smsNotificaciones" BOOLEAN NOT NULL DEFAULT false,
    "ivaDefecto" INTEGER NOT NULL DEFAULT 12,
    "monedaDefecto" TEXT NOT NULL DEFAULT 'USD',
    "formatoFactura" TEXT NOT NULL DEFAULT '001-001',
    "tiempoExpiracionQR" INTEGER NOT NULL DEFAULT 24,
    "limitePacientesQR" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicoProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuntoEmisionConfig" (
    "id" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "establecimiento" TEXT NOT NULL DEFAULT '001',
    "puntoEmision" TEXT NOT NULL DEFAULT '001',
    "ultimoSecuencial" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PuntoEmisionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "tipoIdentificacion" TEXT NOT NULL,
    "numeroIdentificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "secuencial" TEXT NOT NULL,
    "claveAcceso" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "iva" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "numeroAutorizacion" TEXT,
    "fechaAutorizacion" TIMESTAMP(3),
    "mensajeError" TEXT,
    "xmlPath" TEXT,
    "pdfPath" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaItem" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "codigoPrincipal" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "precioTotal" DECIMAL(65,30) NOT NULL,
    "ivaTarifa" INTEGER NOT NULL DEFAULT 12,
    "impuestoValor" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "FacturaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaFormaPago" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "plazo" INTEGER,
    "unidadTiempo" TEXT,

    CONSTRAINT "FacturaFormaPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaInfoAdicional" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "FacturaInfoAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoServicio" (
    "id" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "codigoPrincipal" TEXT,
    "codigoAuxiliar" TEXT,
    "nombre" TEXT NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "descripcion" TEXT,
    "ivaTarifa" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtencionMedica" (
    "id" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "AtencionMedica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "MedicoProfile_userId_key" ON "MedicoProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicoProfile_ruc_key" ON "MedicoProfile"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "PuntoEmisionConfig_medicoId_establecimiento_puntoEmision_key" ON "PuntoEmisionConfig"("medicoId", "establecimiento", "puntoEmision");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_numeroIdentificacion_key" ON "Paciente"("numeroIdentificacion");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_claveAcceso_key" ON "Factura"("claveAcceso");

-- CreateIndex
CREATE INDEX "Factura_estado_createdAt_idx" ON "Factura"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "Factura_estado_updatedAt_idx" ON "Factura"("estado", "updatedAt");

-- CreateIndex
CREATE INDEX "Factura_userId_estado_idx" ON "Factura"("userId", "estado");

-- CreateIndex
CREATE INDEX "Factura_userId_fechaEmision_idx" ON "Factura"("userId", "fechaEmision");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_userId_secuencial_key" ON "Factura"("userId", "secuencial");

-- CreateIndex
CREATE INDEX "ProductoServicio_medicoId_idx" ON "ProductoServicio"("medicoId");

-- CreateIndex
CREATE INDEX "AtencionMedica_medicoId_idx" ON "AtencionMedica"("medicoId");

-- CreateIndex
CREATE INDEX "AtencionMedica_pacienteId_idx" ON "AtencionMedica"("pacienteId");

-- CreateIndex
CREATE INDEX "AtencionMedica_fecha_idx" ON "AtencionMedica"("fecha");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicoProfile" ADD CONSTRAINT "MedicoProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoEmisionConfig" ADD CONSTRAINT "PuntoEmisionConfig_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "MedicoProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaItem" ADD CONSTRAINT "FacturaItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaFormaPago" ADD CONSTRAINT "FacturaFormaPago_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaInfoAdicional" ADD CONSTRAINT "FacturaInfoAdicional_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoServicio" ADD CONSTRAINT "ProductoServicio_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "MedicoProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionMedica" ADD CONSTRAINT "AtencionMedica_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
