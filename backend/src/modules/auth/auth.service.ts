import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  async login(username: string, _password: string) {
    return {
      access_token: 'mvp-token-001',
      token_type: 'bearer',
      user_id: 1,
      username,
      user_id_login: username,
      phone_number: '',
      avatar: '',
      role: 'admin',
      department_id: null,
      department_name: '',
    };
  }

  async getCurrentUser() {
    return {
      id: 1,
      username: 'admin',
      user_id: 'admin',
      phone_number: '',
      avatar: '',
      role: 'admin',
      department_id: null,
      department_name: '',
    };
  }

  async checkFirstRun() {
    return { first_run: false };
  }
}
