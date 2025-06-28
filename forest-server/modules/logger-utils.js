import { FileSystem } from './utils/file-system.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

// Ensure log directory exists
export async function ensureLogDir() {
  // Use module location to resolve logs directory, not current working directory
  // This fixes issues when Claude Desktop runs the server from a different working directory
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(moduleDir, '../'); // modules -> project root
  const logDir = path.resolve(projectRoot, 'logs');

  if (!(await FileSystem.exists(logDir))) {
    await FileSystem.ensureDirectoryExists(logDir);
  }
  return logDir;
}

// Return a YYYY-MM-DD dated log path for a given baseName (e.g., 'error')
export async function getDatedLogPath(baseName) {
  const dir = await ensureLogDir();
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(dir, `${baseName}-${date}.log`);
}

// Write a JSON line record safely (fire-and-forget)
export function writeJsonLine(filePath, payload) {
  try {
    fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, () => {});
  } catch (_) {
    // Ignore write failures to avoid recursive loops
  }
}