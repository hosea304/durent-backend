import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

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

/**
 * Error Prisma yang wajar diubah ke HTTP client-error alih-alih 500.
 * Ref kode: https://www.prisma.io/docs/orm/reference/error-reference
 */
const PRISMA_ERROR_MAP: Record<
  string,
  { status: number; code: string; message: string }
> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    code: 'CONFLICT',
    message: 'Data sudah ada atau melanggar batasan keunikan',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    code: 'NOT_FOUND',
    message: 'Data tidak ditemukan',
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    code: 'CONFLICT',
    message: 'Melanggar keterkaitan data (foreign key)',
  },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string | number }>();
    const { status, body } = this.buildError(exception);

    if (status >= 500) {
      // req.id (dari pino-http genReqId) menghubungkan log error ini ke log request
      this.logger.error(
        `[req:${request.id ?? '-'}] ${request.method} ${request.url} → ${body.error.message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private buildError(exception: unknown): { status: number; body: ErrorBody } {
    // Error Prisma yang dikenal → HTTP wajar (bukan 500 telanjang). Pesan generik,
    // detail internal (kolom/constraint) tidak dibocorkan ke client.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_ERROR_MAP[exception.code];
      if (mapped) {
        return {
          status: mapped.status,
          body: {
            error: { code: mapped.code, message: mapped.message, details: [] },
          },
        };
      }
      // Kode Prisma lain (tak terduga) → jatuh ke 500 di bawah (ter-log dengan stack).
    }

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
