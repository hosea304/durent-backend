import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';

export interface LoginResult {
  data: { access_token: string; user: AuthUser };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findActiveByEmail(dto.email);
    // Pesan sengaja sama untuk email tak dikenal vs password salah
    const valid =
      user !== null && (await argon2.verify(user.password_hash, dto.password));
    if (!valid || user === null) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Email atau password salah',
        details: [],
      });
    }

    const access_token = await this.jwt.signAsync({ sub: user.id });
    return {
      data: {
        access_token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    };
  }
}
