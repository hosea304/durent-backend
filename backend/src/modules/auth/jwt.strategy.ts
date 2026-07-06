import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string; // user id
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Cek ke DB tiap request → user yang dinonaktifkan langsung tertolak. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findActiveById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Sesi tidak valid — silakan login ulang',
        details: [],
      });
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
