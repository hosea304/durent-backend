import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/** Batasi endpoint ke role tertentu — dipakai bersama JwtAuthGuard + RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
