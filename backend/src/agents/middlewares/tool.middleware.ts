import type { AgentContext } from '../context.js';

export class ToolMiddleware {
  constructor(private readonly context: AgentContext) {}

  getTools(): any[] {
    return this.context.tools ?? [];
  }
}
