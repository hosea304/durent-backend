import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService.login', () => {
  const buatService = (userDiDb: unknown) => {
    const users = {
      findActiveByEmail: jest.fn().mockResolvedValue(userDiDb),
    } as unknown as UsersService;
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('token-uji'),
    } as unknown as JwtService;
    return new AuthService(users, jwt);
  };

  it('email tak terdaftar / nonaktif → 401', async () => {
    const service = buatService(null);
    await expect(
      service.login({ email: 'x@x.com', password: 'apapun' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('password salah → 401 (pesan sama dengan email salah)', async () => {
    const service = buatService({
      id: 'u1',
      name: 'Owner',
      email: 'owner@durent.id',
      role: 'owner',
      password_hash: await argon2.hash('password-benar'),
    });
    await expect(
      service.login({ email: 'owner@durent.id', password: 'password-salah' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('kredensial benar → access_token + profil user (tanpa hash)', async () => {
    const service = buatService({
      id: 'u1',
      name: 'Owner',
      email: 'owner@durent.id',
      role: 'owner',
      password_hash: await argon2.hash('password-benar'),
    });
    const res = await service.login({
      email: 'owner@durent.id',
      password: 'password-benar',
    });
    expect(res.data.access_token).toBe('token-uji');
    expect(res.data.user).toEqual({
      id: 'u1',
      name: 'Owner',
      email: 'owner@durent.id',
      role: 'owner',
    });
  });
});
