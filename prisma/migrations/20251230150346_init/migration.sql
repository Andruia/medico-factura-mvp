-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEDICO',
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MedicoProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "logoUrl" TEXT,
    "firmaElectronicaPath" TEXT,
    "firmaPassword" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'PRUEBAS',
    "puntoEmision" TEXT NOT NULL DEFAULT '001',
    "establecimiento" TEXT NOT NULL DEFAULT '001',
    "especialidad" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicoProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipoIdentificacion" TEXT NOT NULL,
    "numeroIdentificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secuencial" TEXT NOT NULL,
    "claveAcceso" TEXT,
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "iva" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "mensajeError" TEXT,
    "xmlPath" TEXT,
    "pdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Factura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Factura_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FacturaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facturaId" TEXT NOT NULL,
    "codigoPrincipal" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "precioUnitario" DECIMAL NOT NULL,
    "descuento" DECIMAL NOT NULL DEFAULT 0,
    "precioTotal" DECIMAL NOT NULL,
    CONSTRAINT "FacturaItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MedicoProfile_userId_key" ON "MedicoProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicoProfile_ruc_key" ON "MedicoProfile"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_numeroIdentificacion_key" ON "Paciente"("numeroIdentificacion");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_claveAcceso_key" ON "Factura"("claveAcceso");
