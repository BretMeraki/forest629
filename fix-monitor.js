#!/usr/bin/env node

/**
 * FIX MONITOR
 * 
 * Continuously monitors for regression and auto-repairs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class FixMonitor {
  constructor() {
    this.checkInterval = 30000; // Check every 30 seconds
    this.isRunning = false;
  }

  async start() {
    console.log('👁️ Starting fix monitor...');
    this.isRunning = true;
    
    // Immediate check
    await this.checkFixes();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkFixes().catch(console.error);
    }, this.checkInterval);
    
    console.log('✅ Fix monitor active - checking every 30 seconds');
  }

  async checkFixes() {
    const issues = [];
    
    // Check HTA Bridge
    try {
      const htaBridgePath = path.join(__dirname, 'forest-server/modules/hta-bridge.js');
      const content = await fs.readFile(htaBridgePath, 'utf8');
      
      if (!content.includes('PERMANENT_SCHEMA_FIX_INSTALLED')) {
        issues.push('HTA Bridge permanent fix missing');
      }
      
      if (!content.includes('MCP Schema validation error detected')) {
        issues.push('HTA Bridge error handling missing');
      }
    } catch (error) {
      issues.push(`HTA Bridge file error: ${error.message}`);
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ REGRESSION DETECTED:', issues);
      await this.autoRepair();
    }
  }

  async autoRepair() {
    console.log('🔧 Auto-repairing regression...');
    
    try {
      // Re-run the permanent fix installer
      const { spawn } = await import('child_process');
      const repair = spawn('node', ['install-permanent-fixes.js'], { stdio: 'inherit' });
      
      repair.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Auto-repair completed successfully');
        } else {
          console.error('❌ Auto-repair failed');
        }
      });
      
    } catch (error) {
      console.error('❌ Auto-repair failed:', error.message);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.isRunning = false;
    console.log('🛑 Fix monitor stopped');
  }
}

// Auto-start if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new FixMonitor();
  monitor.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down fix monitor...');
    monitor.stop();
    process.exit(0);
  });
}

export { FixMonitor };
