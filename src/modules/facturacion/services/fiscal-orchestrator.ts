import { Injectable, Logger, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CertificatePreflightValidator } from '../services/certificate-preflight-validator.service';
import { DateValidationError } from '../errors/certificate-validation.error';

@Injectable()
export class FiscalOrchestrator {
  private readonly logger = new Logger(FiscalOrchestrator.name);

  constructor(
    @InjectRepository('PatientRequest')
    private readonly patientRequestRepository: Repository<PatientRequest>,
    @InjectRepository('AuditLog')
    private readonly auditLoggerRepository: Repository<AuditLog>,
    
    private readonly fiscalAdapter: FiscalAdapter,
    private readonly certificateValidator: CertificatePreflightValidator,
    private readonly auditLogger: AuditLogger // Injected directly for traceability
  ) {
    this.correlationId = CorrelationMiddleware.getId();
  }

  async execute(patientRequestId: string): Promise<void> {
    try {
      const patientRequest = await this.patientRequestRepository.findOneOrFail({
        where: { id: patientRequestId }
      });

      // 1. Certificate pre-flight validation
      await this.certificateValidator.validate(patientRequestId);

      // 2. Data validation
      await this.validateData(patientRequest);

      // 3. Map to fiscal format
      const fiscalRequest = this.mapToFiscalRequest(patientRequest);

      // 4. Execute with FiscalAdapter
      const response = await this.fiscalAdapter.emitFactura(fiscalRequest);

      // 5. Update status and log success
      await this.updateFacturaState(patientRequestId, response);

    } catch (error) {
      if (error instanceof DateValidationError) {
        // Special handling for certificate validation errors
        await this.auditLogger.logFacturaStateChange(patientRequestId, 'CERTIFICATE_INVALID', this.correlationId, {
          error: error.message,
        });

        await this.patientRequestRepository.update(patientRequestId, {
          status: 'CERTIFICATE_INVALID_ERROR',
          errorMessage: error.message,
        });

      } else {
        // General error handling
        await this.handleError(error, patientRequestId);
      }
    }
  }

  // ... (existing methods like validateData, mapToFiscalRequest, updateFacturaState)
}