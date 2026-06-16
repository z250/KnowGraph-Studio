import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

@Injectable()
export class AgentRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { id: string; threadId: string; userId: number; agentConfigId?: number; requestId?: string; inputPayload: any }) {
    return this.prisma.agentRun.create({ data });
  }

  async findById(id: string) {
    return this.prisma.agentRun.findUnique({ where: { id } });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.agentRun.update({ where: { id }, data: { status } });
  }

  async findByThreadId(threadId: string) {
    return this.prisma.agentRun.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async getActiveRun(threadId: string) {
    return this.prisma.agentRun.findFirst({
      where: { threadId, status: { in: ['pending', 'running'] } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
