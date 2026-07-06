import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../../generated/prisma/client';

/**
 * Akses data staff. CRUD user via API TIDAK dibuat di MVP
 * (tidak ada di API_CONTRACT §3) — kelola akun lewat seed.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, is_active: true } });
  }

  findActiveById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, is_active: true } });
  }
}
