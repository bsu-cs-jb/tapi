import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import TransportStream from "winston-transport";

import { config } from "./config.js";

const TRANSPORTS: TransportStream[] = [
  new transports.Console({
    format: format.combine(
      format.timestamp({ format: config.LOG_CONSOLE_TS }),
      // format.errors({ stack: true }),
      // format.colorize(),
      // format.simple(),
      // format.cli(),
      // format.prettyPrint({colorize:true}),
      // format.colorize(),
      format.printf(
        (info) =>
          `${info.timestamp} ${info.level.padStart(5, " ")}: ${info.message}`,
      ),
    ),
  }),
];

if (config.LOG_TO_FILE) {
  const rotateTransport = new transports.DailyRotateFile({
    filename: "tapi-%DATE%.log",
    dirname: "logs",
    datePattern: "YYYY-MM-DD-HH",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
  });

  // TRANSPORTS.push(new transports.File({ filename: "logs/combined.log" }));
  TRANSPORTS.push(rotateTransport);
}

export const logger = createLogger({
  level: config.LOG_LEVEL.toLowerCase(),
  silent: !config.LOGGING_ENABLED,
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json(),
    // format.splat(),
  ),
  transports: TRANSPORTS,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(message: string, ...data: any[]) {
  logger.info(message, ...data);
}
