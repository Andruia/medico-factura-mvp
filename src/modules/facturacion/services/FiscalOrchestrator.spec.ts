/**
 * FiscalOrchestrator – Integración de la capa “Pre‑Flight”
 *
 * Escenario:
 * 1️⃣  Mock de CertificatePreflightValidator que lanza CertificateValidationError.
 * 2️⃣  Ejecutamos or. exécución del flujo de facturación.
 * 3️⃣  Verificamos que:
 *   • FiscalAdapter.emitFactura **NO** se invoque.
 *   • AuditLogger.logFacturaStateChange registra el evento con:
 *        – status  = 'CERTIFICATE_INVALID_ERROR'
 *        – correlation_id sea el mismo usado en el middleware.
 *    • El método termina sin lanzar excepción no manejada.
 */

import 'reflect-metadata';

// Mock validator module early so its entity imports never resolve
jest.mock('@/modules/fiscal/services/certificate-preflight-validator.service', () => ({
  CertificatePreflightValidator: jest.fn().mockImplementation(() => ({
    validate: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { FiscalOrchestrator } from './fiscal-orchestrator';
import { AuditLogger } from '@/modules/logging/audit-logger.service';
import { CertificatePreflightValidator } from '@/modules/fiscal/services/certificate-preflight-validator.service';
import { CertificateValidationError } from '@/modules/fiscal/errors/certificate-validation.error';

// Minimal stubs for DI tokens (real modules not present in src/)
abstract class FiscalAdapter {
  abstract emitFactura(request: any): Promise<any>;
}

interface PatientRequest {
  id: string;
  status: string;
  user: { medicoProfile: { firmaElectronicaPath: string; firmaPassword: string } };
}

describe('FiscalOrchestrator – Certificate Pre‑Flight Resilience', () => {
    let service: FiscalOrchestrator;
    let auditLoggerMock: jest.Mocked<AuditLogger>;
    let fiscalAdapterMock: jest.Mocked<FiscalAdapter>;
    let validatorMock: jest.Mocked<CertificatePreflightValidator>;
    let patientRequestRepoMock: jest.Mocked<Repository<PatientRequest>>;

    const correlationId = 'test-correlation-123';

    beforeAll(async () => {
        // -------------------------------------------------
        // 1️⃣  Mock de dependencias externos
        // -------------------------------------------------
        fiscalAdapterMock = {
            emitFactura: jest.fn(),
            // …otros métodos del adapter (solo los que usamos)
        } as unknown as jest.Mocked<FiscalAdapter>;

        auditLoggerMock = {
            logFacturaStateChange: jest.fn(),
        } as unknown as jest.Mocked<AuditLogger>;

        validatorMock = {
            validate: jest.fn().mockRejectedValue(new CertificateValidationError('Certificate expired')), // <‑‑ error simulado
        } as unknown as jest.Mocked<CertificatePreflightValidator>;

        const mockPatientData: any = {
            id: 'req-001',
            status: 'PENDING',
            user: { medicoProfile: { firmaElectronicaPath: '/tmp/cert.p12', firmaPassword: 'pwd' } },
        };

        patientRequestRepoMock = {
            findOneOrFail: jest.fn().mockImplementation(() => Promise.resolve(mockPatientData)),
            update: jest.fn().mockImplementation((id, data) => {
                Object.assign(mockPatientData, data);
                return Promise.resolve({ affected: 1 });
            }),
        } as unknown as jest.Mocked<Repository<PatientRequest>>;

        // -------------------------------------------------
        // 2️⃣  Configuración del módulo de pruebas
        // -------------------------------------------------
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FiscalOrchestrator,
                { provide: 'PatientRequestRepository', useValue: patientRequestRepoMock },
                { provide: AuditLogger, useValue: auditLoggerMock },
                { provide: 'FiscalAdapter', useValue: fiscalAdapterMock },
                { provide: CertificatePreflightValidator, useValue: validatorMock },
                { provide: 'CORRELATION_ID', useValue: 'test-correlation-123' },
            ],
        }).compile();

        service = module.get<FiscalOrchestrator>(FiscalOrchestrator);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('debe abortar el flujo si la validación del certificado falla', async () => {
        // -------------------------------------------------
        // 3️⃣  Ejecutamos el método bajo prueba
        // -------------------------------------------------
        await service.execute('req-001');

        // -------------------------------------------------
        // 4️⃣  Verificaciones
        // -------------------------------------------------
        // 4a) FiscalAdapter nunca debe ser llamado
        expect(fiscalAdapterMock.emitFactura).not.toHaveBeenCalled();

        // 4b) AuditLogger debe registrar el estado CERTIFICATE_INVALID_ERROR
        expect(auditLoggerMock.logFacturaStateChange).toHaveBeenCalledTimes(1);
        const [patientId, newStatus, correlationIdLogged, details] = auditLoggerMock.logFacturaStateChange!.mock.calls[0];

        expect(patientId).toBe('req-001');
        expect(newStatus).toBe('CERTIFICATE_INVALID_ERROR');
        expect(correlationIdLogged).toBe(correlationId);
        expect(details?.error).toContain('Certificate expired');

        // 4c) No se lanza excepción no capturada fuera del flujo esperado
        //    (el método captura el error y la ejecución termina normalmente)
        //    No se verifica código de retorno porque el método es void;
        //    la ausencia de excepciones ya confirma que el flujo terminó.

        // 4d) Opcional – confirmar que el PatientRequest quedó con el estado correcto
        //      (podemos inspeccionar el repo si queremos)
        const updated = await patientRequestRepoMock.findOneOrFail({
            where: { id: 'req-001' },
        });
        expect(updated.status).toBe('CERTIFICATE_INVALID_ERROR');
    });
});