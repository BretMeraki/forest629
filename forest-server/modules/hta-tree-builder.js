// @ts-nocheck
// ============================================
// HTA DEEP HIERARCHY SYSTEM
// Supports multi-level depth based on goal complexity
// ============================================

import { FILE_NAMES, DEFAULT_PATHS, HTA_LEVELS } from './constants.js';
import { buildRichContext, formatConstraintsForPrompt } from './context-utils.js';
import { FEATURE_FLAGS } from './constants.js';

export class HtaTreeBuilder {
  constructor(dataPersistence, projectManagement, claudeInterface) {
    this.dataPersistence = dataPersistence;
    this.projectManagement = projectManagement;
    this.claudeInterface = claudeInterface;
    this.logger = console; // Simple logger fallback
  }

  /**
   * Build a deep, complexity-aware HTA tree (ONLY ONCE PER PROJECT)
   * After initial generation, use branch evolution instead
   */
  async buildHTATree(pathName, learningStyle = 'mixed', focusAreas = [], goalOverride = null, contextOverride = '') {
    // Begin transaction to prevent partial state mutations
    const transaction = this.dataPersistence.beginTransaction();
    
    try {
      // PHASE 1: DEFENSIVE PROGRAMMING - Comprehensive validation before requireActiveProject call
      if (!this.projectManagement) {
        throw new Error('ProjectManagement instance is null or undefined in HtaTreeBuilder');
      }

      // Validate object type and structure
      const pmType = typeof this.projectManagement;
      const pmConstructor = this.projectManagement.constructor?.name;
      const pmPrototype = Object.getPrototypeOf(this.projectManagement);
      
      // Check if requireActiveProject method exists
      const hasMethod = typeof this.projectManagement.requireActiveProject === 'function';
      
      if (!hasMethod) {
        // Gather comprehensive debugging information
        const availableMethods = Object.getOwnPropertyNames(this.projectManagement)
          .filter(prop => typeof this.projectManagement[prop] === 'function');
        const prototypeChain = [];
        let currentProto = pmPrototype;
        while (currentProto && currentProto !== Object.prototype) {
          prototypeChain.push(currentProto.constructor?.name || 'Unknown');
          currentProto = Object.getPrototypeOf(currentProto);
        }
        
        const errorDetails = {
          objectType: pmType,
          constructorName: pmConstructor,
          availableMethods: availableMethods,
          prototypeChain: prototypeChain,
          methodExists: hasMethod,
          objectKeys: Object.keys(this.projectManagement || {}),
          objectDescriptor: Object.getOwnPropertyDescriptor(this.projectManagement, 'requireActiveProject'),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString()
        };
        
        throw new Error(`requireActiveProject method not found on ProjectManagement object. Debug info: ${JSON.stringify(errorDetails, null, 2)}`);
      }

      // Try-catch wrapper around the method call with enhanced error context
      let projectId;
      try {
        projectId = await this.projectManagement.requireActiveProject();
      } catch (methodError) {
        const enhancedError = new Error(`requireActiveProject method call failed: ${methodError.message}`);
        enhancedError.originalError = methodError;
        enhancedError.debugContext = {
          objectState: {
            constructorName: pmConstructor,
            methodExists: hasMethod,
            objectType: pmType
          },
          callStack: methodError.stack,
          timestamp: new Date().toISOString()
        };
        throw enhancedError;
      }

      // Add comprehensive project context validation and logging
      this.logger.debug('HTA build context', { 
        projectId, 
        activePath: pathName, 
        goal: goalOverride || 'from config',
        focusAreas: focusAreas?.length || 0,
        learningStyle,
        transaction: transaction.id
      });

      const config = await this.dataPersistence.loadProjectData(projectId, FILE_NAMES.CONFIG);
      
      // Apply overrides when provided to ensure proper domain isolation
      if (goalOverride && typeof goalOverride === 'string') {
        config.goal = goalOverride;
      }
      if (contextOverride && typeof contextOverride === 'string') {
        config.context = contextOverride;
      }

      if (!config.goal) {
        throw new Error('Project must have a goal defined to build HTA tree');
      }

      // CRITICAL: Check if HTA tree already exists - only generate ONCE per project
      const existingHTA = await this.loadPathHTA(projectId, pathName || 'general');
      if (existingHTA && existingHTA.frontierNodes && existingHTA.frontierNodes.length > 0) {
        console.log(`[HTA] Tree already exists for project ${projectId}, path ${pathName}. Use branch evolution instead.`);

        // Return existing tree status instead of regenerating
        return {
          success: true,
          content: [{
            type: 'text',
            text: `**HTA Tree Already Exists**\n\n**Goal**: ${existingHTA.goal}\n**Complexity**: ${existingHTA.complexity?.score || 'Unknown'}/10\n**Tasks**: ${existingHTA.frontierNodes.length} generated\n**Created**: ${existingHTA.created}\n\n**Tree is ready!** Use \`get_next_task\` to continue your journey.\n\n**Note**: HTA trees are generated only once per project. Use branch evolution to expand specific areas as you learn.`
          }],
          existing_tree: true,
          tasks_count: existingHTA.frontierNodes.length,
          complexity: existingHTA.complexity,
          next_task: await this.getNextTaskFromExistingTree(existingHTA)
        };
      }

      // Analyze goal complexity to determine tree depth
      const complexityAnalysis = this.analyzeGoalComplexity(config.goal, config.context);
      
      // Build rich context for later quality checks / prompt enrichment
      const projectContext = buildRichContext(config);
      
      // Generate the collaborative prompt for deep branch creation
      const branchPrompt = this.generateDeepBranchPrompt(config, learningStyle, focusAreas, complexityAnalysis);
      
      // Initialize HTA structure with hierarchy support
      const htaData = {
        projectId,
        pathName: pathName || 'general',
        created: new Date().toISOString(),
        learningStyle,
        focusAreas,
        goal: config.goal,
        context: config.context || '',
        complexity: complexityAnalysis,
        strategicBranches: [],
        frontier_nodes: [],
        completed_nodes: [],
        collaborative_sessions: [],
        hierarchy_metadata: {
          total_depth: complexityAnalysis.recommended_depth,
          total_branches: 0,
          total_sub_branches: 0,
          total_tasks: 0,
          branch_task_distribution: {}
        },
        generation_context: {
          method: 'deep_hierarchical_ai',
          timestamp: new Date().toISOString(),
          goal: config.goal,
          complexity_score: complexityAnalysis.score,
          awaiting_generation: true
        }
      };

      // If we have a Claude interface, try to generate tasks automatically
      if (this.claudeInterface) {
        try {
          // Request task generation from Claude
          const claudeResponse = await this.claudeInterface.requestIntelligence('task_generation', {
            prompt: branchPrompt
          });
          
          // Parse the (potentially richer) response
          const parsedData = this.parseClaudeResponse(claudeResponse) || {};
          
          // Extract tasks and (optionally) a Claude-supplied complexity profile
          let generatedTasks = [];
          let claudeComplexityProfile = null;

          if (Array.isArray(parsedData)) {
            generatedTasks = parsedData;
          } else if (parsedData && typeof parsedData === 'object') {
            if (Array.isArray(parsedData.branch_tasks)) {
              generatedTasks = parsedData.branch_tasks;
            } else if (Array.isArray(parsedData.tasks)) {
              generatedTasks = parsedData.tasks;
            }
            if (parsedData.complexity_profile) {
              claudeComplexityProfile = parsedData.complexity_profile;
            }
          }

          // Persist Claude's complexity profile if provided (useful for future adaptation)
          if (claudeComplexityProfile) {
            htaData.claude_complexity_profile = claudeComplexityProfile;
          }
          
          // QUALITY CONTROL --------------------------------------------------
          let reject = false;
          let shouldRejectResponseFn = null;
          if (FEATURE_FLAGS.QUALITY_CONTROL_ENABLED) {
            const mod = await import('./task-quality-verifier.js');
            shouldRejectResponseFn = mod.shouldRejectResponse;
            reject = shouldRejectResponseFn(generatedTasks, projectContext);
            if (reject) {
              console.warn('[HTA] Claude response rejected by quality verifier – falling back to skeleton');
            }
          }
          
          if (generatedTasks && generatedTasks.length > 0 && !reject) {
            // Transform generated tasks into frontier_nodes format
            const frontierNodes = this.transformTasksToFrontierNodes(generatedTasks);
            
            // Update HTA data with populated tasks
            htaData.frontier_nodes = frontierNodes;
            htaData.hierarchy_metadata.total_tasks = frontierNodes.length;
            htaData.generation_context.awaiting_generation = false;
            htaData.strategicBranches = this.deriveStrategicBranches(frontierNodes);
            
            // Add validation hook before saving
            transaction.operations.push({
              type: 'validate',
              data: htaData,
              validator: (data) => data.frontier_nodes && data.frontier_nodes.length > 0,
              reason: 'HTA data must have frontier nodes'
            });
            
            // Save updated structure with tasks using transaction
            await this.dataPersistence.savePathData(projectId, pathName || 'general', 'hta.json', htaData, transaction);
            
            // Ensure the updateActivePath call is properly awaited and add error handling
            if (this.projectManagement && typeof this.projectManagement.updateActivePath === 'function') {
              try {
                await this.projectManagement.updateActivePath(pathName || 'general');
              } catch (syncErr) {
                this.logger.warn('Failed to sync activePath', { error: syncErr.message });
                // Don't fail the build, but log for debugging
              }
            }

            // Commit transaction
            await this.dataPersistence.commitTransaction(transaction);

            return {
              success: true,
              content: [{
                type: 'text',
                text: `**HTA Tree Created with ${frontierNodes.length} Tasks!**\n\n**Your Goal**: ${config.goal}\n\n**Generated Structure**:\n- Tasks Created: ${frontierNodes.length}\n- Complexity Score: ${complexityAnalysis.score}/10\n- Ready to Start Learning!\n\n**Available Tasks**:\n${frontierNodes.slice(0, 3).map(task => `- ${task.title} (${task.difficulty}/5 difficulty)`).join('\n')}\n${frontierNodes.length > 3 ? `- ... and ${frontierNodes.length - 3} more tasks` : ''}\n\n**Next Steps**: Use \`get_next_task\` to start your learning journey!`
              }],
              generation_prompt: branchPrompt,
              complexity_analysis: complexityAnalysis,
              requires_branch_generation: false,
              tasks_generated: frontierNodes.length
            };
          }
        } catch (claudeError) {
          // If Claude generation fails, fall back to skeleton generation
          console.warn('Claude generation failed, falling back to skeleton:', claudeError.message);
        }
      }

      // Fallback: Generate simple skeleton tasks if Claude isn't available or fails
      const skeletonTasks = this.generateSkeletonTasks(complexityAnalysis, config, focusAreas, learningStyle);
      htaData.frontier_nodes = skeletonTasks;
      htaData.hierarchy_metadata.total_tasks = skeletonTasks.length;
      htaData.generation_context.awaiting_generation = false;
      htaData.strategicBranches = this.deriveStrategicBranches(skeletonTasks);

      // Add validation hook before saving
      transaction.operations.push({
        type: 'validate',
        data: htaData,
        validator: (data) => data.frontier_nodes && data.frontier_nodes.length > 0,
        reason: 'HTA data must have frontier nodes'
      });

      // Save structure with skeleton tasks using transaction
      await this.dataPersistence.savePathData(projectId, pathName || 'general', 'hta.json', htaData, transaction);

      // Ensure activePath is synchronised for skeleton generation as well
      if (this.projectManagement && typeof this.projectManagement.updateActivePath === 'function') {
        try {
          await this.projectManagement.updateActivePath(pathName || 'general');
        } catch (syncErr) {
          this.logger.warn('Failed to sync activePath', { error: syncErr.message });
          // Don't fail the build, but log for debugging
        }
      }

      // Commit transaction
      await this.dataPersistence.commitTransaction(transaction);

      return {
        success: true,
        content: [{
          type: 'text',
          text: `**HTA Tree Created with ${skeletonTasks.length} Tasks!**\n\n**Your Goal**: ${config.goal}\n\n**Generated Structure**:\n- Tasks Created: ${skeletonTasks.length}\n- Complexity Score: ${complexityAnalysis.score}/10\n- Ready to Start Learning!\n\n**Available Tasks**:\n${skeletonTasks.slice(0, 3).map(task => `- ${task.title} (${task.difficulty}/5 difficulty)`).join('\n')}\n${skeletonTasks.length > 3 ? `- ... and ${skeletonTasks.length - 3} more tasks` : ''}\n\n**Next Steps**: Use \`get_next_task\` to start your learning journey!`
        }],
        generation_prompt: branchPrompt,
        complexity_analysis: complexityAnalysis,
        requires_branch_generation: false,
        tasks_generated: skeletonTasks.length
      };
    } catch (error) {
      // Rollback transaction on any error
      await this.dataPersistence.rollbackTransaction(transaction);
      
      return {
        success: false,
        content: [{
          type: 'text',
          text: `Error building HTA tree: ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Analyze goal complexity to determine appropriate tree depth
   */
  analyzeGoalComplexity(goal, context = '') {
    const goalLower = goal.toLowerCase();
    const combinedText = `${goal} ${context}`.toLowerCase();
    
    let complexityScore = 5; // Base complexity
    
    // Adjust based on goal indicators
    if (combinedText.includes('advanced') || combinedText.includes('expert')) complexityScore += 2;
    if (combinedText.includes('advanced') || combinedText.includes('expert')) complexityScore += 2;
    if (combinedText.includes('career') || combinedText.includes('business')) complexityScore += 1;
    if (combinedText.includes('from scratch') || combinedText.includes('beginner')) complexityScore += 1;
    if (combinedText.includes('credential') || combinedText.includes('certificate')) complexityScore += 2;
    if (combinedText.includes('simple') || combinedText.includes('basic')) complexityScore -= 2;
    if (combinedText.includes('hobby') || combinedText.includes('fun')) complexityScore -= 1;
    
    // Count distinct skill domains mentioned
    const skillDomains = ['technical', 'creative', 'business', 'social', 'physical', 'mental', 'financial'];
    const domainsPresent = skillDomains.filter(domain => combinedText.includes(domain)).length;
    complexityScore += Math.min(domainsPresent, 3);
    
    // Normalize score
    complexityScore = Math.max(1, Math.min(10, complexityScore));
    
    // Calculate tree structure based on complexity
    const treeStructure = this.calculateTreeStructure(complexityScore);
    
    return {
      score: complexityScore,
      level: complexityScore <= 3 ? 'simple' : complexityScore <= 6 ? 'moderate' : 'complex',
      ...treeStructure
    };
  }

  /**
   * Calculate tree structure parameters based on complexity
   */
  calculateTreeStructure(complexityScore) {
    // More complex goals get deeper trees with more tasks
    const depth = complexityScore <= 3 ? 2 : complexityScore <= 6 ? 3 : 4;
    const mainBranches = 3 + Math.floor(complexityScore / 2);
    const subBranchesPerMain = complexityScore <= 3 ? 2 : complexityScore <= 6 ? 3 : 4;
    const tasksPerLeaf = 5 + complexityScore;
    
    // Calculate totals
    const totalSubBranches = mainBranches * subBranchesPerMain;
    const totalLeaves = depth === 2 ? totalSubBranches : totalSubBranches * (depth === 3 ? 3 : 4);
    const estimatedTasks = totalLeaves * tasksPerLeaf;
    
    // Time estimate (rough)
    const hoursEstimate = estimatedTasks * 0.75; // 45 min average per task
    const timeEstimate = hoursEstimate < 100 ? `${Math.round(hoursEstimate)} hours` :
                        hoursEstimate < 500 ? `${Math.round(hoursEstimate/40)} weeks` :
                        `${Math.round(hoursEstimate/160)} months`;

    return {
      recommended_depth: depth,
      main_branches: mainBranches,
      sub_branches_per_main: subBranchesPerMain,
      tasks_per_leaf: tasksPerLeaf,
      estimated_tasks: estimatedTasks,
      time_estimate: timeEstimate
    };
  }

  /**
   * Generate prompt for deep hierarchical branch creation
   */
  generateDeepBranchPrompt(config, learningStyle, focusAreas, complexity) {
    // Build rich context once so downstream code can reuse it without duplication
    const contextData = FEATURE_FLAGS.ENABLE_RICH_CONTEXT_PROMPTS ? buildRichContext(config) : { travellerConstraints: [] };
    const travellerConstraintBlock = FEATURE_FLAGS.ENABLE_RICH_CONTEXT_PROMPTS
      ? `\n**TRAVELLER CONSTRAINTS**:\n${formatConstraintsForPrompt(contextData.travellerConstraints)}`
      : '';

    return `Create a ${complexity.recommended_depth}-level deep Hierarchical Task Analysis (HTA) for this goal:

**GOAL**: ${config.goal}
**CONTEXT**: ${config.context || 'Starting from scratch'}
**COMPLEXITY**: ${complexity.score}/10 (${complexity.level})
**EXPECTED STRUCTURE**:
- ${complexity.main_branches} main branches
- ${complexity.sub_branches_per_main} sub-branches per main branch
- ${complexity.tasks_per_leaf} tasks per terminal node
- Total depth: ${complexity.recommended_depth} levels
- Estimated total tasks: ${complexity.estimated_tasks}

**CONSTRAINTS**: 
- Focus duration: ${config.life_structure_preferences?.focus_duration || '25 minutes'}
- Learning style: ${learningStyle}
- Focus areas: ${focusAreas.length > 0 ? focusAreas.join(', ') : 'Comprehensive'}

Create a hierarchical structure following this format:

{
  "branch_name": "main_branch_identifier",
  "description": "What this major area covers",
  "sub_branches": [
    {
      "branch_name": "sub_branch_identifier",
      "description": "Specific aspect of the main branch",
      ${complexity.recommended_depth > 2 ? `"sub_branches": [
        {
          "branch_name": "sub_sub_branch",
          "description": "Even more specific aspect",
          "tasks": [
            {
              "title": "Specific actionable task",
              "description": "Clear instructions",
              "difficulty": 1-5,
              "duration": 15-45 (consider ${config.life_structure_preferences?.focus_duration || '25 minute'} blocks),
              "prerequisites": ["earlier_task_title"]
            }
          ]
        }
      ]` : `"tasks": [
        {
          "title": "Specific actionable task",
          "description": "Clear instructions",
          "difficulty": 1-5,
          "duration": 15-45,
          "prerequisites": []
        }
      ]`}
    }
  ]
}

For a ${complexity.level} goal like this, create:
1. **Breadth**: ${complexity.main_branches} distinct main branches covering all aspects
2. **Depth**: ${complexity.recommended_depth} levels of hierarchy 
3. **Granularity**: ~${complexity.tasks_per_leaf} specific tasks at each terminal node
4. **Progression**: Clear prerequisite chains from basics to mastery

Remember: This person wants to reach "${config.goal}". Create a comprehensive roadmap that breaks this down into ${complexity.estimated_tasks}+ manageable tasks across a deep hierarchy.

Make each branch and sub-branch meaningful and specific to this exact goal. No generic categories.

FORMAT INSTRUCTIONS:
Return ONLY valid JSON with **two top-level keys**:
1. "complexity_profile" – an object containing depth, domains, branching factors, and any other analysis you used.
2. "branch_tasks" – an array matching the schema shown above (branches with nested sub_branches/tasks).

Example skeleton of the expected JSON:
{
  "complexity_profile": {
    "recommended_depth": 3,
    "domains": ["fundamentals", "practice", "projects"],
    "estimated_tasks": 120,
    "complexity_score": 6
  },
  "branch_tasks": [ /* hierarchical structure here */ ]
}

${travellerConstraintBlock}`;
  }

  /**
   * Get or create HTA for a path
   */
  async loadPathHTA(projectId, pathName) {
    try {
      if (pathName === DEFAULT_PATHS.GENERAL) {
        // Try path-specific first, then project-level
        const pathHTA = await this.dataPersistence.loadPathData(projectId, pathName, FILE_NAMES.HTA);
        if (pathHTA) return pathHTA;
        
        const projectHTA = await this.dataPersistence.loadProjectData(projectId, FILE_NAMES.HTA);
        if (projectHTA) return projectHTA;
      } else {
        const hta = await this.dataPersistence.loadPathData(projectId, pathName, FILE_NAMES.HTA);
        if (hta) return hta;
      }
      
      // Return null if no HTA exists
      return null;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save HTA for a path
   */
  async savePathHTA(projectId, pathName, htaData) {
    if (pathName === DEFAULT_PATHS.GENERAL) {
      await this.dataPersistence.saveProjectData(projectId, FILE_NAMES.HTA, htaData);
    } else {
      await this.dataPersistence.savePathData(projectId, pathName, FILE_NAMES.HTA, htaData);
    }
  }

  /**
   * Parse Claude response to extract tasks
   */
  parseClaudeResponse(claudeResponse) {
    try {
      // Support multiple Claude response shapes (raw JSON, markdown fenced blocks, or content array).
      const tryParse = txt => {
        if (!txt || typeof txt !== 'string') return null;
        // Remove markdown triple-backtick fences if present
        const fencedMatch = txt.match(/```json\s*([\s\S]*?)```/i);
        const jsonText = fencedMatch ? fencedMatch[1] : txt;
        try {
          return JSON.parse(jsonText);
        } catch {
          return null;
        }
      };

      // 1. Direct .content string
      if (typeof claudeResponse === 'string') {
        const parsed = tryParse(claudeResponse);
        if (parsed) return parsed;
      }

      // 2. Check common fields
      const textCandidates = [claudeResponse.text, claudeResponse.content, claudeResponse.completion].filter(Boolean);
      for (const cand of textCandidates) {
        const parsed = tryParse(cand);
        if (parsed) return parsed;
      }

      // 3. If Claude returns content blocks array
      if (Array.isArray(claudeResponse.content)) {
        for (const block of claudeResponse.content) {
          if (block && block.type === 'text') {
            const parsed = tryParse(block.text);
            if (parsed) return parsed;
          }
        }
      }

      return [];
    } catch (error) {
      console.warn('Failed to parse Claude response:', error.message);
      return [];
    }
  }

  /**
   * Transform Claude-generated task objects to frontier_nodes format.
   * @param {any[]} tasks
   * @returns {any[]}
   */
  transformTasksToFrontierNodes(tasks) {
    if (!Array.isArray(tasks)) return [];

    const frontier = [];

    /**
     * Recursive helper to walk nested structures produced by Claude.
     * Handles arbitrary depth but caps at 5 to avoid runaway recursion.
     *
     * @param {any} nodeObj
     * @param {string|null} parentId
     * @param {number} level
     */
    const walk = (nodeObj, parentId = null, level = HTA_LEVELS.MAIN_BRANCH) => {
      if (!nodeObj) return;

      // ------------------------------------------------------------
      // BRANCH NODE HANDLING
      // ------------------------------------------------------------
      if (nodeObj.branch_name) {
        const branchId = `branch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        // Preserve the branch itself so downstream modules can traverse the
        // hierarchy and evaluate completion at the branch level.
        frontier.push({
          id: branchId,
          title: nodeObj.branch_name,
          description: nodeObj.description || nodeObj.branch_name,
          branch: nodeObj.branch_name,
          parent_id: parentId,
          level,
          is_branch: true,
          order: 0,
          completed: false,
          generated: true,
        });

        // Recurse into sub branches or tasks
        if (Array.isArray(nodeObj.sub_branches) && nodeObj.sub_branches.length > 0) {
          nodeObj.sub_branches.forEach((sb, idx) => walk(sb, branchId, level + 1));
        }
        if (Array.isArray(nodeObj.tasks) && nodeObj.tasks.length > 0) {
          nodeObj.tasks.forEach((t, idx) => {
            const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            frontier.push({
              id: taskId,
              title: t.title || `Task`,
              description: t.description || t.title || 'Learning task',
              difficulty: t.difficulty || 2,
              duration: t.duration || '30 minutes',
              branch: nodeObj.branch_name,
              parent_id: branchId,
              level: level + 1,
              order: idx,
              prerequisites: t.prerequisites || [],
              completed: false,
              generated: true,
            });
          });
        }
        return;
      }

      // Fallback: flat task object
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      frontier.push({
        id: taskId,
        title: nodeObj.title || 'Task',
        description: nodeObj.description || nodeObj.title || 'Learning task',
        difficulty: nodeObj.difficulty || 2,
        duration: nodeObj.duration || '30 minutes',
        branch: nodeObj.branch || 'general',
        parent_id: parentId,
        level,
        order: 0,
        prerequisites: nodeObj.prerequisites || [],
        completed: false,
        generated: true,
      });
    };

    tasks.forEach(t => walk(t, null, HTA_LEVELS.MAIN_BRANCH));

    return frontier;
  }

  /**
   * Generate skeleton tasks when Claude interface is not available
   * Creates a sprawling, complexity-appropriate task structure
   */
  generateSkeletonTasks(complexityAnalysis, config = {}, focusAreas = [], learningStyle = 'mixed') {
    const tasks = [];
    const goal = config.goal || 'Reach goal';
    const context = config.context || '';
    
    // Generate strategic branches based on goal analysis and complexity
    const strategicBranches = this.generateStrategicBranches(goal, complexityAnalysis, focusAreas);
    
    // Generate tasks for each strategic branch according to complexity analysis
    strategicBranches.forEach((branch, branchIndex) => {
      const branchTasks = this.generateBranchTasks(branch, complexityAnalysis, branchIndex, {
        goal,
        context,
        focusAreas,
        learningStyle
      });
      tasks.push(...branchTasks);
    });

    console.log(`[HTA] Generated ${tasks.length} skeleton tasks across ${strategicBranches.length} branches for complexity ${complexityAnalysis.score}`);
    return tasks;
  }

  /**
   * Generate strategic branches based on goal analysis
   */
  generateStrategicBranches(goal, complexityAnalysis, focusAreas = []) {
    const branches = [];

    // Always start with foundation
    branches.push({
      id: 'foundation',
      name: 'Foundation',
      description: 'Core knowledge and fundamental understanding',
      priority: 1
    });

    // If focus areas are provided, use them to create strategic branches
    if (focusAreas && focusAreas.length > 0) {
      focusAreas.forEach((area, index) => {
        const branchId = area.toLowerCase().replace(/[^a-z0-9]/g, '_');
        branches.push({
          id: branchId,
          name: area,
          description: `Strategic development in ${area}`,
          priority: index + 2
        });
      });
    } else {
      // Generate generic strategic branches that work for any domain
      const genericBranches = [
        { id: 'research_analysis', name: 'Research & Analysis', description: 'Information gathering and strategic planning', priority: 2 },
        { id: 'capability_building', name: 'Capability Building', description: 'Skills and resource development', priority: 3 },
        { id: 'planning_design', name: 'Planning & Design', description: 'Strategic planning and solution design', priority: 4 },
        { id: 'implementation', name: 'Implementation', description: 'Active execution and progress tracking', priority: 5 },
        { id: 'validation_optimization', name: 'Validation & Optimization', description: 'Testing, refinement, and performance improvement', priority: 6 }
      ];

      branches.push(...genericBranches);
    }

    // Limit branches to complexity-appropriate number
    const maxBranches = Math.min(complexityAnalysis.main_branches || 6, branches.length);
    return branches.slice(0, maxBranches);
  }

  /**
   * Generate tasks for a specific branch based on complexity
   */
  generateBranchTasks(branch, complexityAnalysis, branchIndex, context = {}) {
    const tasks = [];
    const tasksPerBranch = Math.floor((complexityAnalysis.estimated_tasks || 20) / (complexityAnalysis.main_branches || 4));
    const actualTaskCount = Math.max(3, Math.min(tasksPerBranch, 25)); // Between 3-25 tasks per branch

    const { goal = '', context: goalContext = '', focusAreas = [], learningStyle = 'mixed' } = context;

    // Generate contextually relevant tasks based on focus areas and goal
    for (let i = 0; i < actualTaskCount; i++) {
      const taskNumber = i + 1;
      const difficulty = Math.min(5, Math.max(1, Math.floor((i / actualTaskCount) * 5) + 1));
      const duration = difficulty <= 2 ? '30 minutes' : difficulty <= 3 ? '45 minutes' : difficulty <= 4 ? '60 minutes' : '90 minutes';

      // Create contextual task based on branch and focus areas
      const task = this.createContextualTask(branch, taskNumber, actualTaskCount, {
        goal,
        goalContext,
        focusAreas,
        learningStyle,
        difficulty,
        duration
      });

      tasks.push({
        id: `${branch.id}_task_${taskNumber}`,
        title: task.title,
        description: task.description,
        difficulty,
        duration,
        branch: branch.id,
        prerequisites: i > 0 ? [`${branch.id}_task_${taskNumber - 1}`] : [],
        completed: false,
        generated: true,
        phase: Math.ceil(taskNumber / Math.max(1, actualTaskCount / 3)),
        priority: (branchIndex * 100) + taskNumber,
        contextual: true
      });
    }

    return tasks;
  }

  /**
   * Create contextual task based on branch, goal, and focus areas (dynamic, not hardcoded)
   */
  createContextualTask(branch, taskNumber, totalTasks, context) {
    const { goal, goalContext, focusAreas, learningStyle, difficulty, duration } = context;
    
    // Extract key concepts from goal and focus areas
    const goalKeywords = this.extractKeywords(goal);
    const focusKeywords = focusAreas.flatMap(area => this.extractKeywords(area));
    const allKeywords = [...goalKeywords, ...focusKeywords];
    
    // Find relevant focus area for this branch
    const relevantFocusArea = focusAreas.find(area => 
      area.toLowerCase().includes(branch.id.replace('_', ' ')) ||
      area.toLowerCase().includes(branch.name.toLowerCase()) ||
      this.calculateRelevance(area, branch.description) > 0.3
    );
    
    // Generate task based on branch type and context
    let title, description;
    
    if (relevantFocusArea) {
      // Use specific focus area as basis for task
      title = this.generateFocusAreaTask(relevantFocusArea, taskNumber, totalTasks);
      description = `${relevantFocusArea} - Progressive implementation step ${taskNumber} of ${totalTasks}`;
    } else {
      // Generate task based on branch purpose and goal keywords
      title = this.generateBranchSpecificTask(branch, taskNumber, allKeywords, goal);
      description = `${branch.description} focused on: ${allKeywords.slice(0, 3).join(', ')} - Step ${taskNumber} of ${totalTasks}`;
    }
    
    return { title, description };
  }

  /**
   * Extract meaningful keywords from text
   */
  extractKeywords(text) {
    if (!text) return [];
    
    // Remove common words and extract meaningful terms
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));
    
    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Calculate relevance between focus area and branch description
   */
  calculateRelevance(focusArea, branchDescription) {
    const focusWords = this.extractKeywords(focusArea);
    const branchWords = this.extractKeywords(branchDescription);
    
    const commonWords = focusWords.filter(word => branchWords.includes(word));
    return commonWords.length / Math.max(focusWords.length, branchWords.length);
  }

  /**
   * Generate task title from focus area
   */
  generateFocusAreaTask(focusArea, taskNumber, totalTasks) {
    // Break down focus area into actionable task
    const phases = ['Plan', 'Research', 'Develop', 'Implement', 'Optimize', 'Validate'];
    const phaseIndex = Math.floor((taskNumber - 1) / Math.max(1, totalTasks / phases.length));
    const phase = phases[Math.min(phaseIndex, phases.length - 1)];
    
    return `${phase}: ${focusArea}`;
  }

  /**
   * Generate branch-specific task using goal keywords
   */
  generateBranchSpecificTask(branch, taskNumber, keywords, goal) {
    // Generic action progression that works for any domain
    const genericActions = ['Research', 'Plan', 'Develop', 'Implement', 'Validate', 'Optimize'];
    const action = genericActions[Math.min(taskNumber - 1, genericActions.length - 1)];
    
    const relevantKeywords = keywords.slice(0, 2).join(' and ') || branch.name.toLowerCase();
    
    return `${action} ${relevantKeywords} for ${branch.name.toLowerCase()}`;
  }

  /**
   * Generate contextually relevant tasks based on branch type and goal
   */
  generateContextualTasks(branch, maxTasks) {
    const branchId = branch.id;
    const tasks = [];

    // Generate domain-agnostic tasks based on branch context
    // This section intentionally left generic to avoid domain contamination
    // Tasks should be generated dynamically based on user's specific goal and context

    // Return up to maxTasks, prioritizing most relevant
    return tasks.slice(0, maxTasks);
  }

  /**
   * Create strategicBranches array based on unique branch field of tasks.
   * @param {any[]} tasks
   * @returns {any[]}
   */
  deriveStrategicBranches(tasks = []) {
    const unique = [...new Set(tasks.map(t => t.branch))];
    return unique.map((b, idx) => ({ id: b, title: b.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), order: idx }));
  }

  /**
   * Get next task from existing HTA tree without regenerating
   */
  async getNextTaskFromExistingTree(htaData) {
    try {
      // Find the first incomplete task
      const incompleteTasks = htaData.frontierNodes?.filter(task => !task.completed) || [];

      if (incompleteTasks.length === 0) {
        return {
          content: [{
            type: 'text',
            text: '**All tasks completed!** Consider using branch evolution to expand into new areas.'
          }]
        };
      }

      // Return the first available task
      const nextTask = incompleteTasks[0];
      return {
        content: [{
          type: 'text',
          text: `**Next Recommended Task**\n\n**${nextTask.title}**\n${nextTask.description}\n\n**Duration**: ${nextTask.duration}\n**Difficulty**: ${nextTask.difficulty}/5\n**Branch**: ${nextTask.branch}\n\nUse \`complete_block\` with block_id: "${nextTask.id}" when finished`
        }],
        selected_task: nextTask
      };
    } catch (error) {
      console.error('[HTA] Error getting next task from existing tree:', error.message);
      return {
        content: [{
          type: 'text',
          text: 'Error retrieving next task. Use `get_next_task` tool instead.'
        }]
      };
    }
  }
}
