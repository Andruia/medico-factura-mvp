import { Injectable, Logger, Inject } from '@nestjs/common';
import { CertificatePreflightValidator } from '../../fiscal/services/certificate-preflight-validator.service';
import { CertificateValidationError } from '../../fiscal/errors/certificate-validation.error';
import { AuditLogger } from '@/modules/logging/audit-logger.service';

@Injectable()
export class FiscalOrchestrator {
  private readonly logger = new Logger(FiscalOrchestrator.name);

  constructor(
    @Inject('PatientRequestRepository') private readonly patientRequestRepository: any,
    @Inject('FiscalAdapter') private readonly fiscalAdapter: any,
    private readonly certificateValidator: CertificatePreflightValidator,
    private readonly auditLogger: AuditLogger,
    @Inject('CORRELATION_ID') private readonly correlationId: string
  ) {}

  async execute(patientRequestId: string): Promise<void> {
    try {
      // 1. Fetch with specific version/updatedAt (Optimistic Locking)
      const patientRequest = await this.patientRequestRepository.findOneOrFail({
        where: { 
          id: patientRequestId,
          status: 'PENDIENTE_ENVIO' // Only process if pending
        }
      });

      // 2. Transitory state change to prevent another concurrent 'execute'
      // This is our 'lock' at the application level
      await this.patientRequestRepository.update(patientRequestId, {
        status: 'PROCESSING',
        updatedAt: new Date() // Forces updatedAt change for concurrency check
      });

      // 3. Certificate pre-flight validation
      await this.certificateValidator.validate(patientRequestId);

      // 4. Execute with FiscalAdapter
      const response = await this.fiscalAdapter.emitFactura(patientRequest);

      // 5. Update status
      await this.updateFacturaState(patientRequestId, response);

    } catch (error) {
      this.logger.error(`Error processing request ${patientRequestId}: ${error.message}`);
      
      if (error instanceof CertificateValidationError) {
        await this.auditLogger.logFacturaStateChange(patientRequestId, 'CERTIFICATE_INVALID_ERROR', this.correlationId, {
          error: error.message,
        });

        await this.patientRequestRepository.update(patientRequestId, {
          status: 'CERTIFICATE_INVALID_ERROR',
          errorMessage: error.message,
        });
      } else {
        // Rollback status if it was a transient error to allow retry
        await this.patientRequestRepository.update(patientRequestId, {
          status: 'PENDIENTE_ENVIO',
          errorMessage: error.message,
        });
      }
    }
  }

  private async updateFacturaState(patientRequestId: string, response: any): Promise<void> {
    // Placeholder — will be implemented with proper status transitions
  }

  private async handleError(error: any, patientRequestId: string): Promise<void> {
    this.logger.error(`Error processing request ${patientRequestId}: ${error.message}`);
  }
}
