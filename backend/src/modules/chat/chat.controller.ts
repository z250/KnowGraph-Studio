import { Controller, Post, Get, Body, Param, Query, Res, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatService } from './chat.service.js';
import {
  AgentChatRequestSchema,
  AgentRunCreateSchema,
  CreateThreadSchema,
  type AgentChatRequest,
  type AgentRunCreate,
} from './dto/chat.dto.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('agent')
  async streamAgentChat(@Body() raw: AgentChatRequest, @Res() res: Response) {
    const parsed = AgentChatRequestSchema.parse(raw);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    await this.chatService.streamAgentChat(parsed, res);
  }

  @Post('runs')
  async createRun(@Body() raw: AgentRunCreate, @Req() req: Request) {
    const parsed = AgentRunCreateSchema.parse(raw);
    const userId = (req as any).user?.id ?? 1;
    return this.chatService.createAgentRun(parsed, userId);
  }

  @Get('runs/:runId/events')
  async getRunEvents(@Param('runId') runId: string, @Query('after_seq') afterSeq: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    await this.chatService.streamRunEvents(runId, afterSeq, res);
  }

  @Get('threads')
  async listThreads(@Req() req: Request) {
    const userId = (req as any).user?.id ?? 1;
    return this.chatService.listThreads(userId);
  }

  @Post('thread')
  async createThread(@Body() raw: { agent_config_id?: number; title?: string }) {
    const parsed = CreateThreadSchema.parse(raw);
    return this.chatService.createThread(parsed);
  }

  @Get('thread/:threadId/history')
  async getThreadHistory(@Param('threadId') threadId: string) {
    return this.chatService.getThreadHistory(threadId);
  }

  // -- Agent management endpoints --

  @Get('default_agent')
  async getDefaultAgent() {
    return this.chatService.getDefaultAgent();
  }

  @Get('agent')
  async getAgents() {
    return this.chatService.getAgents();
  }

  @Get('agent/:agentId')
  async getAgentDetail(@Param('agentId') agentId: string) {
    return this.chatService.getAgentDetail(agentId);
  }

  @Get('agent/:agentId/configs')
  async getAgentConfigs(@Param('agentId') agentId: string) {
    return this.chatService.getAgentConfigs(agentId);
  }

  @Get('agent/:agentId/configs/:configId')
  async getAgentConfigProfile(@Param('agentId') agentId: string, @Param('configId') configId: string) {
    return this.chatService.getAgentConfigProfile(agentId, Number(configId));
  }

  @Post('call')
  async simpleCall(@Body() body: { query: string }) {
    return this.chatService.simpleCall(body.query);
  }
}
