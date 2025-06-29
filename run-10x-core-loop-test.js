#!/usr/bin/env node

/**
 * 10X CORE LOOP RELIABILITY TEST
 * 
 * This script runs the comprehensive core loop test 10 times in a row
 * to validate that the "two steps forward, three steps back" regression
 * pattern has been completely eliminated.
 * 
 * SUCCESS CRITERIA:
 * - All 10 runs must pass with 100% success rate
 * - No failures, crashes, or regressions
 * - Consistent performance across all runs
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

class TenXCoreLoopTest {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runSingleTest(runNumber) {
    console.log(`\n🚀 Starting Core Loop Test Run #${runNumber}/10`);
    console.log('='.repeat(60));
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const testProcess = spawn('node', ['test-core-loop-100-coverage.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = {
          runNumber,
          exitCode: code,
          duration,
          passed: code === 0,
          stdout,
          stderr,
          timestamp: new Date().toISOString()
        };

        if (code === 0) {
          console.log(`✅ Run #${runNumber} PASSED (${duration}ms)`);
        } else {
          console.log(`❌ Run #${runNumber} FAILED (exit code: ${code}, ${duration}ms)`);
          if (stderr) {
            console.log(`🔴 Error output: ${stderr.slice(0, 500)}...`);
          }
        }

        resolve(result);
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        testProcess.kill('SIGTERM');
        resolve({
          runNumber,
          exitCode: -1,
          duration: 60000,
          passed: false,
          stdout,
          stderr: 'Test timed out after 60 seconds',
          timestamp: new Date().toISOString()
        });
      }, 60000);
    });
  }

  async runAllTests() {
    console.log('🎯 STARTING 10X CORE LOOP RELIABILITY TEST');
    console.log('🔧 Testing the fix for "two steps forward, three steps back" regression');
    console.log('📊 Target: 10/10 successful runs with 0 failures\n');

    // Clean up any existing test data
    try {
      await fs.rm('./test-data', { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }

    // Run tests sequentially to avoid interference
    for (let i = 1; i <= 10; i++) {
      const result = await this.runSingleTest(i);
      this.results.push(result);

      // If a test fails, we can optionally continue or stop
      if (!result.passed) {
        console.log(`\n⚠️ Test #${i} failed. Continuing with remaining tests...`);
      }

      // Small delay between tests to ensure clean state
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return this.generateFinalReport();
  }

  async generateFinalReport() {
    const totalDuration = Date.now() - this.startTime;
    const passedRuns = this.results.filter(r => r.passed).length;
    const failedRuns = this.results.filter(r => !r.passed).length;
    const successRate = (passedRuns / this.results.length * 100).toFixed(1);
    const avgDuration = Math.round(this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length);

    console.log('\n' + '='.repeat(80));
    console.log('📊 10X CORE LOOP RELIABILITY TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`🎯 SUCCESS RATE: ${successRate}% (${passedRuns}/10 runs passed)`);
    console.log(`✅ Passed Runs: ${passedRuns}`);
    console.log(`❌ Failed Runs: ${failedRuns}`);
    console.log(`⚡ Average Duration: ${avgDuration}ms`);
    console.log(`🕐 Total Test Time: ${Math.round(totalDuration / 1000)}s`);
    console.log(`📅 Completed: ${new Date().toISOString()}\n`);

    // Detailed run breakdown
    console.log('📋 RUN-BY-RUN BREAKDOWN:');
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      console.log(`${status} Run #${result.runNumber}: ${duration} (exit code: ${result.exitCode})`);
    });

    // Regression analysis
    console.log('\n🔍 REGRESSION ANALYSIS:');
    if (passedRuns === 10) {
      console.log('🏆 PERFECT SCORE! No regressions detected.');
      console.log('✅ The "two steps forward, three steps back" pattern has been eliminated.');
      console.log('✅ Core loop is stable and reliable across all test runs.');
    } else {
      console.log(`⚠️ ${failedRuns} regression(s) detected out of 10 runs.`);
      console.log('🔧 Further investigation needed to achieve 100% reliability.');
      
      // Show failed runs
      const failedRunNumbers = this.results.filter(r => !r.passed).map(r => r.runNumber);
      console.log(`❌ Failed runs: ${failedRunNumbers.join(', ')}`);
    }

    // Save detailed report
    const report = {
      summary: {
        totalRuns: this.results.length,
        passedRuns,
        failedRuns,
        successRate: `${successRate}%`,
        avgDuration: `${avgDuration}ms`,
        totalDuration: `${Math.round(totalDuration / 1000)}s`
      },
      results: this.results,
      timestamp: new Date().toISOString(),
      regressionFixed: passedRuns === 10
    };

    await fs.writeFile('10x-core-loop-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Detailed report saved to: 10x-core-loop-test-report.json');

    return report;
  }
}

// Main execution
async function main() {
  const testRunner = new TenXCoreLoopTest();
  const report = await testRunner.runAllTests();
  
  // Exit with success only if all 10 runs passed
  const exitCode = report.summary.passedRuns === 10 ? 0 : 1;
  console.log(`\n🏁 10X Test completed with exit code: ${exitCode}`);
  
  if (exitCode === 0) {
    console.log('🎉 MISSION ACCOMPLISHED! Core loop is 100% reliable.');
  } else {
    console.log('🔧 Mission incomplete. Core loop needs further fixes.');
  }
  
  process.exit(exitCode);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 10X Test runner crashed:', error);
    process.exit(1);
  });
}

export default TenXCoreLoopTest;
