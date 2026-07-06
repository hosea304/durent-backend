import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService, LoginResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
// wajib `import type` untuk tipe di signature ber-decorator (isolatedModules)
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Endpoint publik target brute-force → jauh lebih ketat dari default global
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Login staff (admin/gudang/owner) → JWT' })
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil + role user yang sedang login' })
  me(@CurrentUser() user: AuthUser): { data: AuthUser } {
    return { data: user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Akhiri sesi — JWT stateless, client wajib membuang token (D24)',
  })
  logout(): { data: { message: string } } {
    return { data: { message: 'Sesi diakhiri — hapus token di sisi client' } };
  }
}
