import { Global, Module } from '@nestjs/common';
import { EmailsService } from './emails.service.js';
import { NotificationsService } from './notifications.service.js';

// Global : la gestion du compte envoie aussi des e-mails
@Global()
@Module({
  providers: [EmailsService, NotificationsService],
  exports: [EmailsService],
})
export class EmailsModule {}
