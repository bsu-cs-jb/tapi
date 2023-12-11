import type { Config } from "jest";

const config: Config = {
  roots: ["dist"],
  transformIgnorePatterns: ["node_modules/(?!lodash-es)"],
};

export default config;
