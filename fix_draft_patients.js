
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCompletedDrafts() {
  try {
    // 1. Find revisions that are COMPLETED but have a draft (BORRADOR) invoice
    // This implies they were "completed" by the old draft saving logic
    const drafts = await prisma.factura.findMany({
      where: { estado: 'BORRADOR' },
      include: { paciente: true }
    });

    console.log(`Found ${drafts.length} drafts.`);

    for (const draft of drafts) {
      console.log(`Checking draft for patient: ${draft.paciente.razonSocial} (${draft.pacienteId})`);
      
      // Find the most recent COMPLETED attention for this patient
      const attention = await prisma.atencionMedica.findFirst({
        where: {
          pacienteId: draft.pacienteId,
          estado: 'COMPLETADO',
          medicoId: draft.userId
        },
        orderBy: { fecha: 'desc' } // Get the latest one
      });

      if (attention) {
        console.log(`❌ Found INCORRECTLY COMPLETED attention: ${attention.id}. Reverting to PENDIENTE...`);
        
        await prisma.atencionMedica.update({
          where: { id: attention.id },
          data: { estado: 'PENDIENTE' }
        });
        
        console.log("✅ Fixed!");
      } else {
        console.log("⚠️ No completed attention found. Patient might be missing, or attention is already PENDING.");
        
        // Check if there is ANY attention pending
        const pending = await prisma.atencionMedica.findFirst({
            where: {
                pacienteId: draft.pacienteId,
                estado: 'PENDIENTE'
            }
        });
        
        if (!pending) {
            console.log("‼️ No pending attention exists either! Creating recovery attention...");
            await prisma.atencionMedica.create({
                data: {
                    medicoId: draft.userId,
                    pacienteId: draft.pacienteId,
                    estado: 'PENDIENTE',
                    fecha: new Date(),
                    motivo: 'Recuperación automática de borrador'
                }
            });
            console.log("✅ Recovery attention created.");
        }
      }
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

fixCompletedDrafts();
