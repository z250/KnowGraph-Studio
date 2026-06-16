export interface AgentContext {
  threadId: string;
  userId: string;
  systemPrompt?: string;
  model: string;
  tools?: any[];
}
