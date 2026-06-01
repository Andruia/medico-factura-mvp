import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientRequest } from '../../database/entities/PatientRequest.entity';
import { FiscalAdapter } from '../sri/services/FiscalAdapter.service';

/**
 * Macro Failure Recovery Service
 * 
 * Continuously scans for 'FAILED_RETRY' requests and retries them in batches.
 * Runs asynchronously in the background without blocking the main thread.
 * Respects the Circuit Breaker status from the FiscalAdapter.
 * 
 * - Scans every 60 seconds
 * - Processes up to 10 failed requests per batch
 * - Logs retry attempts and results
 * - Updates request status on success/failure
 */
@Injectable()
export class MacroFailureRecovery implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MacroFailureRecovery.name);
  private readonly heartbeatInterval = 60000; // 1 minute
  private intervalId?: NodeJS.Timeout;

  constructor(
    @InjectRepository(PatientRequest)
    private readonly patientRequestRepository: Repository<PatientRequest>,
    private readonly fiscalAdapter: FiscalAdapter,
  ) {}

  onModuleInit() {
    this.logger.log('Starting macro failure recovery service');
    this.intervalId = setInterval(
      () => this.processFailedRequests(),
      this.heartbeatInterval
    );
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.logger.log('Macro failure recovery service stopped');
    }
  }

  private async processFailedRequests(): Promise<void> {
    try {
      this.logger.debug('Scanning for failed requests to retry');
      
      const failedRequests = await this.findFailedRequests();
      if (failedRequests.length === 0) {
        return;
      }

      this.logger.log(`Found ${failedRequests.length} failed requests to retry`);
      
      await this.retryBatch(failedRequests.slice(0, 10)); // Process max 10 per batch
      
    } catch (error) {
      this.logger.error('Error in macro failure recovery', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  private async findFailedRequests(): Promise<PatientRequest[]> {
    return this.patientRequestRepository
      .createQueryBuilder('pr')
      .where('pr.status = :status', { status: 'FAILED_RETRY' })
      .andWhere('pr.retryCount < :maxRetries', { maxRetries: 5 })
      .orderBy('pr.retryCount', 'ASC')
      .addOrderBy('pr.updatedAt', 'ASC')
      .take(20) // Limit to prevent memory issues
      .getMany();
  }

  private async retryBatch(requests: PatientRequest[]): Promise<void> {
    const promises = requests.map(request => this.retrySingleRequest(request));
    await Promise.allSettled(promises);
  }

  private async retrySingleRequest(request: PatientRequest): Promise<void> {
    const correlationId = CorrelationMiddleware.getId();
    
    try {
      this.logger.log(`Retrying failed request: ${request.id}`, {
        correlationId,
        retryCount: request.retryCount
      });

      // Map the request to fiscal format
      const fiscalRequest = this.mapToFiscalRequest(request);
      
      // Attempt retry using FiscalAdapter (respecting circuit breaker)
      const result = await this.fiscalAdapter.emitFactura(fiscalRequest);
      
      // Update status on success
      await this.patientRequestRepository.update(request.id, {
        status: 'ISSUED',
        sriAuthorization: result.authorizationKey,
        retryCount: request.retryCount + 1,
        lastRetryAt: new Date()
      });

      this.logger.log(`Successfully retried request: ${request.id}`, {
        correlationId,
        authorizationKey: result.authorizationKey
      });

    } catch (error) {
      // Update retry status on failure
      await this.patientRequestRepository.update(request.id, {
        retryCount: request.retryCount + 1,
        lastRetryAt: new Date(),
        retryMessage: error.message
      });

      this.logger.error(`Retry failed for request: ${request.id}`, {
        correlationId,
        error: error.message,
        retryCount: request.retryCount + 1
      });

      // If max retries exceeded, mark as terminal failure
      if (request.retryCount >= 4) {
        await this.patientRequestRepository.update(request.id, {
          status: 'FAILED_TERMINAL'
        });
        this.logger.error(`Max retries exceeded for request: ${request.id}`, {
          correlationId
        });
      }
    }
  }

  private mapToFiscalRequest(request: PatientRequest) {
    // This should match the mapping logic in FiscalOrchestrator
    return {
      patientRequestId: request.id,
      // ... other fields needed by FiscalAdapter
    };
  }
}
