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

  public get ADMIN_ID(): string {
    return getConfig("ADMIN_ID", "");
  }

  public get ADMIN_SECRET(): string {
    return getConfig("ADMIN_SECRET", "");
  }
}

export const config: Config = new ConfigImpl();
