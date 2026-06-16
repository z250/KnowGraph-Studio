import { z } from 'zod';

export const AgentChatRequestSchema = z.object({
  query: z.string().min(1),
  agent_config_id: z.number().int().positive(),
  thread_id: z.string().optional(),
  image_content: z.string().optional(),
});

export type AgentChatRequest = z.infer<typeof AgentChatRequestSchema>;

export const AgentRunCreateSchema = z.object({
  query: z.string().min(1),
  agent_config_id: z.number().int().positive(),
  thread_id: z.string().min(1),
  image_content: z.string().optional(),
});

export type AgentRunCreate = z.infer<typeof AgentRunCreateSchema>;

export const CreateThreadSchema = z.object({
  agent_config_id: z.number().int().positive().optional(),
  title: z.string().optional(),
});

export type CreateThread = z.infer<typeof CreateThreadSchema>;

export interface SSEEvent {
  seq: number;
  event_type: string;
  payload: any;
}

export interface AgentStatePayload {
  todos: any[];
  files: Record<string, any>;
  artifacts: string[];
}
