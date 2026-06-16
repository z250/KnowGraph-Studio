import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { ChatbotAgent } from '../agents/chatbot/graph.js';
import { loadConfig } from '../common/config.js';

loadConfig();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const worker = new Worker(
  'agent-run',
  async (job) => {
    const { runId } = job.data as { runId: string };

    const agentRun = await prisma.agentRun.findUnique({ where: { id: runId } });
    if (!agentRun) throw new Error(`AgentRun ${runId} not found`);

    await prisma.agentRun.update({ where: { id: runId }, data: { status: 'running' } });

    const payload = agentRun.inputPayload as any;
    const channel = `run:events:${runId}`;
    let seq = 0;

    const agent = new ChatbotAgent();

    const result = await agent.streamMessagesWithState(
      payload.query,
      {
        threadId: agentRun.threadId,
        userId: String(agentRun.userId),
        model: process.env.DEFAULT_MODEL ?? 'gpt-4o',
      },
      (event) => {
        redis.publish(channel, JSON.stringify(event));
      },
    );

    const conversation = await prisma.conversation.findUnique({ where: { threadId: agentRun.threadId } });
    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: result.finalContent,
          messageType: 'text',
        },
      });
    }

    await prisma.agentRun.update({ where: { id: runId }, data: { status: 'completed' } });

    return { runId, status: 'completed' };
  },
  {
    connection: redis,
    concurrency: 2,
    limiter: { max: 10, duration: 1000 },
  },
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', async (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
  if (job?.data?.runId) {
    await prisma.agentRun.update({
      where: { id: job.data.runId },
      data: { status: 'failed' },
    });
  }
});

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('Agent run worker started');
