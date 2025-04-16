import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatGateway } from './chat/chat.gateway';
import { AiService } from './ai/ai.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ChatGateway, AiService],
})
export class AppModule {}
