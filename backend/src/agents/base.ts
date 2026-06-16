import { MemorySaver } from '@langchain/langgraph';
import { AgentStateAnnotation } from './state.js';
import type { AgentContext } from './context.js';

export interface StreamEvent {
  seq: number;
  event_type: string;
  payload: any;
}

export interface StreamResult {
  finalContent: string;
  agentState: any;
}

export abstract class BaseAgent {
  protected checkpointer: MemorySaver;

  constructor() {
    this.checkpointer = new MemorySaver();
  }

  abstract getGraph(context: AgentContext): any;

  async streamMessagesWithState(
    query: string,
    context: AgentContext,
    onEvent: (event: StreamEvent) => void,
  ): Promise<StreamResult> {
    const graph = this.getGraph(context);
    const compiled = graph.compile({ checkpointer: this.checkpointer });

    const input = {
      messages: [{ role: 'user', content: query }],
      threadId: context.threadId,
      todos: [],
      files: {},
      artifacts: [],
    };

    let seq = 0;
    let finalContent = '';
    let agentState: any = {};

    const stream = await compiled.stream(input, {
      configurable: { thread_id: context.threadId },
      streamMode: ['messages', 'values'] as any,
    });

    for await (const chunk of stream) {
      const [mode, data] = chunk as [string, any];

      if (mode === 'messages') {
        if (Array.isArray(data)) {
          for (const msg of data) {
            if (msg.content) {
              const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
              if (text) {
                seq++;
                onEvent({ seq, event_type: 'token', payload: { content: text } });
                finalContent += text;
              }
            }
            if (msg.tool_calls && msg.tool_calls.length > 0) {
              for (const tc of msg.tool_calls) {
                seq++;
                onEvent({ seq, event_type: 'tool_start', payload: { tool: tc.name, args: tc.args } });
              }
            }
          }
        } else if (data?.content) {
          const text = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
          if (text) {
            seq++;
            onEvent({ seq, event_type: 'token', payload: { content: text } });
            finalContent += text;
          }
        }
      } else if (mode === 'values') {
        agentState = data;
      }
    }

    return { finalContent, agentState };
  }

  async invokeMessages(query: string, context: AgentContext): Promise<string> {
    const graph = this.getGraph(context);
    const compiled = graph.compile({ checkpointer: this.checkpointer });

    const input = {
      messages: [{ role: 'user', content: query }],
      threadId: context.threadId,
      todos: [],
      files: {},
      artifacts: [],
    };

    const result = await compiled.invoke(input, {
      configurable: { thread_id: context.threadId },
    });

    const messages = result.messages ?? [];
    const lastMsg = messages[messages.length - 1];
    return typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  }
}
