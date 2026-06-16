import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByThreadId(threadId: string) {
    return this.prisma.conversation.findUnique({ where: { threadId } });
  }

  async findByUserId(userId: number) {
    return this.prisma.conversation.findMany({
      where: { userId, status: { not: 'deleted' } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(data: { threadId: string; userId: number; agentConfigId?: number; title?: string }) {
    return this.prisma.conversation.create({ data });
  }

  async update(threadId: string, data: { title?: string; status?: string; isPinned?: boolean; extraMetadata?: any }) {
    return this.prisma.conversation.update({ where: { threadId }, data });
  }

  async getMessages(threadId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { threadId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return conv?.messages ?? [];
  }

  async addMessage(data: { conversationId: number; role: string; content: string; messageType?: string; extraMetadata?: any; imageContent?: string }) {
    return this.prisma.message.create({ data });
  }

  async addMessageByThreadId(threadId: string, data: { role: string; content: string; messageType?: string; extraMetadata?: any; imageContent?: string }) {
    const conv = await this.findByThreadId(threadId);
    if (!conv) throw new Error(`Conversation not found: ${threadId}`);
    return this.addMessage({ conversationId: conv.id, ...data });
  }

  async updateMessageContent(messageId: number, content: string) {
    return this.prisma.message.update({ where: { id: messageId }, data: { content } });
  }
}
