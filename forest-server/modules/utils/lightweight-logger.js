// modules/utils/lightweight-logger.js
// Lightweight logger that doesn't block module loading

// @ts-nocheck

/**
 * Lightweight Logger that doesn't cause module loading hangs
 * Replaces winston-based logger with fast, non-blocking implementation
 */
class LightweightLogger {
  constructor() {
    this.logLevel = process.env.FOREST_LOG_LEVEL || 'info';
    this.enableConsole = process.env.FOREST_ENABLE_CONSOLE_LOG === '1';
    this.dataDir = process.env.FOREST_DATA_DIR || 
                   (process.env.HOME || process.env.USERPROFILE) + '/.forest-data';
    
    // Initialize asynchronously to avoid blocking module loading
    this.initPromise = this._initAsync();
  }

  /**
   * Asynchronous initialization - doesn't block module loading
   */
  async _initAsync() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const logDir = path.join(this.dataDir, 'logs');
      await fs.mkdir(logDir, { recursive: true });
      
      this.logDir = logDir;
      this.initialized = true;
    } catch (error) {
      // Fallback to console-only logging if filesystem fails
      this.initialized = false;
      if (this.enableConsole) {
        console.warn('Logger filesystem initialization failed, using console-only mode:', error.message);
      }
    }
  }

  /**
   * Log a message with specified level
   */
  _log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      service: 'forest-mcp-server',
      ...data
    };

    // Console logging (if enabled)
    if (this.enableConsole) {
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
      console[level === 'error' ? 'error' : 'log'](formattedMessage, data);
    }

    // Async file logging (non-blocking)
    this._writeToFileAsync(level, logEntry);
  }

  /**
   * Asynchronously write to log files without blocking
   */
  async _writeToFileAsync(level, logEntry) {
    try {
      await this.initPromise; // Wait for initialization
      
      if (!this.initialized) return; // Skip if filesystem unavailable

      const fs = await import('fs/promises');
      const path = await import('path');
      
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Write to combined log
      const combinedPath = path.join(this.logDir, 'combined.log');
      await fs.appendFile(combinedPath, logLine);
      
      // Write to error log if error level
      if (level === 'error') {
        const errorPath = path.join(this.logDir, 'error.log');
        await fs.appendFile(errorPath, logLine);
      }
    } catch (error) {
      // Silently fail to avoid infinite loops
      if (this.enableConsole) {
        console.error('Failed to write log file:', error.message);
      }
    }
  }

  /**
   * Clean log message of ANSI codes and emojis for file output
   */
  _cleanMessage(message) {
    if (typeof message !== 'string') return message;
    
    // Remove ANSI color codes
    const ansiRegex = /\x1B\[[0-9;]*[mK]/g;
    // Remove emojis
    const emojiRegex = /[\p{Extended_Pictographic}]/gu;
    
    return message.replace(ansiRegex, '').replace(emojiRegex, '');
  }

  // Public logging methods
  debug(message, data = {}) {
    this._log('debug', this._cleanMessage(message), data);
  }

  info(message, data = {}) {
    this._log('info', this._cleanMessage(message), data);
  }

  warn(message, data = {}) {
    this._log('warn', this._cleanMessage(message), data);
  }

  error(message, data = {}) {
    this._log('error', this._cleanMessage(message), data);
  }

  // Alias for console.log compatibility
  log(message, data = {}) {
    this.info(message, data);
  }
}

// Create singleton instance
const logger = new LightweightLogger();

// Export both the instance and class
export default logger;
export { LightweightLogger }; 