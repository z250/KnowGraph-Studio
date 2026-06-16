import type { AgentContext } from '../context.js';

export function buildPromptWithContext(context: AgentContext): string {
  if (context.systemPrompt) return context.systemPrompt;

  return [
    '你是 MyYuxi，一个智能知识库助手。',
    '你可以帮助用户回答问题、检索知识库中的信息、以及执行各种任务。',
    '回答时请保持准确、简洁、有帮助。',
    '如果用户上传了文件，请仔细阅读文件内容并基于文件内容回答。',
  ].join('\n');
}
