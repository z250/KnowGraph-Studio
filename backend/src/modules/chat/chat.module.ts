import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ConversationRepository } from '../../repositories/conversation.repository.js';
import { AgentRunRepository } from '../../repositories/agent-run.repository.js';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ConversationRepository, AgentRunRepository],
  exports: [ChatService],
})
export class ChatModule {}
