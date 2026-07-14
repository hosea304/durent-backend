import { Module } from '@nestjs/common';
import { WhatsappAdapter } from './whatsapp.adapter';

/** Integrasi eksternal via adapter: WhatsApp (MVP) → payment gateway (Future). */
@Module({
  providers: [WhatsappAdapter],
  exports: [WhatsappAdapter],
})
export class IntegrationsModule {}
