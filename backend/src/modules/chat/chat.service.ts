import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma.service.js';
import { RedisService } from '../../common/redis.service.js';
import { ConversationRepository } from '../../repositories/conversation.repository.js';
import { AgentRunRepository } from '../../repositories/agent-run.repository.js';
import type { AgentChatRequest, AgentRunCreate, CreateThread } from './dto/chat.dto.js';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly conversationRepo: ConversationRepository,
    private readonly agentRunRepo: AgentRunRepository,
  ) {}

  async streamAgentChat(dto: AgentChatRequest, res: Response) {
    const { query, agent_config_id, thread_id, image_content } = dto;

    const agentConfig = await this.prisma.agentConfig.findUnique({ where: { id: agent_config_id } });
    if (!agentConfig) {
      res.write(JSON.stringify({ status: 'error', error: `Agent config ${agent_config_id} not found` }) + '\n');
      res.end();
      return;
    }

    const threadId = thread_id ?? uuidv4();
    let conversation = await this.conversationRepo.findByThreadId(threadId);
    if (!conversation) {
      conversation = await this.conversationRepo.create({
        threadId,
        userId: 1,
        agentConfigId: agent_config_id,
        title: query.slice(0, 100),
      });
    }

    await this.conversationRepo.addMessageByThreadId(threadId, {
      role: 'user',
      content: query,
      messageType: 'text',
      imageContent: image_content,
    });

    const runId = uuidv4();
    await this.agentRunRepo.create({
      id: runId,
      threadId,
      userId: 1,
      agentConfigId: agent_config_id,
      inputPayload: { query, thread_id: threadId, image_content },
    });

    res.write(JSON.stringify({ status: 'init', run_id: runId, thread_id: threadId }) + '\n');

    try {
      let fullContent = '';

      const { ChatbotAgent } = await import('../../agents/chatbot/graph.js');
      const agent = new ChatbotAgent();
      const config = agentConfig.configJson as Record<string, any>;

      const result = await agent.streamMessagesWithState(
        query,
        {
          threadId,
          userId: '1',
          model: config?.model ?? 'gpt-4o',
          systemPrompt: config?.system_prompt,
        },
        (event) => {
          if (event.event_type === 'token') {
            fullContent += event.payload.content;
            res.write(JSON.stringify({
              status: 'loading',
              response: event.payload.content,
              seq: event.seq,
            }) + '\n');
          } else if (event.event_type === 'tool_start') {
            res.write(JSON.stringify({
              status: 'tool_calling',
              tool_name: event.payload.tool,
              seq: event.seq,
            }) + '\n');
          } else if (event.event_type === 'tool_end') {
            res.write(JSON.stringify({
              status: 'tool_result',
              tool_name: event.payload.tool,
              seq: event.seq,
            }) + '\n');
          }
        },
      );

      await this.conversationRepo.addMessageByThreadId(threadId, {
        role: 'assistant',
        content: result.finalContent || fullContent,
        messageType: 'text',
      });

      await this.agentRunRepo.updateStatus(runId, 'completed');

      res.write(JSON.stringify({
        status: 'finished',
        run_id: runId,
        thread_id: threadId,
        agent_state: result.agentState ?? {},
      }) + '\n');
    } catch (err: any) {
      await this.agentRunRepo.updateStatus(runId, 'failed');
      res.write(JSON.stringify({ status: 'error', error: err.message }) + '\n');
    } finally {
      res.end();
    }
  }

  async createAgentRun(dto: AgentRunCreate, userId: number) {
    const runId = uuidv4();

    await this.agentRunRepo.create({
      id: runId,
      threadId: dto.thread_id,
      userId,
      agentConfigId: dto.agent_config_id,
      inputPayload: {
        query: dto.query,
        thread_id: dto.thread_id,
        image_content: dto.image_content,
      },
    });

    const { getAgentRunQueue } = await import('../../queue/agent-run.queue.js');
    const queue = getAgentRunQueue(this.redis.client);
    await queue.add('process-agent-run', { runId }, { jobId: `run:${runId}` });

    return { run_id: runId, thread_id: dto.thread_id, status: 'pending' };
  }

  async streamRunEvents(runId: string, afterSeq: string | undefined, res: Response) {
    const channel = `run:events:${runId}`;
    const sub = this.redis.client.duplicate();
    await sub.subscribe(channel);

    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: {}\n\n`);
    }, 15000);

    let lastSeq = 0;

    sub.on('message', (chan: string, message: string) => {
      if (chan !== channel) return;
      const event = JSON.parse(message);
      lastSeq = event.seq;

      const sseData = `event: ${event.event_type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
      res.write(sseData);
    });

    res.on('close', () => {
      clearInterval(heartbeat);
      sub.unsubscribe(channel);
      sub.quit();
    });

    setTimeout(() => {
      clearInterval(heartbeat);
      sub.unsubscribe(channel);
      sub.quit();
      if (!res.writableEnded) res.end();
    }, 30 * 60 * 1000);
  }

  async listThreads(userId: number) {
    const conversations = await this.conversationRepo.findByUserId(userId);
    return conversations.map((c) => ({
      thread_id: c.threadId,
      title: c.title,
      updated_at: c.updatedAt,
      created_at: c.createdAt,
    }));
  }

  async createThread(dto: CreateThread) {
    const threadId = uuidv4();
    const conversation = await this.conversationRepo.create({
      threadId,
      userId: 1,
      agentConfigId: dto.agent_config_id,
      title: dto.title,
    });
    return { thread_id: conversation.threadId, title: conversation.title };
  }

  async getThreadHistory(threadId: string) {
    const messages = await this.conversationRepo.getMessages(threadId);
    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      message_type: m.messageType,
      created_at: m.createdAt,
    }));
  }

  // -- Agent management --

  async getDefaultAgent() {
    const config = await this.prisma.agentConfig.findFirst({ where: { isDefault: true } });
    if (!config) {
      const first = await this.prisma.agentConfig.findFirst();
      return { default_agent_id: first?.id ?? null };
    }
    return { default_agent_id: config.id };
  }

  async getAgents() {
    const configs = await this.prisma.agentConfig.findMany({ orderBy: { createdAt: 'desc' } });
    const agents = configs.map((c) => ({
      id: c.id,
      agent_id: c.agentId,
      name: c.name,
      is_default: c.isDefault,
      configurable_items: {},
    }));
    return { agents };
  }

  async getAgentDetail(agentId: string) {
    const config = await this.prisma.agentConfig.findFirst({
      where: { agentId },
      include: { _count: { select: { conversations: true } } },
    });
    if (!config) {
      return { id: agentId, configurable_items: {} };
    }
    return {
      id: config.id,
      agent_id: config.agentId,
      name: config.name,
      is_default: config.isDefault,
      configurable_items: {},
      conversation_count: config._count.conversations,
    };
  }

  async getAgentConfigs(agentId: string) {
    const config = await this.prisma.agentConfig.findFirst({ where: { agentId } });
    if (!config) return { configs: [] };
    const configs = await this.prisma.agentConfig.findMany({ where: { agentId } });
    return {
      configs: configs.map((c) => ({
        id: c.id,
        name: c.name,
        is_default: c.isDefault,
        config_json: c.configJson,
      })),
    };
  }

  async getAgentConfigProfile(agentId: string, configId: number) {
    const config = await this.prisma.agentConfig.findUnique({ where: { id: configId } });
    if (!config) return { config: null };
    return { config: { id: config.id, name: config.name, config_json: config.configJson } };
  }

  async simpleCall(query: string) {
    const { ChatbotAgent } = await import('../../agents/chatbot/graph.js');
    const agent = new ChatbotAgent();
    const response = await agent.invokeMessages(query, {
      threadId: 'simple-call',
      userId: '1',
      model: 'gpt-4o',
    });
    return { response };
  }
}
