import "dotenv/config";

import {
  BaseConfig,
  BaseConfigImpl,
  getConfig,
  getConfigBoolean,
} from "grading";

interface Config extends BaseConfig {
  APP_PORT: string;
  DB_GIT_COMMIT: boolean;
  DB_GIT_COMMIT_SCRIPT: string;
  DB_GRADING_DIR: string;
  DB_INDECISIVE_DIR: string;
  DB_AUTH_DIR: string;
  LOG_CONSOLE_TS: string;
  LOG_TO_FILE: boolean;
  ADMIN_ID: string;
  ADMIN_SECRET: string;
  GRADER_ID: string;
  GRADER_SECRET: string;
  RATELIMIT_SECRET: string;
  RATELIMIT_DURATION: number;
  RATELIMIT_MAX: number;
  TEST_SERVER: string;
  TEST_USER1_ID: string;
  TEST_USER1_SECRET: string;
  TEST_USER2_ID: string;
  TEST_USER2_SECRET: string;
  PURGE_TOKEN_THROTTLE_MS: number;
  TOKEN_EXPIRE_MS: number;
}

class ConfigImpl extends BaseConfigImpl {
  public get APP_PORT(): string {
    return getConfig("APP_PORT", "3000");
  }

  public get DB_GRADING_DIR(): string {
    return getConfig("DB_GRADING_DIR", "./db");
  }

  public get DB_INDECISIVE_DIR(): string {
    return getConfig("DB_INDECISIVE_DIR", "./db/indecisive");
  }

  public get DB_AUTH_DIR(): string {
    return getConfig("DB_AUTH_DIR", "./db/auth");
  }

  public get DB_GIT_COMMIT(): boolean {
    return getConfigBoolean("DB_GIT_COMMIT", false);
  }

  public get DB_GIT_COMMIT_SCRIPT(): string {
    return getConfig("DB_GIT_COMMIT_SCRIPT", "");
  }

  public get LOG_TO_FILE(): boolean {
    return getConfigBoolean("LOG_TO_FILE", false);
  }

  public get LOG_CONSOLE_TS(): string {
    return getConfig("LOG_CONSOLE_TS", "YYYY-MM-DD HH:mm:ss");
  }

  public get GRADER_ID(): string {
    return getConfig("GRADER_ID", "");
  }

  public get GRADER_SECRET(): string {
    return getConfig("GRADER_SECRET", "");
  }

  public get ADMIN_ID(): string {
    return getConfig("ADMIN_ID", "");
  }

  public get ADMIN_SECRET(): string {
    return getConfig("ADMIN_SECRET", "");
  }

  public get RATELIMIT_SECRET(): string {
    return getConfig("RATELIMIT_SECRET", "");
  }

  public get RATELIMIT_DURATION(): number {
    return getConfig("RATELIMIT_DURATION", 60 * 1000, parseInt);
  }

  public get RATELIMIT_MAX(): number {
    return getConfig("RATELIMIT_MAX", 240, parseInt);
  }

  public get TEST_USER1_ID(): string {
    return getConfig("TEST_USER1_ID", "");
  }

  public get TEST_USER1_SECRET(): string {
    return getConfig("TEST_USER1_SECRET", "");
  }

  public get TEST_USER2_ID(): string {
    return getConfig("TEST_USER2_ID", "");
  }

  public get TEST_USER2_SECRET(): string {
    return getConfig("TEST_USER2_SECRET", "");
  }

  public get TEST_SERVER(): string {
    return getConfig("TEST_SERVER", "http://localhost:3000");
  }

  public get TOKEN_EXPIRE_MS(): number {
    return getConfig("TOKEN_EXPIRE_MS", 60 * 60 * 1000, parseInt);
  }

  public get PURGE_TOKEN_THROTTLE_MS(): number {
    return getConfig("PURGE_TOKEN_THROTTLE_MS", 120 * 1000, parseInt);
  }
}

export const config: Config = new ConfigImpl();
