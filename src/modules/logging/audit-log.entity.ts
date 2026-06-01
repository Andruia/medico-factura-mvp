import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Audit Log Entity
 * 
 * Stores every state transition of a factura request for traceability.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_request_id' })
  patientRequestId: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PROCESSING', 'ISSUED', 'FAILED_RETRY', 'FAILED_TERMINAL', 'MANUAL_INTERVENTION']
  })
  status: string;

  @Column({ name: 'correlation_id' })
  correlationId: string;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'details', type: 'text', nullable: true })
  details: string;
}