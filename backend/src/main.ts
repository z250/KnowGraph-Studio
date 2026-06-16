import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { getConfig } from './common/config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = getConfig();

  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');

  await app.listen(config.PORT);
  console.log(`MyYuxi API running on http://localhost:${config.PORT}`);
}

bootstrap();
