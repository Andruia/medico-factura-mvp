import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { FacturaStatus } from '../../database/entities/Factura.entity';

/**
 * Audit Logger Service
 * 
 * Persists every state change of a factura request with correlation id
 * for complete traceability. Runs asynchronously and does not block
 * the main execution thread.
 */
@Injectable()
export class AuditLogger {
  private readonly logger = new Logger(AuditLogger.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Log a factura state change with correlation id
   * @param patientRequestId - The ID of the patient request
   * @param newStatus - The new status of the factura
   * @param correlationId - The correlation id for traceability
   * @param details - Optional additional details
   */
  async logFacturaStateChange(
    patientRequestId: string,
    newStatus: FacturaStatus,
    correlationId: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        patientRequestId,
        status: newStatus,
        correlationId,
        timestamp: new Date(),
        details: details ? JSON.stringify(details) : null,
      });

      await this.auditLogRepository.save(auditLog);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`Audit log saved for request ${patientRequestId}: ${newStatus}`, {
          correlationId
        });
      }
    } catch (error) {
      this.logger.error('Failed to save audit log', {
        patientRequestId,
        newStatus,
        correlationId,
        error: error.message
      });
      // Do not throw - audit logging failure should not break main flow
    }
  }

  /**
   * Get audit trail for a specific patient request
   */
  async getAuditTrail(patientRequestId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { patientRequestId },
      order: { timestamp: 'ASC' }
    });
  }
}
