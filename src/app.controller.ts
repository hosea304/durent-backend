import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Health check — status hidup aplikasi (tanpa DB)' })
  @ApiOkResponse({ description: 'Aplikasi berjalan normal' })
  getHealth(): {
    data: { status: string; service: string; timestamp: string };
  } {
    return {
      data: {
        status: 'ok',
        service: 'durent-backend',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
