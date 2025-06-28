/**
 * Regression Test for FS Import Issues
 * Prevents future "fs is not defined" errors and ensures architectural consistency
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('FS Import Regression Tests', () => {
  describe('Static Code Analysis', () => {
    let moduleFiles = [];

    beforeAll(async () => {
      // Scan all JavaScript files in the modules directory
      const modulesDir = path.join(projectRoot, 'modules');
      moduleFiles = await scanJavaScriptFiles(modulesDir);
    });

    test('should not have direct fs method usage without imports', async () => {
      const fsMethods = [
        'fs.writeFile', 'fs.readFile', 'fs.rename', 'fs.copyFile', 'fs.mkdir',
        'fs.rmdir', 'fs.unlink', 'fs.stat', 'fs.access', 'fs.readdir',
        'fs.appendFile', 'fs.chmod', 'fs.chown'
      ];

      const violations = [];

      for (const filePath of moduleFiles) {
        // Skip the FileSystem utility itself
        if (filePath.includes('utils/file-system.js')) {
          continue;
        }

        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');

        // Check for fs method usage
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const method of fsMethods) {
            if (line.includes(method) && !line.trim().startsWith('//')) {
              // Check if fs is imported in this file
              const hasValidImport = content.includes("import fs from 'fs'") ||
                                   content.includes("import * as fs from 'fs'") ||
                                   content.includes("import fs from 'fs/promises'") ||
                                   content.includes("import * as fs from 'fs/promises'") ||
                                   content.includes("const fs = require('fs')");

              if (!hasValidImport) {
                violations.push({
                  file: path.relative(projectRoot, filePath),
                  line: i + 1,
                  method: method,
                  content: line.trim()
                });
              }
            }
          }
        }
      }

      if (violations.length > 0) {
        const errorMessage = violations.map(v => 
          `${v.file}:${v.line} - ${v.method} used without import: ${v.content}`
        ).join('\n');
        
        fail(`Found fs method usage without proper imports:\n${errorMessage}`);
      }
    });

    test('should not have bare fs imports outside FileSystem utility', async () => {
      const violations = [];

      for (const filePath of moduleFiles) {
        // Skip the FileSystem utility itself
        if (filePath.includes('utils/file-system.js')) {
          continue;
        }

        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Check for fs imports
          if ((line.includes("import") && (line.includes("'fs'") || line.includes('"fs"') || 
               line.includes("'fs/promises'") || line.includes('"fs/promises"'))) ||
              line.includes("require('fs')") || line.includes('require("fs")')) {
            
            violations.push({
              file: path.relative(projectRoot, filePath),
              line: i + 1,
              content: line
            });
          }
        }
      }

      if (violations.length > 0) {
        const errorMessage = violations.map(v => 
          `${v.file}:${v.line} - Direct fs import: ${v.content}`
        ).join('\n');
        
        fail(`Found direct fs imports outside FileSystem utility:\n${errorMessage}\nAll file operations should use the FileSystem utility abstraction.`);
      }
    });

    test('should use FileSystem utility for file operations', async () => {
      const fileSystemMethods = [
        'FileSystem.writeFile', 'FileSystem.readFile', 'FileSystem.writeJSON',
        'FileSystem.readJSON', 'FileSystem.exists', 'FileSystem.deleteFile',
        'FileSystem.mkdir', 'FileSystem.copyFile', 'FileSystem.rename',
        'FileSystem.atomicWriteJSON'
      ];

      let totalFileSystemUsage = 0;

      for (const filePath of moduleFiles) {
        const content = await fs.readFile(filePath, 'utf8');
        
        for (const method of fileSystemMethods) {
          const matches = content.match(new RegExp(method.replace('.', '\\.'), 'g'));
          if (matches) {
            totalFileSystemUsage += matches.length;
          }
        }
      }

      // We should have at least some FileSystem usage in the modules
      expect(totalFileSystemUsage).toBeGreaterThan(0);
    });
  });

  describe('Runtime Validation', () => {
    test('should not throw "fs is not defined" during data persistence operations', async () => {
      const { DataPersistence } = await import('../modules/data-persistence.js');
      
      const tempDir = path.join(process.cwd(), '.tmp-regression-test');
      const dp = new DataPersistence(tempDir);
      
      // Test that atomic write method exists and is callable
      expect(typeof dp._atomicWriteJSON).toBe('function');
      
      // Test that it doesn't throw "fs is not defined"
      const testData = { test: 'regression', timestamp: Date.now() };
      const testFile = path.join(tempDir, 'regression-test.json');
      
      await expect(dp._atomicWriteJSON(testFile, testData)).resolves.not.toThrow();
      
      // Cleanup
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should handle focus_areas_test operations without fs errors', async () => {
      // This test simulates the specific operation that was failing
      const { DataPersistence } = await import('../modules/data-persistence.js');
      
      const tempDir = path.join(process.cwd(), '.tmp-focus-areas-test');
      const dp = new DataPersistence(tempDir);
      
      const focusAreasData = {
        focus_areas: ['test-area-1', 'test-area-2'],
        timestamp: Date.now(),
        metadata: { test: true }
      };
      
      const testFile = path.join(tempDir, 'focus_areas.json');
      
      // This should not throw "fs is not defined" error
      await expect(dp._atomicWriteJSON(testFile, focusAreasData)).resolves.not.toThrow();
      
      // Cleanup
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should handle transaction rollback scenarios', async () => {
      const { DataPersistence } = await import('../modules/data-persistence.js');
      
      const tempDir = path.join(process.cwd(), '.tmp-transaction-test');
      const dp = new DataPersistence(tempDir);
      
      // Test that transaction-related operations don't cause fs errors
      const testData = { transaction: 'test', rollback: true };
      const testFile = path.join(tempDir, 'transaction-test.json');
      
      // This should work without fs import errors
      await expect(dp._atomicWriteJSON(testFile, testData)).resolves.not.toThrow();
      
      // Cleanup
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  describe('Module Import Validation', () => {
    test('should import all core modules without fs-related errors', async () => {
      const coreModules = [
        '../modules/data-persistence.js',
        '../modules/core-infrastructure.js',
        '../modules/winston-logger.js',
        '../modules/utils/file-system.js'
      ];

      for (const modulePath of coreModules) {
        await expect(import(modulePath)).resolves.not.toThrow();
      }
    });

    test('should instantiate DataPersistence without errors', async () => {
      const { DataPersistence } = await import('../modules/data-persistence.js');
      
      expect(() => new DataPersistence('./test-dir')).not.toThrow();
    });
  });
});

/**
 * Helper function to recursively scan for JavaScript files
 */
async function scanJavaScriptFiles(dir) {
  const files = [];
  
  async function scan(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return files;
}