import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../generated/prisma/client';

const buatCtx = (user?: { role: UserRole }): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const buatGuard = (required?: UserRole[]) => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

describe('RolesGuard (RBAC §7)', () => {
  it('endpoint tanpa @Roles → lolos', () => {
    expect(buatGuard(undefined).canActivate(buatCtx())).toBe(true);
  });

  it('role sesuai (owner di [admin, owner]) → lolos', () => {
    expect(
      buatGuard(['admin', 'owner']).canActivate(buatCtx({ role: 'owner' })),
    ).toBe(true);
  });

  it('role tak sesuai (gudang ke endpoint admin) → 403', () => {
    expect(() =>
      buatGuard(['admin', 'owner']).canActivate(buatCtx({ role: 'gudang' })),
    ).toThrow(ForbiddenException);
  });

  it('tanpa user (guard salah urutan) → 403', () => {
    expect(() => buatGuard(['admin']).canActivate(buatCtx())).toThrow(
      ForbiddenException,
    );
  });
});
