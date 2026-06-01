import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage middleware that creates a correlation id per request.
 * The id is stored in a global async storage and can be accessed anywhere
 * in the call chain via `CorrelationContext.getId()`.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private static readonly asyncLocalStorage = new AsyncLocalStorage<string>();
  private readonly logger = new Logger(CorrelationMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const incomingId = (req.headers['x-correlation-id'] as string) || randomUUID();
    CorrelationMiddleware.asyncLocalStorage.run(incomingId, () => {
      // Attach to response for downstream services if needed
      res.setHeader('x-correlation-id', incomingId);
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`Correlation id set: ${incomingId}`);
      }
      next();
    });
  }

  /** Retrieve the current correlation id from async storage */
  static getId(): string | undefined {
    return CorrelationMiddleware.asyncLocalStorage.getStore();
  }
}
