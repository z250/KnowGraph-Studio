import { Controller, Get } from '@nestjs/common';

@Controller('system')
export class SystemController {
  @Get('info')
  getInfo() {
    return {
      success: true,
      data: {
        organization: { name: 'MyYuxi', logo: '', avatar: '' },
        branding: { name: 'MyYuxi', title: '智能知识库平台', subtitle: 'Knowledge Management', subtitles: [] },
        features: [],
        footer: { copyright: '', user_agreement_url: '', privacy_policy_url: '' },
      },
    };
  }

  @Get('health')
  checkHealth() {
    return { status: 'ok', version: '0.1.0' };
  }
}
