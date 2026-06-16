import { Annotation } from '@langchain/langgraph';

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  todos: Annotation<any[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  files: Annotation<Record<string, any>>({
    reducer: (_, b) => b,
    default: () => ({}),
  }),
  artifacts: Annotation<string[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  threadId: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;
