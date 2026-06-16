import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './modules/chat/chat.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { PrismaModule } from './common/prisma.module.js';
import { RedisModule } from './common/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    SystemModule,
    ChatModule,
  ],
})
export class AppModule {}
