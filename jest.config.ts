import type { Config } from "jest";

const config: Config = {
  roots: ["dist"],
  transformIgnorePatterns: ["node_modules/(?!lodash-es|grading)"],
};

export default config;
