#!/usr/bin/env node

/**
 * Pre-commit Hook: Domain Contamination Check
 * Prevents commits that contain domain-specific contamination
 */

import { execSync } from 'child_process';
import DomainContaminationDetector from './domain-contamination-detector.js';

async function preCommitCheck() {
  console.log('🔍 Running pre-commit domain contamination check...\n');
  
  try {
    // Get list of staged files
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(file => file.endsWith('.js') && file.trim() !== '');
    
    if (stagedFiles.length === 0) {
      console.log('✅ No JavaScript files staged for commit.');
      process.exit(0);
    }
    
    console.log(`Checking ${stagedFiles.length} staged JavaScript files...\n`);
    
    const detector = new DomainContaminationDetector();
    let hasViolations = false;
    
    for (const file of stagedFiles) {
      await detector.scanFile(file);
    }
    
    const report = detector.generateReport();
    
    if (report.summary.criticalViolations > 0) {
      console.log('\n🚨 COMMIT BLOCKED: Critical domain contamination detected!');
      console.log('Please remove domain-specific content from core modules before committing.');
      process.exit(1);
    }
    
    if (report.summary.totalViolations > 0) {
      console.log('\n⚠️  WARNING: Domain contamination detected in non-critical files.');
      console.log('Consider cleaning up before committing for better code quality.');
      // Allow commit but warn
    }
    
    console.log('\n✅ Pre-commit domain check passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Pre-commit check failed:', error.message);
    process.exit(1);
  }
}

preCommitCheck();
