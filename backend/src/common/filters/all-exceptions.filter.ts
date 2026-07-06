import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/** Bentuk error tunggal seluruh API (API_CONTRACT §1 · BACKEND_ARCHITECTURE §9). */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_FAILED',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.buildError(exception);

    if (status >= 500) {
      this.logger.error(
        body.error.message,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private buildError(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      let code = CODE_BY_STATUS[status] ?? 'ERROR';
      let message = exception.message;
      let details: unknown[] = [];

      if (typeof res === 'object' && res !== null) {
        const payload = res as Record<string, unknown>;
        // Service boleh melempar HttpException dengan `code` spesifik domain
        if (typeof payload.code === 'string') code = payload.code;
        if (typeof payload.message === 'string') message = payload.message;
        // ValidationPipe mengirim message berupa array pesan per-field
        if (Array.isArray(payload.message)) {
          message = 'Validasi gagal';
          details = payload.message;
        }
        if (Array.isArray(payload.details)) details = payload.details;
      }

      return { status, body: { error: { code, message, details } } };
    }

    // Error tak terduga: jangan bocorkan detail internal ke client
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Terjadi kesalahan pada server',
          details: [],
        },
      },
    };
  }
}
