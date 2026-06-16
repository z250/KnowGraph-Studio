import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  const user = await prisma.user.upsert({
    where: { id: 1 },
    update: {},
    create: {
      username: 'admin',
      passwordHash: '$2b$12$LJ3m4ys3L5QWmCNwDVPKae0VhWx7F.3tPKFbbKcYQZVyJ7.TZ2AHe', // placeholder
      role: 'admin',
    },
  });
  console.log('Seeded user:', user.username);

  // Create default chatbot agent config
  const config = await prisma.agentConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      agentId: 'chatbot',
      name: 'Chatbot',
      isDefault: true,
      configJson: {
        model: 'deepseek-chat',
        system_prompt: '你是 MyYuxi，一个智能知识库助手。请准确、简洁地回答用户问题。',
      },
    },
  });
  console.log('Seeded agent config:', config.name);

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
