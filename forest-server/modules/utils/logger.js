// modules/utils/logger.js

import winston from 'winston';
import path from 'path';
import { FileSystem } from './file-system.js';

// Always resolve dataDir and logDir to absolute paths
const rawDataDir = process.env.FOREST_DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE || '', '.forest-data');
const dataDir = path.isAbsolute(rawDataDir) ? rawDataDir : path.resolve(process.cwd(), rawDataDir);
const logDir = path.resolve(dataDir, 'logs');
console.info('[LOGGER DEBUG] Resolved dataDir:', dataDir);
console.info('[LOGGER DEBUG] Resolved logDir:', logDir);
if (!logDir || typeof logDir !== 'string' || logDir.trim().length === 0) {
  console.error('[LOGGER FATAL] Log directory is invalid:', logDir);
  process.exit(1);
}

// Create logger factory function instead of immediate initialization
async function createLogger() {
  // Ensure log directory exists, fail fast if not
  if (!(await FileSystem.exists(logDir))) {
    try {
      await FileSystem.ensureDirectoryExists(logDir);
    } catch (err) {
      console.error('[LOGGER FATAL] Failed to create log directory:', logDir, err.message);
      process.exit(1);
    }
  }

  return winston.createLogger({
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
}

// Lazy logger instance
let loggerInstance = null;

async function getLogger() {
  if (!loggerInstance) {
    loggerInstance = await createLogger();
    
    // In MCP stdio environments, writing to stdout corrupts the JSON-RPC channel.
    // Enable console output ONLY when explicitly requested.
    if (process.env.FOREST_ENABLE_CONSOLE_LOG === '1') {
      loggerInstance.add(
        new winston.transports.Console({
          format: winston.format.simple(),
        })
      );
    }
  }
  return loggerInstance;
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
    const originalFn = console[fn];
    console[fn] = async (...args) => {
      try {
        const logger = await getLogger();
        logger[level](...args.map(cleanse));
      } catch (error) {
        // Fallback to original console if logger fails
        originalFn(...args);
      }
    };
  });
  /* eslint-enable no-console */
}

export default { getLogger };