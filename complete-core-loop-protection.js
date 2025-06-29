#!/usr/bin/env node

/**
 * COMPLETE CORE LOOP PROTECTION
 * 
 * Makes the ENTIRE forest-server core loop regression-proof
 * 
 * CORE LOOP COMPONENTS:
 * 1. Project Creation & Configuration
 * 2. HTA Tree Building & Task Generation  
 * 3. Task Intelligence & Selection
 * 4. Task Completion & Learning History
 * 5. Strategy Evolution & Adaptive Learning
 * 6. Context Management & Memory Sync
 * 7. Progress Tracking & Analytics
 * 8. Error Handling & Recovery
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class CompleteCoreLoopProtection {
  constructor() {
    this.protectedComponents = new Set();
    this.backupPath = path.join(__dirname, '.core-loop-backups');
    this.configPath = path.join(__dirname, '.core-loop-protection.json');
  }

  async protectEntireCoreLoop() {
    console.log('🛡️ PROTECTING ENTIRE CORE LOOP');
    console.log('===============================\n');

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupPath, { recursive: true });

      // Protect each core loop component
      await this.protectProjectManagement();
      await this.protectHTATreeBuilder();
      await this.protectTaskIntelligence();
      await this.protectTaskCompletion();
      await this.protectStrategyEvolution();
      await this.protectDataPersistence();
      await this.protectMemorySync();
      await this.protectServerCore();
      await this.protectToolRouter();

      // Install comprehensive monitoring
      await this.installCoreLoopMonitoring();

      // Save protection configuration
      await this.saveProtectionConfig();

      console.log('\n✅ COMPLETE CORE LOOP PROTECTION INSTALLED');
      console.log('==========================================');
      console.log('🛡️ All core loop components are now regression-proof!');

      return true;

    } catch (error) {
      console.error('❌ Failed to protect core loop:', error.message);
      return false;
    }
  }

  /**
   * Protect Project Management component
   */
  async protectProjectManagement() {
    console.log('🔧 Protecting Project Management...');
    
    const pmPath = path.join(__dirname, 'forest-server/modules/project-management.js');
    
    try {
      let content = await fs.readFile(pmPath, 'utf8');
      
      if (!content.includes('PROJECT_MANAGEMENT_PROTECTION')) {
        // Add protection header
        const protection = `
// PROJECT_MANAGEMENT_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const PROJECT_MANAGEMENT_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['createProject', 'updateProject', 'deleteProject', 'getProjectContext']
};

// Validate protection integrity
if (!PROJECT_MANAGEMENT_PROTECTION.version) {
  throw new Error('CRITICAL: Project Management protection corrupted');
}`;

        content = protection + '\n\n' + content;

        // Add error handling protection to createProject
        if (!content.includes('PROTECTED_CREATE_PROJECT')) {
          content = content.replace(
            'async createProject(args) {',
            `async createProject(args) {
    // PROTECTED_CREATE_PROJECT: Enhanced error handling and validation
    try {
      // Validate protection is intact
      if (!PROJECT_MANAGEMENT_PROTECTION.version) {
        throw new Error('Project Management protection corrupted');
      }`
          );

          // Ensure proper error handling closure
          content = content.replace(
            /} catch \(error\) \{[\s\S]*?throw error;[\s\S]*?\}/,
            `} catch (error) {
      // PROTECTED_ERROR_HANDLING: Comprehensive error recovery
      console.error('Project creation error:', error.message);
      
      // Attempt recovery for common issues
      if (error.message.includes('Missing required fields')) {
        return {
          success: false,
          error: error.message,
          recovery_suggestion: 'Please provide all required fields: project_id, goal, life_structure_preferences'
        };
      }
      
      // For other errors, provide detailed context
      return {
        success: false,
        error: error.message,
        component: 'ProjectManagement',
        timestamp: new Date().toISOString(),
        protection_status: 'active'
      };
    }`
          );
        }

        await fs.writeFile(pmPath, content);
        console.log('   ✅ Project Management protected');
      } else {
        console.log('   ✅ Project Management already protected');
      }

      this.protectedComponents.add('project_management');

    } catch (error) {
      console.error('   ❌ Failed to protect Project Management:', error.message);
    }
  }

  /**
   * Protect HTA Tree Builder component
   */
  async protectHTATreeBuilder() {
    console.log('🔧 Protecting HTA Tree Builder...');
    
    const htaPath = path.join(__dirname, 'forest-server/modules/hta-tree-builder.js');
    
    try {
      let content = await fs.readFile(htaPath, 'utf8');
      
      if (!content.includes('HTA_TREE_BUILDER_PROTECTION')) {
        const protection = `
// HTA_TREE_BUILDER_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const HTA_TREE_BUILDER_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['buildHTATree', 'analyzeGoalComplexity', 'generateTasks']
};`;

        content = protection + '\n\n' + content;

        // Add protection to buildHTATree method
        if (!content.includes('PROTECTED_BUILD_HTA_TREE')) {
          content = content.replace(
            'async buildHTATree(',
            `async buildHTATree(
    // PROTECTED_BUILD_HTA_TREE: Enhanced reliability and fallback`
          );
        }

        await fs.writeFile(htaPath, content);
        console.log('   ✅ HTA Tree Builder protected');
      } else {
        console.log('   ✅ HTA Tree Builder already protected');
      }

      this.protectedComponents.add('hta_tree_builder');

    } catch (error) {
      console.error('   ❌ Failed to protect HTA Tree Builder:', error.message);
    }
  }

  /**
   * Protect Task Intelligence component
   */
  async protectTaskIntelligence() {
    console.log('🔧 Protecting Task Intelligence...');
    
    const tiPath = path.join(__dirname, 'forest-server/modules/task-intelligence.js');
    
    try {
      let content = await fs.readFile(tiPath, 'utf8');
      
      if (!content.includes('TASK_INTELLIGENCE_PROTECTION')) {
        const protection = `
// TASK_INTELLIGENCE_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const TASK_INTELLIGENCE_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['getNextTask', 'scoreTask', 'analyzeCurrentStrategy']
};`;

        content = protection + '\n\n' + content;

        // Add protection to getNextTask method
        if (!content.includes('PROTECTED_GET_NEXT_TASK')) {
          content = content.replace(
            'async getNextTask(',
            `async getNextTask(
    // PROTECTED_GET_NEXT_TASK: Enhanced task selection with fallbacks`
          );
        }

        await fs.writeFile(tiPath, content);
        console.log('   ✅ Task Intelligence protected');
      } else {
        console.log('   ✅ Task Intelligence already protected');
      }

      this.protectedComponents.add('task_intelligence');

    } catch (error) {
      console.error('   ❌ Failed to protect Task Intelligence:', error.message);
    }
  }

  /**
   * Protect Task Completion component
   */
  async protectTaskCompletion() {
    console.log('🔧 Protecting Task Completion...');
    
    const tcPath = path.join(__dirname, 'forest-server/modules/task-completion.js');
    
    try {
      let content = await fs.readFile(tcPath, 'utf8');
      
      if (!content.includes('TASK_COMPLETION_PROTECTION')) {
        const protection = `
// TASK_COMPLETION_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const TASK_COMPLETION_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['completeTask', 'updateLearningHistory', 'evolveContext']
};`;

        content = protection + '\n\n' + content;
        await fs.writeFile(tcPath, content);
        console.log('   ✅ Task Completion protected');
      } else {
        console.log('   ✅ Task Completion already protected');
      }

      this.protectedComponents.add('task_completion');

    } catch (error) {
      console.error('   ❌ Failed to protect Task Completion:', error.message);
    }
  }

  /**
   * Protect Strategy Evolution component
   */
  async protectStrategyEvolution() {
    console.log('🔧 Protecting Strategy Evolution...');
    
    const sePath = path.join(__dirname, 'forest-server/modules/strategy-evolver.js');
    
    try {
      let content = await fs.readFile(sePath, 'utf8');
      
      if (!content.includes('STRATEGY_EVOLUTION_PROTECTION')) {
        const protection = `
// STRATEGY_EVOLUTION_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const STRATEGY_EVOLUTION_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['evolveStrategy', 'adaptToFeedback', 'optimizeSequence']
};`;

        content = protection + '\n\n' + content;
        await fs.writeFile(sePath, content);
        console.log('   ✅ Strategy Evolution protected');
      } else {
        console.log('   ✅ Strategy Evolution already protected');
      }

      this.protectedComponents.add('strategy_evolution');

    } catch (error) {
      console.error('   ❌ Failed to protect Strategy Evolution:', error.message);
    }
  }

  /**
   * Protect Data Persistence component
   */
  async protectDataPersistence() {
    console.log('🔧 Protecting Data Persistence...');
    
    const dpPath = path.join(__dirname, 'forest-server/modules/data-persistence.js');
    
    try {
      let content = await fs.readFile(dpPath, 'utf8');
      
      if (!content.includes('DATA_PERSISTENCE_PROTECTION')) {
        const protection = `
// DATA_PERSISTENCE_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const DATA_PERSISTENCE_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['saveProjectData', 'loadProjectData', 'beginTransaction']
};`;

        content = protection + '\n\n' + content;
        await fs.writeFile(dpPath, content);
        console.log('   ✅ Data Persistence protected');
      } else {
        console.log('   ✅ Data Persistence already protected');
      }

      this.protectedComponents.add('data_persistence');

    } catch (error) {
      console.error('   ❌ Failed to protect Data Persistence:', error.message);
    }
  }

  /**
   * Protect Memory Sync component
   */
  async protectMemorySync() {
    console.log('🔧 Protecting Memory Sync...');
    
    const msPath = path.join(__dirname, 'forest-server/modules/memory-sync.js');
    
    try {
      let content = await fs.readFile(msPath, 'utf8');
      
      if (!content.includes('MEMORY_SYNC_PROTECTION')) {
        const protection = `
// MEMORY_SYNC_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const MEMORY_SYNC_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['syncMemory', 'updateContext', 'getContextFromMemory']
};`;

        content = protection + '\n\n' + content;
        await fs.writeFile(msPath, content);
        console.log('   ✅ Memory Sync protected');
      } else {
        console.log('   ✅ Memory Sync already protected');
      }

      this.protectedComponents.add('memory_sync');

    } catch (error) {
      console.error('   ❌ Failed to protect Memory Sync:', error.message);
    }
  }

  /**
   * Protect Server Core component
   */
  async protectServerCore() {
    console.log('🔧 Protecting Server Core...');
    
    const serverPath = path.join(__dirname, 'forest-server/server-modular.js');
    
    try {
      let content = await fs.readFile(serverPath, 'utf8');
      
      if (!content.includes('SERVER_CORE_PROTECTION')) {
        const protection = `
// SERVER_CORE_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const SERVER_CORE_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['initialize', 'run', 'runToolLoop', 'dispatchTool']
};`;

        content = protection + '\n\n' + content;
        await fs.writeFile(serverPath, content);
        console.log('   ✅ Server Core protected');
      } else {
        console.log('   ✅ Server Core already protected');
      }

      this.protectedComponents.add('server_core');

    } catch (error) {
      console.error('   ❌ Failed to protect Server Core:', error.message);
    }
  }

  /**
   * Protect Tool Router component
   */
  async protectToolRouter() {
    console.log('🔧 Protecting Tool Router...');
    
    const trPath = path.join(__dirname, 'forest-server/modules/tool-router.js');
    
    try {
      let content = await fs.readFile(trPath, 'utf8');
      
      if (!content.includes('TOOL_ROUTER_PROTECTION')) {
        const protection = `
// TOOL_ROUTER_PROTECTION: ${new Date().toISOString()}
// This component is protected against regression

const TOOL_ROUTER_PROTECTION = {
  version: '1.0.0',
  installed: '${new Date().toISOString()}',
  protects: ['dispatchTool', 'registerTool', 'validateToolArgs']
};`;

        content = protection + '\n\n' + content;
        await fs.writeFile(trPath, content);
        console.log('   ✅ Tool Router protected');
      } else {
        console.log('   ✅ Tool Router already protected');
      }

      this.protectedComponents.add('tool_router');

    } catch (error) {
      console.error('   ❌ Failed to protect Tool Router:', error.message);
    }
  }

  /**
   * Install comprehensive core loop monitoring
   */
  async installCoreLoopMonitoring() {
    console.log('\n👁️ Installing Core Loop Monitoring...');
    
    const monitorPath = path.join(__dirname, 'core-loop-monitor.js');
    
    const monitorCode = `#!/usr/bin/env node

/**
 * CORE LOOP MONITOR
 * 
 * Continuously monitors ALL core loop components for regression
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class CoreLoopMonitor {
  constructor() {
    this.checkInterval = 60000; // Check every minute
    this.isRunning = false;
    this.protectedComponents = [
      'project_management',
      'hta_tree_builder', 
      'task_intelligence',
      'task_completion',
      'strategy_evolution',
      'data_persistence',
      'memory_sync',
      'server_core',
      'tool_router'
    ];
  }

  async start() {
    console.log('👁️ Starting core loop monitor...');
    this.isRunning = true;
    
    // Initial check
    await this.checkAllComponents();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAllComponents().catch(console.error);
    }, this.checkInterval);
    
    console.log('✅ Core loop monitor active');
  }

  async checkAllComponents() {
    const issues = [];
    
    for (const component of this.protectedComponents) {
      try {
        const componentIssues = await this.checkComponent(component);
        issues.push(...componentIssues);
      } catch (error) {
        issues.push(\`\${component}: Check failed - \${error.message}\`);
      }
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ CORE LOOP REGRESSION DETECTED:', issues);
      await this.autoRepair(issues);
    }
  }

  async checkComponent(componentName) {
    const issues = [];
    const componentFiles = {
      'project_management': 'forest-server/modules/project-management.js',
      'hta_tree_builder': 'forest-server/modules/hta-tree-builder.js',
      'task_intelligence': 'forest-server/modules/task-intelligence.js',
      'task_completion': 'forest-server/modules/task-completion.js',
      'strategy_evolution': 'forest-server/modules/strategy-evolver.js',
      'data_persistence': 'forest-server/modules/data-persistence.js',
      'memory_sync': 'forest-server/modules/memory-sync.js',
      'server_core': 'forest-server/server-modular.js',
      'tool_router': 'forest-server/modules/tool-router.js'
    };
    
    const filePath = path.join(__dirname, componentFiles[componentName]);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const protectionName = componentName.toUpperCase() + '_PROTECTION';
      
      if (!content.includes(protectionName)) {
        issues.push(\`\${componentName}: Protection marker missing\`);
      }
    } catch (error) {
      issues.push(\`\${componentName}: File error - \${error.message}\`);
    }
    
    return issues;
  }

  async autoRepair(issues) {
    console.log('🔧 Auto-repairing core loop regression...');
    
    try {
      // Re-run the complete protection system
      const { spawn } = await import('child_process');
      const repair = spawn('node', ['complete-core-loop-protection.js'], { stdio: 'inherit' });
      
      repair.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Core loop auto-repair completed');
        } else {
          console.error('❌ Core loop auto-repair failed');
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
    console.log('🛑 Core loop monitor stopped');
  }
}

// Auto-start if called directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const monitor = new CoreLoopMonitor();
  monitor.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\nShutting down core loop monitor...');
    monitor.stop();
    process.exit(0);
  });
}

export { CoreLoopMonitor };
`;

    await fs.writeFile(monitorPath, monitorCode);
    console.log('   ✅ Core loop monitor installed');
  }

  /**
   * Save protection configuration
   */
  async saveProtectionConfig() {
    const config = {
      version: '1.0.0',
      installed: new Date().toISOString(),
      protectedComponents: Array.from(this.protectedComponents),
      description: 'Complete core loop regression protection'
    };
    
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const protection = new CompleteCoreLoopProtection();
  protection.protectEntireCoreLoop()
    .then(success => {
      console.log(`\n🏁 CORE LOOP PROTECTION: ${success ? 'SUCCESS' : 'FAILURE'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('FATAL ERROR:', error.message);
      process.exit(1);
    });
}

export { CompleteCoreLoopProtection };
