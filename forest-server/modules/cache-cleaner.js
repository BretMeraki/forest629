/**
 * Comprehensive Cache Cleaner Module
 * Provides foolproof cache clearing for the entire Forest MCP system
 */

import { FileSystem } from './utils/file-system.js';
import { DIRECTORIES } from './constants.js';
import { getForestLogger } from './winston-logger.js';

let logger = null;

async function getLogger() {
  if (!logger) {
    logger = await getForestLogger({ module: 'CacheCleaner' });
  }
  return logger;
}

export class CacheCleaner {
  constructor(forestServer) {
    this.forestServer = forestServer;
    this.dataDir = forestServer?.dataPersistence?.dataDir || './data';
  }

  /**
   * Clear ALL caches in the system - foolproof complete reset
   * @param {Object} options - Clearing options
   * @returns {Object} Detailed report of what was cleared
   */
  async clearAllCaches(options = {}) {
    const {
      clearLogs = false,
      clearTempFiles = true,
      clearMemoryCache = true,
      clearFileSystemCache = true,
      force = false
    } = options;

    const report = {
      timestamp: new Date().toISOString(),
      success: true,
      cleared: {
        memoryCache: false,
        fileSystemCache: false,
        tempFiles: false,
        logFiles: false,
        backgroundTasks: false
      },
      details: {
        memoryCacheEntries: 0,
        tempFilesRemoved: 0,
        logFilesRemoved: 0,
        backgroundTasksCleared: 0,
        errors: []
      }
    };

    try {
      // 1. Clear in-memory caches
      if (clearMemoryCache) {
        await this.clearMemoryCaches(report);
      }

      // 2. Clear file system caches
      if (clearFileSystemCache) {
        await this.clearFileSystemCaches(report);
      }

      // 3. Clear temporary files
      if (clearTempFiles) {
        await this.clearTemporaryFiles(report);
      }

      // 4. Clear log files (optional)
      if (clearLogs) {
        await this.clearLogFiles(report);
      }

      // 5. Clear background processor caches
      await this.clearBackgroundCaches(report);

      // 6. Force garbage collection if available
      if (force && global.gc) {
        global.gc();
        report.details.garbageCollected = true;
      }

      logger.info('Cache clearing completed successfully', report);
      return report;

    } catch (error) {
      report.success = false;
      report.details.errors.push({
        operation: 'clearAllCaches',
        error: error.message,
        stack: error.stack
      });
      logger.error('Cache clearing failed', { error: error.message, report });
      return report;
    }
  }

  /**
   * Clear all in-memory caches
   */
  async clearMemoryCaches(report) {
    try {
      let totalCleared = 0;

      // Clear DataPersistence cache
      if (this.forestServer?.dataPersistence?.cacheManager) {
        const stats = this.forestServer.dataPersistence.getCacheStats();
        totalCleared += stats.totalEntries;
        this.forestServer.dataPersistence.clearCache();
      }

      // Clear any other cache managers
      if (this.forestServer?.cacheManager) {
        const stats = this.forestServer.cacheManager.getCacheStats();
        totalCleared += stats.totalEntries;
        this.forestServer.cacheManager.clearCache();
      }

      // Clear module-level caches
      await this.clearModuleCaches();

      report.cleared.memoryCache = true;
      report.details.memoryCacheEntries = totalCleared;

    } catch (error) {
      report.details.errors.push({
        operation: 'clearMemoryCaches',
        error: error.message
      });
    }
  }

  /**
   * Clear file system based caches
   */
  async clearFileSystemCaches(report) {
    try {
      const cacheDirectories = [
        FileSystem.join(this.dataDir, '.cache'),
        FileSystem.join(this.dataDir, 'cache'),
        FileSystem.join(this.dataDir, 'tmp'),
        FileSystem.join(process.cwd(), '.cache'),
        FileSystem.join(process.cwd(), 'cache')
      ];

      let filesRemoved = 0;

      for (const cacheDir of cacheDirectories) {
        if (await FileSystem.exists(cacheDir)) {
          const files = await this.removeDirectoryContents(cacheDir);
          filesRemoved += files;
        }
      }

      report.cleared.fileSystemCache = true;
      report.details.fileSystemCacheFilesRemoved = filesRemoved;

    } catch (error) {
      report.details.errors.push({
        operation: 'clearFileSystemCaches',
        error: error.message
      });
    }
  }

  /**
   * Clear temporary files
   */
  async clearTemporaryFiles(report) {
    try {
      const tempDirectories = [
        FileSystem.join(this.dataDir, '.tmp'),
        FileSystem.join(this.dataDir, 'temp'),
        FileSystem.join(process.cwd(), '.tmp'),
        FileSystem.join(process.cwd(), 'temp'),
        FileSystem.join(require('os').tmpdir(), 'forest-mcp')
      ];

      let filesRemoved = 0;

      for (const tempDir of tempDirectories) {
        if (await FileSystem.exists(tempDir)) {
          const files = await this.removeDirectoryContents(tempDir);
          filesRemoved += files;
        }
      }

      report.cleared.tempFiles = true;
      report.details.tempFilesRemoved = filesRemoved;

    } catch (error) {
      report.details.errors.push({
        operation: 'clearTemporaryFiles',
        error: error.message
      });
    }
  }

  /**
   * Clear log files (optional - be careful!)
   */
  async clearLogFiles(report) {
    try {
      const logDirectories = [
        FileSystem.join(this.dataDir, 'logs'),
        FileSystem.join(process.cwd(), 'logs'),
        FileSystem.join(process.cwd(), 'forest-server', 'logs')
      ];

      let filesRemoved = 0;

      for (const logDir of logDirectories) {
        if (await FileSystem.exists(logDir)) {
          // Only remove log files, not the directory structure
          const files = await this.clearLogDirectory(logDir);
          filesRemoved += files;
        }
      }

      report.cleared.logFiles = true;
      report.details.logFilesRemoved = filesRemoved;

    } catch (error) {
      report.details.errors.push({
        operation: 'clearLogFiles',
        error: error.message
      });
    }
  }

  /**
   * Clear background processor caches
   */
  async clearBackgroundCaches(report) {
    try {
      let tasksCleared = 0;

      // Clear background processor if available
      if (this.forestServer?.backgroundProcessor) {
        // Stop and clear any queued cache warming tasks
        const processor = this.forestServer.backgroundProcessor;
        if (typeof processor.clearQueue === 'function') {
          tasksCleared = processor.clearQueue();
        }
      }

      report.cleared.backgroundTasks = true;
      report.details.backgroundTasksCleared = tasksCleared;

    } catch (error) {
      report.details.errors.push({
        operation: 'clearBackgroundCaches',
        error: error.message
      });
    }
  }

  /**
   * Clear Node.js module caches
   */
  async clearModuleCaches() {
    // Clear require cache for dynamic modules
    const modulePatterns = [
      /cache-manager/,
      /data-persistence/,
      /background-processor/
    ];

    for (const key of Object.keys(require.cache)) {
      if (modulePatterns.some(pattern => pattern.test(key))) {
        delete require.cache[key];
      }
    }
  }

  /**
   * Remove all contents of a directory but keep the directory
   */
  async removeDirectoryContents(dirPath) {
    let filesRemoved = 0;
    try {
      const items = await FileSystem.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = FileSystem.join(dirPath, item);
        const stats = await FileSystem.stat(itemPath);
        
        if (stats.isDirectory()) {
          await FileSystem.rmdir(itemPath, { recursive: true });
        } else {
          await FileSystem.unlink(itemPath);
        }
        filesRemoved++;
      }
    } catch (error) {
      // Directory might not exist or be empty
    }
    return filesRemoved;
  }

  /**
   * Clear log directory contents but preserve structure
   */
  async clearLogDirectory(logDir) {
    let filesRemoved = 0;
    try {
      const items = await FileSystem.readdir(logDir);
      
      for (const item of items) {
        if (item.endsWith('.log') || item.endsWith('.json')) {
          const itemPath = FileSystem.join(logDir, item);
          await FileSystem.unlink(itemPath);
          filesRemoved++;
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    return filesRemoved;
  }

  /**
   * Get current cache status across all systems
   */
  async getCacheStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      memoryCache: {},
      fileSystemCache: {},
      tempFiles: {},
      logFiles: {}
    };

    try {
      // Memory cache status
      if (this.forestServer?.dataPersistence?.getCacheStats) {
        status.memoryCache.dataPersistence = this.forestServer.dataPersistence.getCacheStats();
      }

      // File system cache status
      const cacheDirectories = [
        FileSystem.join(this.dataDir, '.cache'),
        FileSystem.join(this.dataDir, 'cache')
      ];

      for (const dir of cacheDirectories) {
        if (await FileSystem.exists(dir)) {
          const files = await FileSystem.readdir(dir);
          status.fileSystemCache[dir] = files.length;
        }
      }

      // Memory usage
      status.memoryUsage = process.memoryUsage();

    } catch (error) {
      status.error = error.message;
    }

    return status;
  }
}
