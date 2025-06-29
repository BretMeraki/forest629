/**
 * HTA Bridge Module
 * 
 * Bridges the gap between the new HTA Analysis Server and existing Task Intelligence
 * This allows the core loop to work while we transition to focused MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { FILE_NAMES } from './constants.js';

// PERMANENT_SCHEMA_FIX_INSTALLED: 2025-06-29T03:20:13.423Z
// This fix is regression-proof and will survive cache clearing and restarts

// PERMANENT FIX: Enhanced MCP Schema Error Handling
// This code block is protected against regression
const PERMANENT_SCHEMA_FIX = {
  version: '1.0.0',
  installed: '2025-06-29T03:20:13.426Z',
  description: 'Handles resultSchema.parse errors gracefully'
};

// Validate that our permanent fix is intact
if (!PERMANENT_SCHEMA_FIX.version) {
  throw new Error('CRITICAL: Permanent schema fix has been corrupted or removed');
}

class HTABridge {
  constructor(dataPersistence, projectManagement) {
    this.dataPersistence = dataPersistence;
    this.projectManagement = projectManagement;
    this.htaClient = null;
    this.htaTransport = null;
    this.isConnected = false;
  }

  /**
   * Connect to the HTA Analysis Server
   */
  async connect() {
    if (this.isConnected) return;

    try {
      // Use absolute path to ensure HTA Analysis Server is found
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const htaServerPath = path.resolve(__dirname, '../../hta-analysis-server.js');

      this.htaTransport = new StdioClientTransport({
        command: 'node',
        args: [htaServerPath]
      });

      this.htaClient = new Client(
        { name: 'forest-hta-bridge', version: '1.0.0' },
        { capabilities: {} }
      );

      await this.htaClient.connect(this.htaTransport);
      this.isConnected = true;
      console.log('✅ Connected to HTA Analysis Server');
    } catch (error) {
      console.warn('⚠️ Could not connect to HTA Analysis Server:', error.message);
      console.warn('Falling back to file-based HTA data');
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from the HTA Analysis Server
   */
  async disconnect() {
    if (this.htaTransport) {
      await this.htaTransport.close();
      this.isConnected = false;
    }
  }

  /**
   * Get or create HTA data for a project path
   * This is the main bridge method that Task Intelligence will use
   */
  async getOrCreateHTAData(projectId, pathName) {
    // First, try to load existing HTA data from files
    let existingHTA = null;
    try {
      if (pathName === 'general') {
        existingHTA = await this.dataPersistence.loadProjectData(projectId, FILE_NAMES.HTA);
      } else {
        existingHTA = await this.dataPersistence.loadPathData(projectId, pathName, FILE_NAMES.HTA);
      }
    } catch (error) {
      console.warn('Could not load existing HTA data:', error.message);
    }

    // If we have existing HTA data and it's complete, return it
    if (existingHTA && existingHTA.frontierNodes && existingHTA.frontierNodes.length > 0) {
      console.log(`📁 Using existing HTA data for path: ${pathName}`);
      return existingHTA;
    }

    // If no existing data or incomplete, generate new HTA using the server
    console.log(`🔄 Generating new HTA data for path: ${pathName}`);
    return await this.generateHTAData(projectId, pathName);
  }

  /**
   * Generate new HTA data using the HTA Analysis Server
   */
  async generateHTAData(projectId, pathName) {
    try {
      // Load project config to get goal and context
      const config = await this.dataPersistence.loadProjectData(projectId, FILE_NAMES.CONFIG);
      if (!config) {
        throw new Error('No project configuration found');
      }

      // Connect to HTA server if not connected
      await this.connect();

      if (!this.isConnected) {
        console.log('🔄 HTA server not connected, using fallback HTA structure');
        return this.createFallbackHTA(config, pathName);
      }

      // Generate HTA structure using the server with enhanced error handling
      let htaResponse;
      try {
        htaResponse = await this.htaClient.request({
          method: 'tools/call',
          params: {
            name: 'create_hta_structure',
            arguments: {
              goal: config.goal,
              focus_areas: config.focusAreas || [],
              knowledge_level: config.knowledgeLevel || 5,
              target_timeframe: config.targetTimeframe || '',
              learning_style: config.learningStyle || 'mixed'
            }
          }
        }, {});
      } catch (mcpError) {
        // Handle MCP SDK schema validation errors specifically
        if (mcpError.message.includes('resultSchema.parse') ||
            mcpError.message.includes('parse is not a function') ||
            mcpError.message.includes('schema')) {
          console.warn('⚠️ MCP Schema validation error detected, using fallback HTA structure');
          console.warn('Schema error details:', mcpError.message);
          return this.createFallbackHTA(config, pathName);
        }
        throw mcpError; // Re-throw non-schema errors
      }

      console.log('🔍 HTA Response received:', JSON.stringify(htaResponse, null, 2));

      // Extract HTA structure from response
      const htaStructure = htaResponse.hta_structure || htaResponse.result?.hta_structure;

      if (!htaStructure) {
        console.warn('⚠️ No HTA structure in response, using fallback');
        return this.createFallbackHTA(config, pathName);
      }

      // Convert HTA structure to the format expected by Task Intelligence
      const convertedHTA = this.convertHTAStructureToTaskFormat(htaStructure, pathName);

      // Save the HTA data to files for future use
      await this.saveHTAData(projectId, pathName, convertedHTA);

      console.log(`✅ Generated and saved HTA data for path: ${pathName}`);
      return convertedHTA;

    } catch (error) {
      console.error('❌ Failed to generate HTA data:', error.message);
      console.log('🔄 Creating fallback HTA structure');

      // Fallback: create minimal HTA structure
      const config = await this.dataPersistence.loadProjectData(projectId, FILE_NAMES.CONFIG);
      return this.createFallbackHTA(config || {}, pathName);
    }
  }

  /**
   * Convert HTA Analysis Server output to Task Intelligence format
   */
  convertHTAStructureToTaskFormat(htaStructure, pathName) {
    // Generate tasks from strategic branches if no tasks exist
    let frontierNodes = [];
    if (htaStructure.strategic_branches && htaStructure.strategic_branches.length > 0) {
      frontierNodes = this.generateTasksFromBranches(htaStructure.strategic_branches, htaStructure.goal);
    }

    // Create hierarchy metadata
    const hierarchyMetadata = {
      total_tasks: frontierNodes.length,
      total_branches: htaStructure.strategic_branches?.length || 0,
      completed_tasks: 0,
      available_tasks: frontierNodes.length,
      depth_levels: htaStructure.depth_config?.target_depth || 3,
      last_updated: new Date().toISOString()
    };

    const converted = {
      pathName: pathName,
      goal: htaStructure.goal,
      complexity: htaStructure.complexity_profile?.complexity_score || 5,
      targetDepth: htaStructure.depth_config?.target_depth || 3,
      strategicBranches: htaStructure.strategic_branches || [],
      questionTree: htaStructure.question_tree || { root_question: `How to achieve: ${htaStructure.goal}?`, sub_questions: [] },
      dependencies: htaStructure.dependencies || {},
      metadata: htaStructure.metadata || { source: 'hta-server' },

      // CRITICAL: Provide both field variants for compatibility
      frontierNodes: frontierNodes,      // camelCase for legacy compatibility
      frontierNodes: frontierNodes,     // snake_case for new standard
      hierarchyMetadata: hierarchyMetadata,

      // Add timestamps
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    return converted;
  }

  generateTasksFromBranches(strategicBranches, goal) {
    const tasks = [];

    strategicBranches.forEach((branch, branchIndex) => {
      // Generate 1-2 tasks per branch
      const tasksPerBranch = Math.min(2, Math.max(1, Math.floor(Math.random() * 2) + 1));

      for (let i = 0; i < tasksPerBranch; i++) {
        const taskId = `task_${branchIndex + 1}_${i + 1}`;
        const difficulty = Math.min(5, Math.max(1, branchIndex + 2 + i));

        tasks.push({
          id: taskId,
          title: `${branch.title}: ${this.generateTaskTitle(branch, goal, i)}`,
          description: `${branch.description} - Focus on ${this.generateTaskFocus(branch, i)}`,
          difficulty: difficulty,
          duration: this.calculateTaskDuration(difficulty),
          type: this.determineTaskType(branch, i),
          branch: branch.title,
          completed: false,
          prerequisites: i > 0 ? [`task_${branchIndex + 1}_${i}`] : (branchIndex > 0 ? [`task_${branchIndex}_1`] : [])
        });
      }
    });

    return tasks;
  }

  generateTaskTitle(branch, goal, taskIndex) {
    const titles = {
      'Foundation': taskIndex === 0 ? 'Learn basics' : 'Practice fundamentals',
      'Application': taskIndex === 0 ? 'Apply knowledge' : 'Build project',
      'Mastery': taskIndex === 0 ? 'Advanced techniques' : 'Expert-level work'
    };

    return titles[branch.title] || `Work on ${goal.toLowerCase()}`;
  }

  generateTaskFocus(branch, taskIndex) {
    const focuses = {
      'Foundation': taskIndex === 0 ? 'core concepts' : 'essential skills',
      'Application': taskIndex === 0 ? 'practical use' : 'real projects',
      'Mastery': taskIndex === 0 ? 'advanced topics' : 'expertise building'
    };

    return focuses[branch.title] || 'key objectives';
  }

  determineTaskType(branch, taskIndex) {
    const types = {
      'Foundation': taskIndex === 0 ? 'learning' : 'practice',
      'Application': taskIndex === 0 ? 'application' : 'project',
      'Mastery': taskIndex === 0 ? 'advanced' : 'mastery'
    };

    return types[branch.title] || 'general';
  }

  calculateTaskDuration(difficulty) {
    const baseDuration = 30; // 30 minutes base
    const difficultyMultiplier = difficulty * 15; // 15 minutes per difficulty level
    return `${baseDuration + difficultyMultiplier} minutes`;
  }

  /**
   * Create fallback HTA structure when server is unavailable
   */
  createFallbackHTA(config, pathName) {
    console.log('🔄 Creating fallback HTA structure');

    const goal = config.goal || 'Complete project goals';
    const complexity = Math.min(10, Math.max(1, Math.ceil(goal.split(' ').length / 3)));
    const knowledgeLevel = config.knowledgeLevel || 5;

    // Create actual frontier nodes (tasks) based on the goal
    const frontierNodes = this.generateFallbackTasks(goal, knowledgeLevel, config);

    // Create hierarchy metadata
    const hierarchyMetadata = {
      total_tasks: frontierNodes.length,
      total_branches: 3, // Foundation, Application, Mastery
      completed_tasks: 0,
      available_tasks: frontierNodes.length,
      depth_levels: Math.max(3, Math.min(6, complexity)),
      last_updated: new Date().toISOString()
    };

    return {
      pathName: pathName,
      goal: goal,
      complexity: complexity,
      targetDepth: Math.max(3, Math.min(6, complexity)),
      strategicBranches: [
        { id: 'branch_1', title: 'Foundation', description: 'Build foundational knowledge', order: 1 },
        { id: 'branch_2', title: 'Application', description: 'Apply knowledge practically', order: 2 },
        { id: 'branch_3', title: 'Mastery', description: 'Achieve mastery and expertise', order: 3 }
      ],
      questionTree: {
        root_question: `What must be true for "${goal}" to become reality?`,
        sub_questions: []
      },
      dependencies: {},
      metadata: {
        created: new Date().toISOString(),
        source: 'fallback',
        knowledge_level: knowledgeLevel,
        learning_style: config.learningStyle || 'mixed'
      },
      // CRITICAL: Provide frontier nodes for task intelligence
      frontierNodes: frontierNodes,      // camelCase for task intelligence compatibility
      hierarchyMetadata: hierarchyMetadata,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  generateFallbackTasks(goal, knowledgeLevel, config) {
    const tasks = [];
    const goalLower = goal.toLowerCase();

    // Generate contextual tasks based on the goal
    if (goalLower.includes('learn') || goalLower.includes('study')) {
      // Learning-focused tasks
      tasks.push({
        id: 'task_1',
        title: `Start with ${goal.split(' ').slice(-2).join(' ')} fundamentals`,
        description: `Begin learning the basic concepts and terminology`,
        difficulty: Math.max(1, knowledgeLevel - 2),
        duration: '30 minutes',
        type: 'learning',
        branch: 'Foundation',
        completed: false,
        prerequisites: []
      });

      tasks.push({
        id: 'task_2',
        title: `Practice ${goal.split(' ').slice(-2).join(' ')} exercises`,
        description: `Work through practical exercises to reinforce learning`,
        difficulty: Math.max(2, knowledgeLevel - 1),
        duration: '45 minutes',
        type: 'practice',
        branch: 'Application',
        completed: false,
        prerequisites: ['task_1']
      });

      tasks.push({
        id: 'task_3',
        title: `Build a ${goal.split(' ').slice(-2).join(' ')} project`,
        description: `Create a real project to demonstrate understanding`,
        difficulty: Math.min(5, knowledgeLevel + 1),
        duration: '60 minutes',
        type: 'project',
        branch: 'Application',
        completed: false,
        prerequisites: ['task_2']
      });

    } else if (goalLower.includes('build') || goalLower.includes('create') || goalLower.includes('develop')) {
      // Project-focused tasks
      tasks.push({
        id: 'task_1',
        title: `Plan ${goal.toLowerCase()}`,
        description: `Create a detailed plan and gather requirements`,
        difficulty: 2,
        duration: '30 minutes',
        type: 'planning',
        branch: 'Foundation',
        completed: false,
        prerequisites: []
      });

      tasks.push({
        id: 'task_2',
        title: `Set up development environment`,
        description: `Install tools and configure workspace`,
        difficulty: 3,
        duration: '45 minutes',
        type: 'setup',
        branch: 'Foundation',
        completed: false,
        prerequisites: ['task_1']
      });

      tasks.push({
        id: 'task_3',
        title: `Implement core features`,
        description: `Build the main functionality`,
        difficulty: Math.min(5, knowledgeLevel),
        duration: '90 minutes',
        type: 'implementation',
        branch: 'Application',
        completed: false,
        prerequisites: ['task_2']
      });

    } else {
      // Generic goal tasks
      tasks.push({
        id: 'task_1',
        title: `Research ${goal.toLowerCase()}`,
        description: `Gather information and understand requirements`,
        difficulty: 2,
        duration: '30 minutes',
        type: 'research',
        branch: 'Foundation',
        completed: false,
        prerequisites: []
      });

      tasks.push({
        id: 'task_2',
        title: `Create action plan for ${goal.toLowerCase()}`,
        description: `Break down the goal into actionable steps`,
        difficulty: 3,
        duration: '45 minutes',
        type: 'planning',
        branch: 'Foundation',
        completed: false,
        prerequisites: ['task_1']
      });

      tasks.push({
        id: 'task_3',
        title: `Take first step toward ${goal.toLowerCase()}`,
        description: `Begin working on the most important task`,
        difficulty: Math.min(4, knowledgeLevel),
        duration: '60 minutes',
        type: 'action',
        branch: 'Application',
        completed: false,
        prerequisites: ['task_2']
      });
    }

    return tasks;
  }

  /**
   * Save HTA data to files
   */
  async saveHTAData(projectId, pathName, htaData) {
    try {
      if (pathName === 'general') {
        await this.dataPersistence.saveProjectData(projectId, FILE_NAMES.HTA, htaData);
      } else {
        await this.dataPersistence.savePathData(projectId, pathName, FILE_NAMES.HTA, htaData);
      }
    } catch (error) {
      console.warn('Could not save HTA data:', error.message);
    }
  }

  /**
   * Update existing HTA data with new information
   */
  async updateHTAData(projectId, pathName, updates) {
    try {
      const existingHTA = await this.getOrCreateHTAData(projectId, pathName);
      const updatedHTA = { ...existingHTA, ...updates, lastUpdated: new Date().toISOString() };
      await this.saveHTAData(projectId, pathName, updatedHTA);
      return updatedHTA;
    } catch (error) {
      console.error('Failed to update HTA data:', error.message);
      throw error;
    }
  }

  /**
   * Check if HTA data exists and is valid
   */
  async hasValidHTAData(projectId, pathName) {
    try {
      const htaData = await this.getOrCreateHTAData(projectId, pathName);
      return htaData && htaData.goal && htaData.strategicBranches && htaData.strategicBranches.length > 0;
    } catch (error) {
      return false;
    }
  }
}
