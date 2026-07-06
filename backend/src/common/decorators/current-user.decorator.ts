import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';

/** Payload user hasil validasi JwtStrategy (menempel di request oleh passport). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return req.user;
  },
);
