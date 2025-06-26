#!/usr/bin/env node

/**
 * Independent Test for HTA Analysis Server
 * Tests the server in isolation to validate it works correctly
 */

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class HTAServerTester {
  constructor() {
    this.client = null;
    this.transport = null;
    this.testResults = [];
  }

  async runTests() {
    console.log('🧪 Starting HTA Analysis Server Tests\n');
    
    try {
      await this.connectToServer();
      await this.testGoalComplexityAnalysis();
      await this.testStrategicBranches();
      await this.testDepthCalculation();
      await this.testCompleteHTAStructure();
      await this.cleanup();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  async connectToServer() {
    console.log('🔌 Connecting to HTA Analysis Server...');
    
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['hta-analysis-server.js']
    });

    this.client = new Client(
      {
        name: 'hta-test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    await this.client.connect(this.transport);
    console.log('✅ Connected to HTA server\n');
  }

  async testGoalComplexityAnalysis() {
    console.log('🎯 Testing Goal Complexity Analysis...');
    
    const testCases = [
      {
        goal: 'Learn Python',
        expectedComplexity: { min: 3, max: 6 }
      },
      {
        goal: 'Build a comprehensive data analysis platform with machine learning capabilities and real-time dashboard',
        expectedComplexity: { min: 7, max: 10 }
      },
      {
        goal: 'Read a book',
        expectedComplexity: { min: 1, max: 3 }
      }
    ];

    for (const testCase of testCases) {
      try {
        const response = await this.client.request(
          {
            method: 'tools/call',
            params: {
              name: 'analyze_goal_complexity',
              arguments: { goal: testCase.goal }
            }
          },
          {}
        );

        const complexity = response.analysis.complexity_score;
        const isValid = complexity >= testCase.expectedComplexity.min && 
                       complexity <= testCase.expectedComplexity.max;

        this.testResults.push({
          test: `Complexity Analysis: "${testCase.goal}"`,
          passed: isValid,
          details: `Score: ${complexity}/10, Expected: ${testCase.expectedComplexity.min}-${testCase.expectedComplexity.max}`
        });

        console.log(`  ${isValid ? '✅' : '❌'} "${testCase.goal}" → ${complexity}/10`);
      } catch (error) {
        this.testResults.push({
          test: `Complexity Analysis: "${testCase.goal}"`,
          passed: false,
          details: `Error: ${error.message}`
        });
        console.log(`  ❌ "${testCase.goal}" → Error: ${error.message}`);
      }
    }
    console.log();
  }

  async testStrategicBranches() {
    console.log('🌳 Testing Strategic Branches Generation...');
    
    const testCases = [
      {
        goal: 'Learn Python for data analysis',
        focusAreas: [],
        expectedBranches: { min: 3, max: 6 }
      },
      {
        goal: 'Build a web application',
        focusAreas: ['Frontend', 'Backend', 'Database'],
        expectedBranches: { min: 3, max: 3 } // Should use user-defined focus areas
      }
    ];

    for (const testCase of testCases) {
      try {
        const response = await this.client.request(
          {
            method: 'tools/call',
            params: {
              name: 'generate_strategic_branches',
              arguments: {
                goal: testCase.goal,
                focus_areas: testCase.focusAreas,
                knowledge_level: 5
              }
            }
          },
          {}
        );

        const branches = response.strategic_branches;
        const branchCount = branches.length;
        const isValid = branchCount >= testCase.expectedBranches.min && 
                       branchCount <= testCase.expectedBranches.max;

        this.testResults.push({
          test: `Strategic Branches: "${testCase.goal}"`,
          passed: isValid,
          details: `Generated ${branchCount} branches, Expected: ${testCase.expectedBranches.min}-${testCase.expectedBranches.max}`
        });

        console.log(`  ${isValid ? '✅' : '❌'} "${testCase.goal}" → ${branchCount} branches`);
        branches.forEach((branch, i) => {
          console.log(`    ${i + 1}. ${branch.title}`);
        });
      } catch (error) {
        this.testResults.push({
          test: `Strategic Branches: "${testCase.goal}"`,
          passed: false,
          details: `Error: ${error.message}`
        });
        console.log(`  ❌ "${testCase.goal}" → Error: ${error.message}`);
      }
    }
    console.log();
  }

  async testDepthCalculation() {
    console.log('📏 Testing Depth Calculation...');
    
    const testCases = [
      { complexity: 3, userLevel: 2, expectedDepth: { min: 3, max: 5 } },
      { complexity: 8, userLevel: 8, expectedDepth: { min: 5, max: 8 } },
      { complexity: 5, userLevel: 5, expectedDepth: { min: 3, max: 6 } }
    ];

    for (const testCase of testCases) {
      try {
        const response = await this.client.request(
          {
            method: 'tools/call',
            params: {
              name: 'calculate_optimal_depth',
              arguments: {
                complexity_score: testCase.complexity,
                user_level: testCase.userLevel
              }
            }
          },
          {}
        );

        const depth = response.depth_config.target_depth;
        const isValid = depth >= testCase.expectedDepth.min && 
                       depth <= testCase.expectedDepth.max;

        this.testResults.push({
          test: `Depth Calculation: C${testCase.complexity}/U${testCase.userLevel}`,
          passed: isValid,
          details: `Depth: ${depth}, Expected: ${testCase.expectedDepth.min}-${testCase.expectedDepth.max}`
        });

        console.log(`  ${isValid ? '✅' : '❌'} Complexity ${testCase.complexity}, User ${testCase.userLevel} → Depth ${depth}`);
      } catch (error) {
        this.testResults.push({
          test: `Depth Calculation: C${testCase.complexity}/U${testCase.userLevel}`,
          passed: false,
          details: `Error: ${error.message}`
        });
        console.log(`  ❌ Error: ${error.message}`);
      }
    }
    console.log();
  }

  async testCompleteHTAStructure() {
    console.log('🏗️ Testing Complete HTA Structure Creation...');
    
    const testGoal = 'Learn Python for data analysis';
    
    try {
      const response = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_hta_structure',
            arguments: {
              goal: testGoal,
              focus_areas: ['pandas', 'visualization'],
              knowledge_level: 3,
              target_timeframe: '3 months',
              learning_style: 'hands-on'
            }
          }
        },
        {}
      );

      const hta = response.hta_structure;
      
      // Validate structure completeness
      const hasGoal = !!hta.goal;
      const hasComplexity = !!hta.complexity_profile;
      const hasDepthConfig = !!hta.depth_config;
      const hasBranches = Array.isArray(hta.strategic_branches) && hta.strategic_branches.length > 0;
      const hasQuestionTree = !!hta.question_tree;
      const hasDependencies = !!hta.dependencies;
      const hasMetadata = !!hta.metadata;

      const isValid = hasGoal && hasComplexity && hasDepthConfig && hasBranches && 
                     hasQuestionTree && hasDependencies && hasMetadata;

      this.testResults.push({
        test: 'Complete HTA Structure',
        passed: isValid,
        details: `Goal: ${hasGoal}, Complexity: ${hasComplexity}, Depth: ${hasDepthConfig}, Branches: ${hasBranches}, Questions: ${hasQuestionTree}, Dependencies: ${hasDependencies}, Metadata: ${hasMetadata}`
      });

      console.log(`  ${isValid ? '✅' : '❌'} Complete HTA Structure`);
      console.log(`    Goal: ${hta.goal}`);
      console.log(`    Complexity: ${hta.complexity_profile.complexity_score}/10`);
      console.log(`    Target Depth: ${hta.depth_config.target_depth}`);
      console.log(`    Strategic Branches: ${hta.strategic_branches.length}`);
      console.log(`    Question Tree: ${hta.question_tree.root_question}`);
      console.log(`    Dependencies: ${Object.keys(hta.dependencies).length} mapped`);
      
    } catch (error) {
      this.testResults.push({
        test: 'Complete HTA Structure',
        passed: false,
        details: `Error: ${error.message}`
      });
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log();
  }

  async cleanup() {
    if (this.transport) {
      await this.transport.close();
    }
  }

  printResults() {
    console.log('📊 Test Results Summary\n');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}\n`);
    
    if (total - passed > 0) {
      console.log('Failed Tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`  ❌ ${result.test}: ${result.details}`);
      });
      console.log();
    }
    
    if (passed === total) {
      console.log('🎉 All tests passed! HTA Analysis Server is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the implementation.');
      process.exit(1);
    }
  }
}

// Run the tests
const tester = new HTAServerTester();
tester.runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
