import {
  ArgumentsHost,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AllExceptionsFilter, ErrorBody } from './all-exceptions.filter';

/** Rakit ArgumentsHost palsu + tangkap status/body yang ditulis ke response. */
function runFilter(exception: unknown): { status: number; body: ErrorBody } {
  const filter = new AllExceptionsFilter();
  const json = jest.fn<unknown, [ErrorBody]>();
  const status = jest.fn<{ json: typeof json }, [number]>(() => ({ json }));
  const req = { id: 'req-test', method: 'POST', url: '/api/v1/orders' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, json }),
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;

  filter.catch(exception, host);
  return {
    status: status.mock.calls[0][0],
    body: json.mock.calls[0][0],
  };
}

/** Bentuk PrismaClientKnownRequestError dengan kode tertentu. */
function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
  });
}

describe('AllExceptionsFilter', () => {
  it('meneruskan HttpException dengan code sesuai status', () => {
    const { status, body } = runFilter(new NotFoundException('tidak ada'));
    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('tidak ada');
  });

  it('mengubah pesan array ValidationPipe → VALIDATION_FAILED + details', () => {
    // ValidationPipe (422) mengirim message berupa array pesan per-field
    const exc = new HttpException(
      { message: ['qty harus >= 1', 'code wajib diisi'] },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    const { status, body } = runFilter(exc);
    expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual(['qty harus >= 1', 'code wajib diisi']);
  });

  it('menghormati code domain khusus dari payload HttpException', () => {
    const exc = new ConflictException({
      code: 'ORDER_ALREADY_CANCELLED',
      message: 'Order sudah dibatalkan',
    });
    const { status, body } = runFilter(exc);
    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body.error.code).toBe('ORDER_ALREADY_CANCELLED');
    expect(body.error.message).toBe('Order sudah dibatalkan');
  });

  it('memetakan Prisma P2002 (unik) → 409 CONFLICT', () => {
    const { status, body } = runFilter(prismaError('P2002'));
    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.details).toEqual([]);
  });

  it('memetakan Prisma P2025 (not found) → 404 NOT_FOUND', () => {
    const { status, body } = runFilter(prismaError('P2025'));
    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('memetakan Prisma P2003 (FK) → 409 CONFLICT', () => {
    const { status } = runFilter(prismaError('P2003'));
    expect(status).toBe(HttpStatus.CONFLICT);
  });

  it('kode Prisma tak dikenal → 500 tanpa membocorkan detail', () => {
    const { status, body } = runFilter(prismaError('P2010'));
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Terjadi kesalahan pada server');
  });

  it('Error tak terduga → 500 generik (tidak bocor)', () => {
    const { status, body } = runFilter(new Error('koneksi DB putus'));
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Terjadi kesalahan pada server');
    expect(body.error.message).not.toContain('koneksi DB');
  });
});
