import type { AgentContext } from '../context.js';

export class ContextMiddleware {
  constructor(private readonly context: AgentContext) {}

  processMessages(messages: any[]): any[] {
    const MAX_MESSAGES = 20;
    if (messages.length <= MAX_MESSAGES) return messages;
    return messages.slice(-MAX_MESSAGES);
  }
}
