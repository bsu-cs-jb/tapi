import 'dotenv/config'

interface Config extends BaseConfig {
  APP_PORT: string;
}

class ConfigImpl extends BaseConfigImpl {
  public get APP_PORT():string {
    return getConfig("APP_PORT", "3000");
  }
}

export const config:Config = new ConfigImpl();
