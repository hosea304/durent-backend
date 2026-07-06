import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Wajib Bearer JWT valid (strategi 'jwt' — lihat modules/auth/jwt.strategy.ts). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
