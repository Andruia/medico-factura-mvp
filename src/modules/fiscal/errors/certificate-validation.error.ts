import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom error for certificate validation failures
 * Used to differentiate certificate issues from other failures
 */
export class CertificateValidationError extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}