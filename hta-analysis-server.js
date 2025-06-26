#!/usr/bin/env node

/**
 * HTA Analysis Server
 * A focused MCP server that ONLY handles Hierarchical Task Analysis
 * 
 * Responsibilities:
 * - Strategic goal breakdown into hierarchical structure
 * - Complexity analysis and depth calculation
 * - Dependency mapping between components
 * - Question-tree skeleton generation
 * 
 * Does NOT handle:
 * - Task generation (that's for Task Generation Server)
 * - Task completion (that's for Progress Tracking Server)
 * - Scheduling (that's for other servers)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Core HTA Analysis Engine
 * Pure logic for hierarchical task analysis
 */
class HTAAnalysisEngine {
  constructor() {
    this.name = 'HTA Analysis Engine';
    this.version = '1.0.0';
  }

  /**
   * Analyze goal complexity using multi-dimensional approach
   * @param {string} goal - The goal to analyze
   * @returns {Object} Comprehensive complexity analysis
   */
  async assessGoalComplexity(goal) {
    if (!goal || typeof goal !== 'string') {
      throw new Error('Goal must be a non-empty string');
    }

    const analysis = {
      domain_complexity: this._analyzeDomainComplexity(goal),
      skill_complexity: this._analyzeSkillComplexity(goal),
      scope_complexity: this._analyzeScopeComplexity(goal),
      time_complexity: this._analyzeTimeComplexity(goal),
      dependency_complexity: this._analyzeDependencyComplexity(goal),
      knowledge_complexity: this._analyzeKnowledgeComplexity(goal)
    };



    // Calculate weighted complexity score
    const weights = {
      domain_complexity: 0.25,
      skill_complexity: 0.20,
      scope_complexity: 0.20,
      time_complexity: 0.15,
      dependency_complexity: 0.10,
      knowledge_complexity: 0.10
    };

    let complexityScore = 0;
    for (const [dimension, score] of Object.entries(analysis)) {
      complexityScore += score * weights[dimension];
    }

    // Round and cap between 1-10
    complexityScore = Math.min(10, Math.max(1, Math.round(complexityScore)));

    // Determine estimated timeframe and depth requirements
    const timeframe = this._estimateTimeframe(complexityScore, analysis);
    const domainCount = this._estimateRequiredDomains(complexityScore, analysis);
    const subdomainCount = this._estimateRequiredSubdomains(complexityScore, analysis);

    return {
      complexity_score: complexityScore,
      estimated_timeframe: timeframe,
      required_domains: domainCount,
      required_subdomains: subdomainCount,
      dimensional_analysis: analysis,
      complexity_factors: this._identifyComplexityFactors(goal, analysis),
      analysis_method: 'multi-dimensional'
    };
  }

  /**
   * Analyze domain complexity (technical, creative, business, etc.)
   * @private
   */
  _analyzeDomainComplexity(goal) {
    const domains = {
      technical: /programming|software|system|code|development|engineering|technical|algorithm|database|network|security/i,
      creative: /design|art|creative|music|writing|content|visual|aesthetic|brand|marketing/i,
      business: /business|strategy|management|leadership|sales|finance|operations|entrepreneurship/i,
      academic: /research|study|learn|education|academic|science|theory|analysis|methodology/i,
      physical: /fitness|health|sports|exercise|physical|training|athletic|wellness/i,
      social: /communication|relationship|networking|team|collaboration|social|community/i
    };

    let score = 3; // Base score
    let domainCount = 0;

    for (const [domain, pattern] of Object.entries(domains)) {
      if (pattern.test(goal)) {
        domainCount++;
        if (domain === 'technical') score += 2;
        else if (domain === 'business') score += 1.5;
        else score += 1;
      }
    }

    // Multi-domain goals are more complex
    if (domainCount > 1) score += domainCount * 0.5;

    return Math.min(10, score);
  }

  /**
   * Analyze skill complexity (beginner, intermediate, advanced, expert)
   * @private
   */
  _analyzeSkillComplexity(goal) {
    const skillLevels = {
      beginner: /learn|start|begin|basic|introduction|fundamentals|getting started/i,
      intermediate: /improve|develop|build|create|implement|apply|practice/i,
      advanced: /master|expert|advanced|optimize|architect|design|lead/i,
      expert: /innovate|research|pioneer|breakthrough|cutting-edge|state-of-the-art/i
    };

    let score = 5; // Default intermediate

    if (skillLevels.expert.test(goal)) score = 9;
    else if (skillLevels.advanced.test(goal)) score = 7;
    else if (skillLevels.intermediate.test(goal)) score = 5;
    else if (skillLevels.beginner.test(goal)) score = 3;

    return score;
  }

  /**
   * Analyze scope complexity (personal, team, organization, industry)
   * @private
   */
  _analyzeScopeComplexity(goal) {
    const scopeIndicators = {
      personal: /my|personal|individual|self|own/i,
      team: /team|group|collaborate|together|with others/i,
      organizational: /company|organization|department|enterprise|business/i,
      industry: /industry|market|sector|global|worldwide|universal/i
    };

    let score = 3; // Default personal scope

    if (scopeIndicators.industry.test(goal)) score = 9;
    else if (scopeIndicators.organizational.test(goal)) score = 7;
    else if (scopeIndicators.team.test(goal)) score = 5;
    else if (scopeIndicators.personal.test(goal)) score = 3;

    // Check for scale indicators
    const scaleWords = goal.match(/\d+/g);
    if (scaleWords) {
      const maxNumber = Math.max(...scaleWords.map(Number));
      if (maxNumber > 1000) score += 2;
      else if (maxNumber > 100) score += 1;
    }

    return Math.min(10, score);
  }

  /**
   * Calculate optimal depth for HTA structure
   * @param {number} complexityScore - Complexity score (1-10)
   * @param {number} userLevel - User knowledge level (1-10)
   * @param {string} timeFrame - Target timeframe
   * @returns {Object} Depth configuration
   */
  /**
   * Analyze time complexity
   * @private
   */
  _analyzeTimeComplexity(goal) {
    const timeIndicators = {
      immediate: /now|today|immediately|urgent|asap/i,
      short: /week|weeks|quick|fast|rapid/i,
      medium: /month|months|quarter|semester/i,
      long: /year|years|long-term|lifetime|career/i
    };

    let score = 5; // Default medium-term

    if (timeIndicators.long.test(goal)) score = 8;
    else if (timeIndicators.medium.test(goal)) score = 5;
    else if (timeIndicators.short.test(goal)) score = 3;
    else if (timeIndicators.immediate.test(goal)) score = 2;

    return score;
  }

  /**
   * Analyze dependency complexity
   * @private
   */
  _analyzeDependencyComplexity(goal) {
    const dependencyWords = /require|need|depend|prerequisite|foundation|based on|after|before/i;
    const multiStepWords = /step|phase|stage|process|sequence|order|then|next|finally/i;
    const coordinationWords = /coordinate|synchronize|align|integrate|combine|merge/i;

    let score = 3; // Base score

    if (dependencyWords.test(goal)) score += 2;
    if (multiStepWords.test(goal)) score += 1.5;
    if (coordinationWords.test(goal)) score += 1;

    return Math.min(10, score);
  }

  /**
   * Analyze knowledge complexity
   * @private
   */
  _analyzeKnowledgeComplexity(goal) {
    const knowledgeDepth = {
      surface: /overview|introduction|basics|fundamentals|getting started/i,
      working: /understand|apply|use|implement|practice/i,
      deep: /master|expert|analyze|design|architect/i,
      research: /research|innovate|discover|pioneer|breakthrough/i
    };

    let score = 5; // Default working knowledge

    if (knowledgeDepth.research.test(goal)) score = 9;
    else if (knowledgeDepth.deep.test(goal)) score = 7;
    else if (knowledgeDepth.working.test(goal)) score = 5;
    else if (knowledgeDepth.surface.test(goal)) score = 3;

    return score;
  }

  calculateOptimalDepth(complexityScore, userLevel = 5, timeFrame = '') {
    // More sophisticated depth calculation based on complexity dimensions
    const baseDepth = Math.ceil(complexityScore * 0.8); // Increased multiplier for more depth

    // User level adjustments
    const levelAdjustment = userLevel < 3 ? -1 : userLevel > 7 ? 1 : 0;

    // Time adjustments
    let timeAdjustment = 0;
    if (/year|long-term|career/i.test(timeFrame)) timeAdjustment = 2;
    else if (/month|quarter/i.test(timeFrame)) timeAdjustment = 0;
    else if (/week|short/i.test(timeFrame)) timeAdjustment = -1;

    // Complexity-based adjustments
    const complexityAdjustment = complexityScore >= 8 ? 1 : complexityScore <= 3 ? -1 : 0;

    const targetDepth = Math.max(3, Math.min(10, baseDepth + levelAdjustment + timeAdjustment + complexityAdjustment));

    return {
      target_depth: targetDepth,
      max_branches_per_level: Math.max(3, Math.min(8, Math.ceil(complexityScore / 1.5))),
      recommended_focus_areas: Math.max(2, Math.min(6, Math.ceil(complexityScore / 2.5))),
      complexity_score: complexityScore,
      user_level: userLevel,
      adjustments: {
        level_adjustment: levelAdjustment,
        time_adjustment: timeAdjustment,
        complexity_adjustment: complexityAdjustment
      },
      reasoning: `Depth ${targetDepth} calculated from complexity ${complexityScore}, user level ${userLevel}, timeframe "${timeFrame}"`
    };
  }

  /**
   * Estimate required domains based on complexity
   * @private
   */
  _estimateRequiredDomains(complexityScore, analysis) {
    let domains = Math.ceil(complexityScore / 3); // Base: 1-3 domains

    // Adjust based on scope
    if (analysis.scope_complexity >= 7) domains += 1;
    if (analysis.domain_complexity >= 8) domains += 1;

    return Math.max(1, Math.min(5, domains));
  }

  /**
   * Estimate required subdomains based on complexity
   * @private
   */
  _estimateRequiredSubdomains(complexityScore, analysis) {
    let subdomains = Math.ceil(complexityScore / 2); // Base: 1-5 subdomains per domain

    // Adjust based on skill and knowledge complexity
    if (analysis.skill_complexity >= 7) subdomains += 1;
    if (analysis.knowledge_complexity >= 7) subdomains += 1;

    return Math.max(2, Math.min(8, subdomains));
  }

  /**
   * Estimate timeframe based on complexity
   * @private
   */
  _estimateTimeframe(complexityScore, analysis) {
    if (complexityScore >= 9) return 'years (2-5)';
    if (complexityScore >= 7) return 'months (6-18)';
    if (complexityScore >= 5) return 'months (3-6)';
    if (complexityScore >= 3) return 'weeks (4-12)';
    return 'weeks (1-4)';
  }

  /**
   * Identify key complexity factors
   * @private
   */
  _identifyComplexityFactors(goal, analysis) {
    const factors = [];

    if (analysis.domain_complexity >= 7) factors.push('High domain complexity');
    if (analysis.skill_complexity >= 7) factors.push('Advanced skill requirements');
    if (analysis.scope_complexity >= 7) factors.push('Large scope/scale');
    if (analysis.dependency_complexity >= 6) factors.push('Complex dependencies');
    if (analysis.knowledge_complexity >= 7) factors.push('Deep knowledge required');
    if (analysis.time_complexity >= 7) factors.push('Long-term commitment');

    return factors.length > 0 ? factors : ['Moderate complexity goal'];
  }

  /**
   * Generate strategic branches for the goal
   * @param {string} goal - The main goal
   * @param {Array} focusAreas - User-specified focus areas
   * @param {number} knowledgeLevel - User knowledge level
   * @returns {Array} Strategic branches
   */
  async generateStrategicBranches(goal, focusAreas = [], knowledgeLevel = 5) {
    // If user provided focus areas, use them directly
    if (Array.isArray(focusAreas) && focusAreas.length > 0) {
      return focusAreas.map((area, index) => ({
        id: `branch_${index + 1}`,
        title: area.trim(),
        description: `Strategic focus on ${area.trim()}`,
        order: index + 1,
        source: 'user_defined'
      }));
    }

    // Generate branches based on goal analysis
    const complexity = await this.assessGoalComplexity(goal);
    const branches = [];
    
    // Determine branch count based on complexity
    const branchCount = Math.max(3, Math.min(6, complexity.complexity_score));
    
    // Generate heuristic branches based on goal type
    if (/learn|study|master|understand/i.test(goal)) {
      branches.push(
        { id: 'branch_1', title: 'Foundation Building', description: 'Establish core knowledge and fundamentals', order: 1 },
        { id: 'branch_2', title: 'Practical Application', description: 'Apply knowledge through hands-on practice', order: 2 },
        { id: 'branch_3', title: 'Advanced Concepts', description: 'Explore deeper and more complex topics', order: 3 }
      );
    } else if (/build|create|develop|make/i.test(goal)) {
      branches.push(
        { id: 'branch_1', title: 'Planning & Design', description: 'Plan and design the solution', order: 1 },
        { id: 'branch_2', title: 'Implementation', description: 'Build and develop the solution', order: 2 },
        { id: 'branch_3', title: 'Testing & Refinement', description: 'Test, debug, and improve the solution', order: 3 }
      );
    } else if (/improve|optimize|enhance/i.test(goal)) {
      branches.push(
        { id: 'branch_1', title: 'Current State Analysis', description: 'Analyze and understand current situation', order: 1 },
        { id: 'branch_2', title: 'Improvement Strategy', description: 'Develop strategy for improvements', order: 2 },
        { id: 'branch_3', title: 'Implementation & Monitoring', description: 'Execute improvements and track progress', order: 3 }
      );
    } else {
      // Generic branches for any goal
      branches.push(
        { id: 'branch_1', title: 'Preparation', description: 'Prepare and gather necessary resources', order: 1 },
        { id: 'branch_2', title: 'Execution', description: 'Execute the main activities', order: 2 },
        { id: 'branch_3', title: 'Completion', description: 'Finalize and validate results', order: 3 }
      );
    }

    // Add additional branches for complex goals
    if (branchCount > 3) {
      branches.push(
        { id: 'branch_4', title: 'Quality Assurance', description: 'Ensure quality and standards', order: 4 }
      );
    }
    if (branchCount > 4) {
      branches.push(
        { id: 'branch_5', title: 'Documentation', description: 'Document process and outcomes', order: 5 }
      );
    }
    if (branchCount > 5) {
      branches.push(
        { id: 'branch_6', title: 'Knowledge Transfer', description: 'Share and transfer knowledge', order: 6 }
      );
    }

    return branches.slice(0, branchCount).map(branch => ({
      ...branch,
      source: 'generated'
    }));
  }

  /**
   * Generate question-tree skeleton for deeper analysis
   * @param {string} goal - The main goal
   * @param {Object} depthConfig - Depth configuration
   * @returns {Object} Question tree structure
   */
  async generateQuestionSkeleton(goal, depthConfig) {
    const rootQuestion = `What must be true for "${goal}" to become reality?`;
    
    return {
      root_question: rootQuestion,
      depth_config: depthConfig,
      sub_questions: await this._generateSubQuestions(rootQuestion, depthConfig.target_depth - 1),
      created: new Date().toISOString()
    };
  }

  /**
   * Generate sub-questions for question tree
   * @private
   */
  async _generateSubQuestions(parentQuestion, remainingDepth) {
    if (remainingDepth <= 0) return [];
    
    // Generate 3-5 sub-questions based on the parent question
    const subQuestions = [
      `What knowledge is required?`,
      `What resources are needed?`,
      `What are the key milestones?`,
      `What obstacles might arise?`,
      `How will success be measured?`
    ];
    
    return subQuestions.slice(0, Math.min(5, remainingDepth + 2)).map((question, index) => ({
      id: `q_${Date.now()}_${index}`,
      question,
      level: remainingDepth,
      sub_questions: []
    }));
  }

  /**
   * Create complete HTA structure
   * @param {Object} params - Parameters for HTA creation
   * @returns {Object} Complete HTA structure
   */
  async createHTAStructure(params) {
    const {
      goal,
      focus_areas = [],
      knowledge_level = 5,
      target_timeframe = '',
      learning_style = 'mixed'
    } = params;

    if (!goal) {
      throw new Error('Goal is required for HTA structure creation');
    }

    // Step 1: Analyze goal complexity
    const complexityProfile = await this.assessGoalComplexity(goal);
    
    // Step 2: Calculate optimal depth
    const depthConfig = this.calculateOptimalDepth(
      complexityProfile.complexity_score,
      knowledge_level,
      target_timeframe
    );
    
    // Step 3: Generate strategic branches
    const strategicBranches = await this.generateStrategicBranches(
      goal,
      focus_areas,
      knowledge_level
    );
    
    // Step 4: Generate question skeleton
    const questionTree = await this.generateQuestionSkeleton(goal, depthConfig);
    
    // Step 5: Create dependencies map
    const dependencies = this._createDependencyMap(strategicBranches);
    
    return {
      goal,
      complexity_profile: complexityProfile,
      depth_config: depthConfig,
      strategic_branches: strategicBranches,
      question_tree: questionTree,
      dependencies,
      metadata: {
        focus_areas,
        knowledge_level,
        target_timeframe,
        learning_style,
        created: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Create dependency map between branches
   * @private
   */
  _createDependencyMap(branches) {
    const dependencies = {};
    
    branches.forEach((branch, index) => {
      dependencies[branch.id] = {
        prerequisites: index > 0 ? [branches[index - 1].id] : [],
        dependents: index < branches.length - 1 ? [branches[index + 1].id] : [],
        parallel_branches: [],
        critical_path: index === 0 || index === branches.length - 1
      };
    });
    
    return dependencies;
  }
}

// Create the MCP server
const server = new Server(
  {
    name: 'hta-analysis-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Create the HTA engine
const htaEngine = new HTAAnalysisEngine();

// Tool: Analyze Goal Complexity
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_goal_complexity',
        description: 'Analyze the complexity of a goal and provide complexity metrics',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'The goal to analyze for complexity'
            }
          },
          required: ['goal']
        }
      },
      {
        name: 'create_hta_structure',
        description: 'Create a complete Hierarchical Task Analysis structure for a goal',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'The main goal to create HTA structure for'
            },
            focus_areas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional focus areas to emphasize'
            },
            knowledge_level: {
              type: 'number',
              minimum: 1,
              maximum: 10,
              description: 'User knowledge level (1-10)'
            },
            target_timeframe: {
              type: 'string',
              description: 'Target timeframe (e.g., "3 months", "1 year")'
            },
            learning_style: {
              type: 'string',
              enum: ['visual', 'auditory', 'kinesthetic', 'mixed'],
              description: 'Preferred learning style'
            }
          },
          required: ['goal']
        }
      },
      {
        name: 'generate_strategic_branches',
        description: 'Generate strategic branches for goal decomposition',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'The goal to generate branches for'
            },
            focus_areas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional focus areas'
            },
            knowledge_level: {
              type: 'number',
              minimum: 1,
              maximum: 10,
              description: 'User knowledge level'
            }
          },
          required: ['goal']
        }
      },
      {
        name: 'calculate_optimal_depth',
        description: 'Calculate optimal depth configuration for HTA structure',
        inputSchema: {
          type: 'object',
          properties: {
            complexity_score: {
              type: 'number',
              minimum: 1,
              maximum: 10,
              description: 'Goal complexity score'
            },
            user_level: {
              type: 'number',
              minimum: 1,
              maximum: 10,
              description: 'User knowledge level'
            },
            timeframe: {
              type: 'string',
              description: 'Target timeframe'
            }
          },
          required: ['complexity_score']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_goal_complexity': {
        const result = await htaEngine.assessGoalComplexity(args.goal);
        return {
          content: [
            {
              type: 'text',
              text: `# Goal Complexity Analysis\n\n**Goal:** ${args.goal}\n\n**Complexity Score:** ${result.complexity_score}/10\n**Estimated Timeframe:** ${result.estimated_timeframe}\n**Required Domains:** ${result.required_domains}\n**Required Subdomains:** ${result.required_subdomains}\n**Analysis Method:** ${result.analysis_method}\n\n## Dimensional Analysis:\n${Object.entries(result.dimensional_analysis).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`).join('\n')}\n\n## Complexity Factors:\n${result.complexity_factors.map(factor => `- ${factor}`).join('\n')}`
            }
          ],
          analysis: result
        };
      }

      case 'create_hta_structure': {
        const result = await htaEngine.createHTAStructure(args);
        return {
          content: [
            {
              type: 'text',
              text: `# HTA Structure Created\n\n**Goal:** ${result.goal}\n\n**Complexity:** ${result.complexity_profile.complexity_score}/10\n**Target Depth:** ${result.depth_config.target_depth}\n**Strategic Branches:** ${result.strategic_branches.length}\n\n## Strategic Branches:\n${result.strategic_branches.map(b => `${b.order}. **${b.title}** - ${b.description}`).join('\n')}\n\n✅ HTA structure ready for task generation`
            }
          ],
          hta_structure: result
        };
      }

      case 'generate_strategic_branches': {
        const result = await htaEngine.generateStrategicBranches(
          args.goal,
          args.focus_areas || [],
          args.knowledge_level || 5
        );
        return {
          content: [
            {
              type: 'text',
              text: `# Strategic Branches Generated\n\n${result.map(b => `**${b.title}**\n${b.description}\n`).join('\n')}`
            }
          ],
          strategic_branches: result
        };
      }

      case 'calculate_optimal_depth': {
        const result = htaEngine.calculateOptimalDepth(
          args.complexity_score,
          args.user_level || 5,
          args.timeframe || ''
        );
        return {
          content: [
            {
              type: 'text',
              text: `# Optimal Depth Configuration\n\n**Target Depth:** ${result.target_depth}\n**Max Branches per Level:** ${result.max_branches_per_level}\n**Recommended Focus Areas:** ${result.recommended_focus_areas}`
            }
          ],
          depth_config: result
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HTA Analysis Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
