import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { RIDEGenerator } from "@/lib/sri/ride-generator";
import QRCode from "qrcode";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse("No autorizado", { status: 401 });
    }

    const { id } = await params;

    try {
        // Fetch Invoice with ALL relations
        const factura = await (prisma as any).factura.findUnique({
            where: { id },
            include: {
                items: true,
                formasPago: true,
                infoAdicional: true,
                paciente: true
            }
        });

        if (!factura) {
            return new NextResponse("Factura no encontrada", { status: 404 });
        }

        // Fetch Medico Profile for headers
        const medico = await (prisma as any).medicoProfile.findUnique({
            where: { userId: session.user.id }
        });

        if (!medico) {
            return new NextResponse("Perfil médico no encontrado", { status: 404 });
        }

        // Calculate subtotals for the PDF if they are not stored (or just use stored ones)
        // Note: Our schema has subtotal, iva, total. But SRI RIDE needs breakdown.
        // If we don't have subtotal12, etc. in DB yet, we can calculate them here
        // or ensure they were saved.

        // Generate QR code for Clave de Acceso
        const qrDataUrl = await QRCode.toDataURL(factura.claveAcceso || "PENDIENTE", {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 200
        });

        // Calculate subtotals for the breakdown if they are not in the top-level model
        let sub0 = 0, sub12 = 0, sub15 = 0;
        factura.items.forEach((item: any) => {
            const tarifa = Number(item.ivaTarifa || 0);
            const base = (Number(item.cantidad) * Number(item.precioUnitario)) - Number(item.descuento || 0);
            if (tarifa === 0) sub0 += base;
            else if (tarifa === 12) sub12 += base;
            else if (tarifa === 15) sub15 += base;
        });

        const facturaConSubtotales = {
            ...factura,
            subtotal0: sub0,
            subtotal12: sub12,
            subtotal15: sub15
        };

        // Render PDF to buffer
        const buffer = await renderToBuffer(
            <RIDEGenerator
                factura={facturaConSubtotales}
                medico={medico}
                paciente={factura.paciente}
                qrDataUrl={qrDataUrl}
            />
        );

        return new NextResponse(buffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="factura-${factura.secuencial}.pdf"`
            }
        });

    } catch (error) {
        console.error("Error generating PDF:", error);
        return new NextResponse("Error al generar PDF", { status: 500 });
    }
}
