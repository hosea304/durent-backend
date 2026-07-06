import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/** Staff (admin/gudang/owner) — dipakai AuthModule; tanpa endpoint di MVP. */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
