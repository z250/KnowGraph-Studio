import type { AgentContext } from '../context.js';

export class KnowledgeBaseMiddleware {
  constructor(private readonly context: AgentContext) {}

  async search(_query: string): Promise<any[]> {
    return [];
  }

  getRetrievalTool() {
    return null;
  }
}
