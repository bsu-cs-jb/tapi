import "dotenv/config";

import { BaseConfig, BaseConfigImpl, getConfig, getConfigBoolean } from "grading";

interface Config extends BaseConfig {
  APP_PORT: string;
  DB_GIT_COMMIT: boolean;
  DB_GIT_COMMIT_SCRIPT: string;
  DB_GRADING_DIR: string;
  DB_INDECISIVE_DIR: string;
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

  public get DB_GIT_COMMIT(): boolean {
    return getConfigBoolean("DB_GIT_COMMIT", false);
  }

  public get DB_GIT_COMMIT_SCRIPT(): string {
    return getConfig("DB_GIT_COMMIT_SCRIPT", "");
  }
}

export const config: Config = new ConfigImpl();
