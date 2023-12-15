import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import TransportStream from "winston-transport";
import * as _ from "lodash-es";

import { config } from "../config.js";
import { toJson } from "../utils.js";

function consolePrintf(info: Record<string, string>): string {
  const SKIP = ["level", "message", "timestamp"];
  const extras = _.omit(info, SKIP);
  let extraString = "";
  if (Object.keys(extras).length > 0) {
    extraString = " " + toJson(extras, 0);
    if (extraString.length > 40) {
      extraString = " " + toJson(extras);
    }
  }
  return (
    `${info.timestamp} ${info.level.padStart(5, " ")}: ` +
    `${info.message}${extraString}`
  );
}

const TRANSPORTS: TransportStream[] = [
  new transports.Console({
    format: format.combine(
      format.timestamp({ format: config.LOG_CONSOLE_TS }),
      format.errors({ stack: true }),
      format.colorize(),
      format.splat(),
      // format.simple(),
      // format.cli(),
      // format.prettyPrint({colorize:true}),
      format.printf(consolePrintf),
    ),
  }),
];

export const logger = createLogger({
  level: config.LOG_LEVEL.toLowerCase(),
  silent: !config.LOGGING_ENABLED,
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),
  transports: TRANSPORTS,
});

export function error(message: string, extra?: object) {
  logger.error(message, extra);
}

export function info(message: string, extra?: object) {
  logger.info(message, extra);
}
