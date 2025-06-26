// modules/utils/logger.js

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// This dynamically gets your project's data directory.
const dataDir = process.env.FOREST_DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE, '.forest-data');
const logDir = path.join(dataDir, 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info', // The minimum level of logs to record
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }), // Log the full stack trace on errors
    winston.format.splat(),
    winston.format.json() // Log in a structured JSON format
  ),
  defaultMeta: { service: 'forest-mcp-server' },
  transports: [
    // Transport 1: Write all logs with level 'error' or less to `error.log`
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    // Transport 2: Write all logs with level 'info' or less to `combined.log`
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    })
  ]
});

// In MCP stdio environments, writing to stdout corrupts the JSON-RPC channel.
// Enable console output ONLY when explicitly requested.
if (process.env.FOREST_ENABLE_CONSOLE_LOG === '1') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Ensure debug package never outputs colour codes
process.env.DEBUG_COLORS = '0';

// Regexes
const emojiRE = /[\p{Extended_Pictographic}]/gu; // all emojis
const ansiRE = /\x1B\[[0-9;]*[mK]/g;            // ANSI colour codes
const cleanse = arg => {
  if (typeof arg !== 'string') return arg;
  return arg.replace(ansiRE, '').replace(emojiRE, '');
};

// Redirect console.* to Winston unless explicitly opted-in
if (process.env.FOREST_ENABLE_CONSOLE_LOG !== '1') {
  /* eslint-disable no-console */
  ['log', 'info', 'warn', 'error'].forEach(fn => {
    const level = fn === 'log' ? 'info' : fn;
    console[fn] = (...args) => logger[level](...args.map(cleanse));
  });
  /* eslint-enable no-console */
}

export default logger;