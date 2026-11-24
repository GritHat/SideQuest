import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type SessionStore,
} from '@nestjs/authentication';

/**
 * Identity uses stateless JWT access tokens + refresh tokens, never server-side session cookies.
 * PasswordResetService still requires the `sessions` contract at boot in production and calls
 * `deleteUserSessions` during reset, so we register a no-op store here.
 */
@Injectable()
export class NoSessionStore implements SessionStore {
  constructor(storage: AuthenticationStorage) {
    storage.registerSource({ sessions: this });
  }

  getSession() {
    return Promise.resolve(undefined);
  }

  createSession() {
    return Promise.resolve();
  }

  touchSession() {
    return Promise.resolve();
  }

  deleteSession() {
    return Promise.resolve(false);
  }

  listUserSessions() {
    return Promise.resolve([]);
  }

  deleteUserSessions() {
    return Promise.resolve();
  }
}
