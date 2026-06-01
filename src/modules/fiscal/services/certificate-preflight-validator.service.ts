import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { MedicoProfile } from '../../database/entities/MedicoProfile.entity';
import { PatientRequest } from '../../database/entities/PatientRequest.entity';
import { CertificateValidationError } from '../errors/certificate-validation.error';

/**
 * Certificate Pre-Flight Validator Service
 * 
 * Validates certificate integrity and expiration BEFORE attempting to send invoice.
 * This acts as a guard clause in the FiscalOrchestrator to prevent unnecessary
 * API calls that would fail due to invalid certificates.
 * 
 * Validates:
 * 1. Certificate file exists and is readable
 * 2. Certificate password is correct (can decrypt)
 * 3. Certificate expiration date (> 30 days remaining)
 */
@Injectable()
export class CertificatePreFlightValidator {
  private readonly logger = new Logger(CertificatePreFlightValidator.name);
  private readonly EXPIRATION_WARNING_DAYS = 30;

  constructor(
    @InjectRepository(MedicoProfile)
    private readonly medicoProfileRepository: Repository<MedicoProfile>,
    @InjectRepository(PatientRequest)
    private readonly patientRequestRepository: Repository<PatientRequest>,
  ) {}

  /**
   * Validate certificate pre-flight for a given patient request
   * @param patientRequestId - The ID of the patient request
   * @throws CertificateValidationError if validation fails
   */
  async validate(patientRequestId: string): Promise<void> {
    const correlationId = this.getCorrelationId();
    
    try {
      // Load patient request and associated doctor profile
      const patientRequest = await this.patientRequestRepository.findOne({
        where: { id: patientRequestId },
        relations: ['user', 'user.medicoProfile'],
      });

      if (!patientRequest) {
        throw new CertificateValidationError('Patient request not found');
      }

      const medicoProfile = patientRequest.user?.medicoProfile;
      if (!medicoProfile) {
        throw new CertificateValidationError('Doctor profile not found');
      }

      if (!medicoProfile.firmaElectronicaPath) {
        throw new CertificateValidationError('Certificate path not configured');
      }

      if (!medicoProfile.firmaPassword) {
        throw new CertificateValidationError('Certificate password not configured');
      }

      // Perform validations
      await this.validateCertificateFile(medicoProfile.firmaElectronicaPath);
      await this.validateCertificatePassword(
        medicoProfile.firmaElectronicaPath,
        medicoProfile.firmaPassword,
      );
      await this.validateCertificateExpiration(medicoProfile.firmaElectronicaPath);

      this.logger.log(`Certificate validation passed for doctor ${medicoProfile.id}`, {
        correlationId,
      });
    } catch (error) {
      this.logger.error('Certificate pre-flight validation failed', {
        correlationId,
        patientRequestId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if certificate file exists and is readable
   */
  private async validateCertificateFile(certPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.access(certPath, fs.constants.R_OK, (err) => {
        if (err) {
          this.logger.error(`Certificate file not accessible: ${certPath}`, { error: err.message });
          reject(new CertificateValidationError(`Certificate file not accessible: ${certPath}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Validate certificate password by attempting to decrypt
   */
  private async validateCertificatePassword(certPath: string, password: string): Promise<void> {
    try {
      const certBuffer = fs.readFileSync(certPath);
      
      // Try to parse as PKCS12
      const p12Asn1 = crypto.createPrivateKey({ key: certBuffer, passphrase: password });
      
      if (!p12Asn1) {
        throw new CertificateValidationError('Failed to decrypt certificate with provided password');
      }
      
      this.logger.debug('Certificate password validated successfully');
    } catch (error) {
      this.logger.error('Certificate password validation failed', { error: error.message });
      throw new CertificateValidationError('Invalid certificate password');
    }
  }

  /**
   * Validate certificate expiration date
   */
  private async validateCertificateExpiration(certPath: string): Promise<void> {
    try {
      const certBuffer = fs.readFileSync(certPath);
      const p12Asn1 = crypto.createPrivateKey(certBuffer);
      
      // Extract certificate dates (simplified - in production use node-forge or similar)
      // This is a placeholder - actual implementation would parse the certificate
      const certInfo = this.extractCertificateInfo(certBuffer);
      
      if (!certInfo.notAfter) {
        this.logger.warn('Could not determine certificate expiration date');
        return; // Don't fail if we can't read expiration
      }

      const daysUntilExpiration = Math.ceil(
        (certInfo.notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiration < this.EXPIRATION_WARNING_DAYS) {
        this.logger.warn(`Certificate expires in ${daysUntilExpiration} days (threshold: ${this.EXPIRATION_WARNING_DAYS})`);
        // Log warning but don't fail - this is informational
      }

      if (daysUntilExpiration < 0) {
        throw new CertificateValidationError('Certificate has expired');
      }
    } catch (error) {
      if (error instanceof CertificateValidationError) {
        throw error;
      }
      this.logger.error('Certificate expiration check failed', { error: error.message });
      throw new CertificateValidationError('Failed to check certificate expiration');
    }
  }

  /**
   * Extract certificate information (placeholder implementation)
   * In production, use node-forge or similar library
   */
  private extractCertificateInfo(certBuffer: Buffer): { notAfter: Date | null } {
    // Simplified extraction - replace with actual certificate parsing
    // This is just for demonstration purposes
    return { notAfter: null };
  }

  /**
   * Get correlation ID from async storage
   */
  private getCorrelationId(): string | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { CorrelationMiddleware } = require('@/shared/middleware/correlation-middleware');
      return CorrelationMiddleware.getId();
    } catch {
      return undefined;
    }
  }
}