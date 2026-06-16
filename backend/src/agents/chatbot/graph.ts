import { ChatOpenAI } from '@langchain/openai';
import { StateGraph } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base.js';
import { AgentStateAnnotation, type AgentState } from '../state.js';
import type { AgentContext } from '../context.js';
import { buildPromptWithContext } from './prompt.js';
import { ToolMiddleware } from '../middlewares/tool.middleware.js';
import { ContextMiddleware } from '../middlewares/context.middleware.js';
import { getConfig } from '../../common/config.js';

export class ChatbotAgent extends BaseAgent {
  getGraph(context: AgentContext) {
    const systemPrompt = buildPromptWithContext(context);
    const model = this.createModel(context.model);

    const toolMiddleware = new ToolMiddleware(context);
    const contextMiddleware = new ContextMiddleware(context);

    const tools = toolMiddleware.getTools();

    const graph = new StateGraph(AgentStateAnnotation)
      .addNode('prepare', async (state: AgentState) => {
        const history = contextMiddleware.processMessages(state.messages ?? []);
        const systemMsg = new SystemMessage(systemPrompt);
        return { messages: [systemMsg, ...history] };
      })
      .addNode('chat', async (state: AgentState) => {
        const llm = tools.length > 0 ? model.bindTools(tools) : model;
        const response = await llm.invoke(state.messages);
        return { messages: [response] };
      })
      .addEdge('__start__', 'prepare')
      .addEdge('prepare', 'chat')
      .addEdge('chat', '__end__');

    return graph;
  }

  private createModel(modelName: string): ChatOpenAI {
    const config = getConfig();
    return new ChatOpenAI({
      modelName: modelName || config.DEFAULT_MODEL,
      openAIApiKey: config.OPENAI_API_KEY,
      configuration: config.OPENAI_BASE_URL ? { baseURL: config.OPENAI_BASE_URL } : undefined,
      temperature: 0.7,
      streaming: true,
    });
  }
}
