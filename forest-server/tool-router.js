/**
 * Tool Router Module
 * Handles MCP tool request routing and execution
 */

import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getDatedLogPath, writeJsonLine } from './logger-utils.js';
import { ToolRegistry } from './utils/tool-registry.js';
import { getForestLogger } from './winston-logger.js';

const logger = getForestLogger({ module: 'ToolRouter' });

export class ToolRouter {
  constructor(server, forestServer) {
    this.server = server;
    this.forestServer = forestServer;
    // Path for persistent stack-trace log
    this.stackTraceLogPath = getDatedLogPath('stack');
    // Initialize tool registry
    this.toolRegistry = new ToolRegistry();
    
    // PHASE 1: PERIODIC HEALTH CHECKS - Set up runtime monitoring
    if (forestServer?.performanceMonitor) {
      setInterval(() => {
        try {
          // Basic health check - ensure critical dependencies are available
          if (!this.toolRegistry) {
            logger.error('CRITICAL: Tool registry has become unavailable');
          }
        } catch (healthError) {
          logger.error('Health check failed', { error: healthError.message });
        }
      }, 60000); // Check every minute
    }
    
    // PHASE 2: PERFORMANCE OPTIMIZATION - Add performance monitoring
    this.performanceMonitor = forestServer?.performanceMonitor || null;
    
    this.componentMap = {
      build_hta_tree: 'hta-tree-builder',
      validate_hta_pipeline: 'hta-tree-builder',
      debug_task_sequence: 'task-selector',
      get_next_task: 'task-selector',
    };

    this.registerAllTools();

    // ------------------------------------------------------------------
    // BACKWARD-COMPATIBILITY / ADVERTISEMENT SYNC
    // ------------------------------------------------------------------
    // Many tools are registered directly in the ToolRegistry without a matching
    // entry in `forestServer.tools`.  The MCP advertisement layer (handled by
    // McpHandlers) traditionally uses `forestServer.tools` as its source of
    // truth, which leads to "registered but not advertised" validation
    // warnings.  The helper below clones **any** registered tool that is
    // missing from the advertisement map so that the public capability list
    // remains consistent.
    this._syncForestToolAdvertisements();
  }

  // Lightweight stack-trace logger – called on every tool invocation
  async logStack(toolName, args) {
    // PHASE 2: LOG LEVEL CHECK - Avoid expensive operations if logging disabled
    if (!logger.isLevelEnabled || !logger.isLevelEnabled('debug')) {
      return; // Skip expensive stack trace logging if debug level disabled
    }
    
    const startTime = Date.now();
    console.error(`[STACK-TRACE] Logging tool: ${toolName}`);

    try {
      const entry = {
        timestamp: new Date().toISOString(),
        tool: toolName,
        argKeys: Object.keys(args || {}),
        argCount: Object.keys(args || {}).length,
        stack: (new Error().stack?.split('\n').slice(3, 15) || []).map(s => s.trim()),
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          DEBUG: process.env.DEBUG,
        },
        // Capture detailed argument info (truncated for safety)
        argsPreview: this.truncateArgsForLogging(args),
        logTime: startTime,
      };

      writeJsonLine(this.stackTraceLogPath, entry);
      console.error(
        `[STACK-TRACE] Written to ${this.stackTraceLogPath} (${Date.now() - startTime}ms)`
      );
    } catch (err) {
      console.error(`[STACK-TRACE] Error writing log: ${err.message}`);
      console.error('[STACK-TRACE] Stack trace of logging error:', err.stack);
      // Try to write a minimal error entry
      try {
        const errorEntry = {
          timestamp: new Date().toISOString(),
          type: 'stack-trace-error',
          tool: toolName,
          error: err.message,
          errorStack: err.stack?.split('\n')?.slice(0, 5),
        };
        writeJsonLine(this.stackTraceLogPath, errorEntry);
      } catch (secondErr) {
        console.error('[STACK-TRACE] Failed to write error entry:', secondErr.message);
      }
    }
  }

  // Helper to safely truncate arguments for logging
  truncateArgsForLogging(args) {
    // PHASE 2: OPTIMIZATION - Quick return for null/undefined
    if (!args || typeof args !== 'object') {
      return args;
    }

    // PHASE 2: LOG LEVEL CHECK - Avoid expensive processing if not needed
    if (!logger.isLevelEnabled || !logger.isLevelEnabled('debug')) {
      return '[args truncated - debug logging disabled]';
    }

    const preview = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        preview[key] = value.length > 200 ? `${value.slice(0, 200)}...` : value;
      } else if (typeof value === 'object' && value !== null) {
        try {
          const json = JSON.stringify(value);
          preview[key] = json.length > 200 ? `[Object: ${value.constructor?.name}]` : value;
        } catch (/** @type {unknown} */ e) {
          const _error = e instanceof Error ? e : new Error(String(e));
          preview[key] = `[Object: ${value.constructor?.name || 'Unknown'}]`;
        }
      } else {
        preview[key] = value;
      }
    }
    return preview;
  }

  // NEW: Validate tool registration completeness for MCP handlers
  validateToolRegistration() {
    logger.event('TOOL_REGISTRATION_VALIDATION_START');
    
    const registeredTools = this.toolRegistry.getToolNames();
    const registrationReport = {
      totalRegistered: registeredTools.length,
      registeredTools: registeredTools,
      categories: this.toolRegistry.getStats()?.categories || {},
      missingHandlers: [],
      validationStatus: 'success',
      timestamp: new Date().toISOString()
    };
    
    // Check for tools that might be advertised but missing handlers
    const expectedTools = [
      'create_project', 'switch_project', 'list_projects', 'get_active_project',
      'build_hta_tree', 'get_hta_status', 
      'generate_daily_schedule', 'generate_integrated_schedule',
      'get_next_task', 'complete_block', 'current_status',
      'get_performance_metrics', 'get_metrics_dashboard', 'optimize_resources',
      'start_proactive_reasoning', 'stop_proactive_reasoning', 'get_proactive_status'
    ];
    
    const missingHandlers = expectedTools.filter(tool => !registeredTools.includes(tool));
    
    if (missingHandlers.length > 0) {
      registrationReport.missingHandlers = missingHandlers;
      registrationReport.validationStatus = 'incomplete';
      
      logger.warn('TOOL_REGISTRATION_INCOMPLETE', {
        missingTools: missingHandlers,
        missingCount: missingHandlers.length
      });
    } else {
      logger.event('TOOL_REGISTRATION_VALIDATION_SUCCESS', {
        totalTools: registeredTools.length
      });
    }
    
    return registrationReport;
  }

  /**
   * NEW: Normalize tool payload to handle parameter variations and ensure consistent argument processing
   * This addresses the contract violations between different modules expecting different parameter formats
   */
  normalizeToolPayload(toolName, args) {
    if (!args || typeof args !== 'object') {
      return {};
    }

    // FIX: Handle build_hta_tree parameter normalization
    if (toolName === 'build_hta_tree') {
      const normalized = {
        path_name: args.path_name || args.pathName || 'general',
        learning_style: args.learning_style || args.learningStyle || 'mixed',
        focus_areas: args.focus_areas || args.focusAreas || [],
        goal_override: args.goal_override || args.goalOverride || null,
        context_override: args.context_override || args.contextOverride || ''
      };
      
      // Ensure focus_areas is always an array
      if (typeof normalized.focus_areas === 'string') {
        normalized.focus_areas = normalized.focus_areas.split(',').map(s => s.trim()).filter(s => s);
      }
      
      return normalized;
    }

    // FIX: Handle get_next_task parameter normalization
    if (toolName === 'get_next_task') {
      return {
        context_from_memory: args.context_from_memory || args.contextFromMemory || '',
        energy_level: args.energy_level || args.energyLevel || 3,
        time_available: args.time_available || args.timeAvailable || '30 minutes'
      };
    }

    // FIX: Handle complete_block parameter normalization
    if (toolName === 'complete_block') {
      return {
        block_id: args.block_id || args.blockId || '',
        outcome: args.outcome || '',
        energy_level: args.energy_level || args.energyLevel || 3,
        difficulty_rating: args.difficulty_rating || args.difficultyRating || 3,
        learned: args.learned || ''
      };
    }

    // FIX: Handle create_project parameter normalization
    if (toolName === 'create_project') {
      return {
        project_id: args.project_id || args.projectId || '',
        goal: args.goal || '',
        context: args.context || ''
      };
    }

    // FIX: Handle switch_project parameter normalization
    if (toolName === 'switch_project') {
      return {
        project_id: args.project_id || args.projectId || ''
      };
    }

    // For all other tools, pass through arguments as-is but ensure consistent structure
    return { ...args };
  }

  // Main tool call dispatcher with truthful filtering built-in
  async dispatchTool(toolName, args) {
    const executionId = Math.random().toString(36).substr(2, 9);
    const executionStart = Date.now();
    const isTerminal = process.stdin.isTTY;

    // PHASE 2: MEMORY MONITORING - Track memory usage during tool execution
    const memoryBefore = process.memoryUsage();
    let perfTimer = null;
    
    if (this.performanceMonitor && typeof this.performanceMonitor.startTimer === 'function') {
      try {
        perfTimer = this.performanceMonitor.startTimer(`TOOL_EXECUTION_${toolName}`);
      } catch (perfError) {
        console.error('[PERF-ERROR] Failed to start performance timer:', perfError.message);
      }
    }

    // ENHANCED MCP TOOL LOGGING - only in terminal mode and if debug enabled
    if (isTerminal && logger.isLevelEnabled && logger.isLevelEnabled('debug')) {
      console.error(
        `🚀 [MCP-CALL] Tool: ${toolName} | ID: ${executionId} | Args: ${JSON.stringify(Object.keys(args || {}))}`
      );
      logger.debug(
        `🚀 [MCP-CALL] Tool: ${toolName} | ID: ${executionId} | Args: ${JSON.stringify(Object.keys(args || {}))}`
      );
      console.info(
        `🚀 [MCP-CALL] Tool: ${toolName} | ID: ${executionId} | Args: ${JSON.stringify(Object.keys(args || {}))}`
      );
    }

    // Trigger stack-trace logging for every call (with level check inside)
    await this.logStack(toolName, args);

    if (isTerminal) {
      console.error(`[DISPATCH-${executionId}] Starting tool: ${toolName}`);
    }

    try {
      // PHASE 1: INPUT VALIDATION PIPELINE - Validate arguments before execution
      const validationStart = Date.now();
      
      // FIX: Normalize tool payload before validation and execution
      const normalizedArgs = this.normalizeToolPayload(toolName, args);
      
      // Guard: component health check
      const comp = this.componentMap[toolName] || toolName;
      if (!this.forestServer.core.contextGuard.validateComponentHealth(comp, 'healthy')) {
        return { content:[{ type:'text', text:`⛔ Component ${comp} is unhealthy. Operation blocked.`}], blocked: true };
      }
      // Check if tool exists in registry
      if (!this.toolRegistry.has(toolName)) {
        const availableTools = this.toolRegistry.getToolNames();
        const similarTools = availableTools.filter(t => 
          t.toLowerCase().includes(toolName.toLowerCase()) || 
          toolName.toLowerCase().includes(t.toLowerCase())
        );
        
        const errorMessage = `Tool '${toolName}' not found in registry.` +
          (availableTools.length > 0 ? ` Available tools: ${availableTools.join(', ')}` : '') +
          (similarTools.length > 0 ? ` Similar tools: ${similarTools.join(', ')}` : '');
        
        throw new Error(errorMessage);
      }

      // Perform schema validation if available using normalized arguments
      const validation = this.toolRegistry.validateArgs(toolName, normalizedArgs);
      const validationDuration = Date.now() - validationStart;
      
      if (!validation.valid) {
        // Create detailed validation error message
        let errorMessage = `Input validation failed for tool '${toolName}':`;
        
        if (validation.details.missingFields?.length > 0) {
          errorMessage += `\n• Missing required fields: ${validation.details.missingFields.join(', ')}`;
        }
        
        if (validation.details.typeErrors?.length > 0) {
          validation.details.typeErrors.forEach(typeError => {
            errorMessage += `\n• Field '${typeError.field}': expected ${typeError.expected}, got ${typeError.received}`;
          });
        }
        
        if (validation.errors.length > 0) {
          errorMessage += `\n• Validation errors: ${validation.errors.join(', ')}`;
        }
        
        // Add example of expected format if schema is available
        const schema = this.toolRegistry.getSchema(toolName);
        if (schema && schema.properties) {
          const requiredFields = schema.required || [];
          if (requiredFields.length > 0) {
            errorMessage += `\n• Required fields: ${requiredFields.join(', ')}`;
          }
          
          // Show example format for the first few properties
          const exampleProps = Object.keys(schema.properties).slice(0, 3);
          if (exampleProps.length > 0) {
            const exampleFormat = exampleProps.reduce((example, prop) => {
              const propSchema = schema.properties[prop];
              example[prop] = propSchema.type === 'string' ? `"example_${prop}"` :
                             propSchema.type === 'number' ? 123 :
                             propSchema.type === 'boolean' ? true :
                             propSchema.type === 'array' ? [] : {};
              return example;
            }, {});
            errorMessage += `\n• Expected format: ${JSON.stringify(exampleFormat, null, 2)}`;
          }
        }
        
        // Log validation performance
        if (isTerminal && logger.isLevelEnabled && logger.isLevelEnabled('debug')) {
          logger.debug(`[VALIDATION] Tool: ${toolName} | Duration: ${validationDuration}ms | Result: FAILED`, {
            validationErrors: validation.errors,
            missingFields: validation.details.missingFields,
            typeErrors: validation.details.typeErrors
          });
        }
        
        throw new Error(errorMessage);
      }
      
      // Log successful validation
      if (isTerminal && logger.isLevelEnabled && logger.isLevelEnabled('debug')) {
        const validationStatus = validation.skipped ? 'SKIPPED' : 'PASSED';
        logger.debug(`[VALIDATION] Tool: ${toolName} | Duration: ${validationDuration}ms | Result: ${validationStatus}`, {
          hasSchema: this.toolRegistry.hasSchema(toolName),
          skipReason: validation.reason
        });
      }

      // PHASE 2: TIMEOUT HANDLING - Prevent hanging operations
      const toolPromise = this.toolRegistry.execute(toolName, normalizedArgs);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Tool execution timeout after 30 seconds`)), 30000);
      });
      
      const result = await Promise.race([toolPromise, timeoutPromise]);
      
      // NEW: Standardize all tool response formats to ensure MCP protocol compliance
      const standardizedResult = this.standardizeToolResponse(result, toolName);
      
      // PHASE 2: PERFORMANCE MONITORING - Track successful execution
      if (perfTimer && this.performanceMonitor && typeof this.performanceMonitor.endTimer === 'function') {
        try {
          const memoryAfter = process.memoryUsage();
          this.performanceMonitor.endTimer(perfTimer, {
            tool: toolName,
            memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed,
            validationDuration,
            success: true
          });
        } catch (perfError) {
          console.error('[PERF-ERROR] Failed to end performance timer (success):', perfError.message);
        }
      }
      
      return standardizedResult;
    } catch (e) {
      // PHASE 2: ENHANCED ERROR CONTEXT - Replace generic error messages
      let enhancedError = e;
      
      // Check if this is a dependency-related failure
      if (e.message && (
        e.message.includes('is not a function') ||
        e.message.includes('Cannot read property') ||
        e.message.includes('Cannot read properties of undefined') ||
        e.message.includes('Cannot read properties of null')
      )) {
        // This is likely a dependency injection issue
        const dependencyError = new Error(
          `Tool execution failed due to missing or corrupted dependency: ${e.message}. ` +
          `Please check that all required services are properly initialized for tool '${toolName}'.`
        );
        dependencyError.originalError = e;
        dependencyError.toolName = toolName;
        dependencyError.errorType = 'DEPENDENCY_FAILURE';
        enhancedError = dependencyError;
      } else if (e.message && e.message.includes('Input validation failed')) {
        // Already a validation error with good context
        enhancedError.errorType = 'VALIDATION_FAILURE';
      } else if (e.message && e.message.includes('not found in registry')) {
        // Tool not found error
        enhancedError.errorType = 'TOOL_NOT_FOUND';
      } else {
        // Generic tool execution error - enhance with context
        const contextualError = new Error(
          `Tool '${toolName}' execution failed: ${e.message}`
        );
        contextualError.originalError = e;
        contextualError.toolName = toolName;
        contextualError.errorType = 'EXECUTION_FAILURE';
        contextualError.args = args;
        enhancedError = contextualError;
      }
      
      // PHASE 2: PERFORMANCE MONITORING - Track failed execution
      if (perfTimer && this.performanceMonitor && typeof this.performanceMonitor.endTimer === 'function') {
        try {
          this.performanceMonitor.endTimer(perfTimer, {
            tool: toolName,
            error: enhancedError.message,
            errorType: enhancedError.errorType || 'UNKNOWN',
            success: false
          });
        } catch (perfError) {
          console.error('[PERF-ERROR] Failed to end performance timer (error):', perfError.message);
        }
      }
      
      if (isTerminal) {
        console.error(`[DISPATCH-${executionId}] Error executing tool:`, enhancedError.message);
        if (enhancedError.errorType) {
          console.error(`[DISPATCH-${executionId}] Error type: ${enhancedError.errorType}`);
        }
      }
      throw enhancedError;
    } finally {
      const executionEnd = Date.now();
      const executionDuration = executionEnd - executionStart;
      
      // PHASE 2: MEMORY MONITORING - Log memory usage after execution
      const memoryAfter = process.memoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      if (isTerminal && logger.isLevelEnabled && logger.isLevelEnabled('debug')) {
        console.error(
          `[DISPATCH-${executionId}] Tool execution completed in ${executionDuration}ms, memory delta: ${Math.round(memoryDelta / 1024)}KB`
        );
        logger.debug(
          `✅ [MCP-COMPLETE] Tool: ${toolName} | ID: ${executionId} | Duration: ${executionDuration}ms | Memory: ${Math.round(memoryDelta / 1024)}KB`
        );
        console.info(
          `✅ [MCP-COMPLETE] Tool: ${toolName} | ID: ${executionId} | Duration: ${executionDuration}ms | Memory: ${Math.round(memoryDelta / 1024)}KB`
        );
      }
    }
  }

  // NEW: Standardize all tool response formats to ensure MCP protocol compliance
  standardizeToolResponse(result, toolName) {
    // If result is already properly formatted, return as-is
    if (result && typeof result === 'object' && result.content && Array.isArray(result.content)) {
      // Ensure each content item has the required structure
      const validatedContent = result.content.map(item => {
        if (typeof item === 'object' && item.type && item.text) {
          return item; // Already valid
        } else if (typeof item === 'string') {
          return { type: 'text', text: item }; // Convert string to proper format
        } else {
          return { type: 'text', text: String(item) }; // Convert anything else to string
        }
      });
      
      return {
        ...result,
        content: validatedContent,
        success: true,
        toolName: toolName,
        timestamp: new Date().toISOString()
      };
    }
    
    // If result is a string, wrap it in proper MCP format
    if (typeof result === 'string') {
      return {
        content: [{ type: 'text', text: result }],
        success: true,
        toolName: toolName,
        timestamp: new Date().toISOString()
      };
    }
    
    // If result is an object but not properly formatted, wrap it
    if (result && typeof result === 'object') {
      // Try to extract meaningful text from the object
      let text = '';
      
      if (result.message) {
        text = result.message;
      } else if (result.text) {
        text = result.text;
      } else if (result.description) {
        text = result.description;
      } else {
        // Fallback: stringify the object
        try {
          text = JSON.stringify(result, null, 2);
        } catch (_e) {
          text = String(result);
        }
      }
      
      return {
        content: [{ type: 'text', text: text }],
        success: true,
        toolName: toolName,
        timestamp: new Date().toISOString(),
        originalResult: result
      };
    }
    
    // Fallback for any other type
    return {
      content: [{ type: 'text', text: String(result || 'Tool executed successfully') }],
      success: true,
      toolName: toolName,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Register all Forest tools in the registry
   * This replaces the giant switch statement with a clean, maintainable registry
   */
  registerAllTools() {
    // PHASE 2: PERFORMANCE MONITORING - Track tool registration time
    const registrationStart = Date.now();
    let perfTimer = null;
    
    if (this.performanceMonitor && typeof this.performanceMonitor.startTimer === 'function') {
      try {
        perfTimer = this.performanceMonitor.startTimer('TOOL_REGISTRATION');
      } catch (perfError) {
        console.error('[PERF-ERROR] Failed to start tool registration timer:', perfError.message);
      }
    }

    // Project Management Tools
    this.toolRegistry.register(
      'create_project',
      args => this.forestServer.createProject(args),
      'project'
    );
    this.toolRegistry.register(
      'switch_project',
      args => this.forestServer.switchProject(args.project_id),
      'project'
    );
    this.toolRegistry.register('list_projects', () => this.forestServer.listProjects(), 'project');
    this.toolRegistry.register(
      'get_active_project',
      () => this.forestServer.getActiveProject(),
      'project'
    );

    // HTA Tree Tools
    this.toolRegistry.register(
      'build_hta_tree',
      args =>
        this.forestServer.buildHTATree(
          args.path_name,
          args.learning_style || 'mixed',
          args.focus_areas || [],
          args.goal || null,
          args.context || ''
        ),
      'hta'
    );
    this.toolRegistry.register('get_hta_status', () => this.forestServer.getHTAStatus(), 'hta');

    // Scheduling Tools
    this.toolRegistry.register(
      'generate_daily_schedule',
      args =>
        this.forestServer.generateDailySchedule(
          args.date || null,
          args.energy_level ?? 3,
          args.available_hours || null,
          args.focus_type || 'mixed',
          args.schedule_request_context || 'User requested schedule'
        ),
      'scheduling'
    );
    this.toolRegistry.register(
      'generate_integrated_schedule',
      args =>
        this.forestServer.generateIntegratedSchedule(args.date || null, args.energy_level || 3),
      'scheduling'
    );

    // Task Management Tools
    this.toolRegistry.register(
      'get_next_task',
      args =>
        this.forestServer.getNextTask(
          args.context_from_memory || '',
          args.energy_level || 3,
          args.time_available || '30 minutes'
        ),
      'tasks'
    );
    this.toolRegistry.register(
      'complete_block',
      args => this.forestServer.completeBlock(args),
      'tasks'
    );
    this.toolRegistry.register(
      'complete_with_opportunities',
      args =>
        this.forestServer.completeBlock({
          ...args,
          opportunityContext: {
            engagementLevel: args.engagement_level || 5,
            unexpectedResults: args.unexpected_results || [],
            newSkillsRevealed: args.new_skills_revealed || [],
            externalFeedback: args.external_feedback || [],
            socialReactions: args.social_reactions || [],
            viralPotential: args.viral_potential || false,
            industryConnections: args.industry_connections || [],
            serendipitousEvents: args.serendipitous_events || [],
          },
        }),
      'tasks'
    );
    this.toolRegistry.register(
      'complete_block_and_next',
      async args => {
        const completion = await this.forestServer.completeBlock(args);
        // CRITICAL FIX: Pass completion context for momentum building
        const momentumContext = args.breakthrough
          ? `BREAKTHROUGH_CONTEXT: Task completed with breakthrough. Outcome: ${args.outcome}. Learned: ${args.learned || 'Key insights gained'}. Ready for advanced momentum building.`
          : `Task completed. Outcome: ${args.outcome}. ${args.learned ? `Learned: ${args.learned}.` : ''} Looking for momentum building opportunities.`;

        const next = await this.forestServer.getNextTask(
          momentumContext,
          args.energy_level || 3,
          '30 minutes'
        );
        return { ...completion, next_task: next };
      },
      'tasks'
    );

    // Strategy Tools
    this.toolRegistry.register(
      'evolve_strategy',
      args => this.forestServer.evolveStrategy(args.feedback || ''),
      'strategy'
    );
    this.toolRegistry.register(
      'current_status',
      () => this.forestServer.currentStatus(),
      'strategy'
    );

    // Analysis Tools
    this.toolRegistry.register(
      'analyze_performance',
      () => this.forestServer.analyzePerformance(),
      'analytics'
    );
    this.toolRegistry.register(
      'analyze_reasoning',
      args => this.forestServer.analyzeReasoning(args.include_detailed_analysis ?? true),
      'analytics'
    );
    this.toolRegistry.register(
      'analyze_complexity_evolution',
      () => this.forestServer.analyzeComplexityEvolution(),
      'analytics'
    );
    this.toolRegistry.register(
      'analyze_identity_transformation',
      () => this.forestServer.analyzeIdentityTransformation(),
      'analytics'
    );
    this.toolRegistry.register('review_week', () => this.forestServer.reviewPeriod(7), 'analytics');
    this.toolRegistry.register(
      'review_month',
      () => this.forestServer.reviewPeriod(30),
      'analytics'
    );

    // Export Tools
    this.toolRegistry.register(
      'generate_tiimo_export',
      args => this.forestServer.generateTiimoExport(args.include_breaks ?? true),
      'export'
    );

    // Memory Integration Tools
    this.toolRegistry.register(
      'sync_forest_memory',
      () => this.forestServer.syncForestMemory(),
      'memory'
    );

    // Learning Path Tools
    this.toolRegistry.register(
      'focus_learning_path',
      args =>
        this.forestServer.focusLearningPath(args.path_name, args.duration || 'until next switch'),
      'learning'
    );
    this.toolRegistry.register(
      'list_learning_paths',
      () => this.forestServer.listLearningPaths(),
      'learning'
    );

    // Debug Tools
    this.toolRegistry.register(
      'debug_health_check',
      () => this.forestServer.debugCommands.healthCheck(),
      'debug'
    );
    this.toolRegistry.register(
      'debug_trace_task',
      args => this.forestServer.debugCommands.traceTask(args.project_id || null),
      'debug'
    );
    this.toolRegistry.register(
      'debug_validate',
      () => this.forestServer.debugCommands.validateCurrent(),
      'debug'
    );
    this.toolRegistry.register(
      'debug_export',
      () => this.forestServer.debugCommands.exportLogs(),
      'debug'
    );
    this.toolRegistry.register(
      'debug_summary',
      () => this.forestServer.debugCommands.getSummary(),
      'debug'
    );
    this.toolRegistry.register(
      'debug_task_sequence',
      () => this.forestServer.debugTaskSequence(),
      'debug'
    );
    this.toolRegistry.register(
      'repair_sequence',
      args => this.forestServer.repairSequence(args.force_rebuild || false),
      'debug'
    );

    // Claude Integration Tools
    const truthfulHandler = args => this.forestServer.askTruthfulClaude(args.prompt);
    this.toolRegistry.register('ask_truthful', truthfulHandler, 'claude');
    this.toolRegistry.register('ask_truthful_claude', truthfulHandler, 'claude');
    this.toolRegistry.register('mcp_forest_ask_truthful', truthfulHandler, 'claude');
    this.toolRegistry.register('mcp_forest_ask_truthful_claude', truthfulHandler, 'claude');
    this.toolRegistry.register(
      'request_claude_generation',
      args =>
        this.forestServer.requestClaudeGeneration(
          args.prompt,
          args.generation_type || 'tasks',
          args.context || {}
        ),
      'claude'
    );

    // HTA Task Generation Tools
    this.toolRegistry.register(
      'generate_hta_tasks',
      args => this.forestServer.storeGeneratedTasks(args.branch_tasks),
      'hta'
    );
    this.toolRegistry.register(
      'get_generation_history',
      args => this.forestServer.getGenerationHistory(args.limit || 10),
      'hta'
    );

    // Dynamic branch expansion
    this.toolRegistry.register(
      'expand_branch',
      args => this.forestServer.expandBranch(args.branch_id, args.task_count ?? 10),
      'hta'
    );

    // Open task board URL (disabled - HTTP server removed)
    this.toolRegistry.register(
      'open_task_board',
      () => ({
        content:[{type:'text',text:`❌ Task board is no longer available - HTTP server was removed in favor of MCP-only operation.`}]
      }),
      'ui'
    );

    // === MISSING PERFORMANCE & SYSTEM TOOLS ===
    this.toolRegistry.register(
      'get_performance_metrics',
      args => this.forestServer.tools['get_performance_metrics'].handler(args),
      'performance'
    );
    this.toolRegistry.register(
      'get_metrics_dashboard',
      args => this.forestServer.tools['get_metrics_dashboard'].handler(args),
      'performance'
    );
    this.toolRegistry.register(
      'optimize_resources',
      args => this.forestServer.tools['optimize_resources'].handler(args),
      'performance'
    );

    // === MISSING PROACTIVE REASONING TOOLS ===
    this.toolRegistry.register(
      'start_proactive_reasoning',
      args => this.forestServer.tools['start_proactive_reasoning'].handler(args),
      'reasoning'
    );
    this.toolRegistry.register(
      'stop_proactive_reasoning',
      args => this.forestServer.tools['stop_proactive_reasoning'].handler(args),
      'reasoning'
    );
    this.toolRegistry.register(
      'get_proactive_status',
      args => this.forestServer.tools['get_proactive_status'].handler(args),
      'reasoning'
    );
    this.toolRegistry.register(
      'trigger_immediate_analysis',
      args => this.forestServer.tools['trigger_immediate_analysis'].handler(args),
      'reasoning'
    );
    this.toolRegistry.register(
      'get_proactive_insights',
      args => this.forestServer.tools['get_proactive_insights'].handler(args),
      'reasoning'
    );
    this.toolRegistry.register(
      'get_strategic_recommendations',
      args => this.forestServer.tools['get_strategic_recommendations'].handler(args),
      'reasoning'
    );

    // === MISSING DATA ARCHIVER TOOLS ===
    this.toolRegistry.register(
      'get_archive_status',
      args => this.forestServer.tools['get_archive_status'].handler(args),
      'archiver'
    );
    this.toolRegistry.register(
      'trigger_manual_archiving',
      args => this.forestServer.tools['trigger_manual_archiving'].handler(args),
      'archiver'
    );
    this.toolRegistry.register(
      'configure_archive_thresholds',
      args => this.forestServer.tools['configure_archive_thresholds'].handler(args),
      'archiver'
    );
    this.toolRegistry.register(
      'get_wisdom_store',
      args => this.forestServer.tools['get_wisdom_store'].handler(args),
      'archiver'
    );
    this.toolRegistry.register(
      'get_archive_metrics',
      args => this.forestServer.tools['get_archive_metrics'].handler(args),
      'archiver'
    );

    // === MISSING LOGGING TOOLS ===
    this.toolRegistry.register(
      'get_logging_status',
      args => this.forestServer.tools['get_logging_status'].handler(args),
      'logging'
    );
    this.toolRegistry.register(
      'get_log_stats',
      args => this.forestServer.tools['get_log_stats'].handler(args),
      'logging'
    );
    this.toolRegistry.register(
      'create_log_entry',
      args => this.forestServer.tools['create_log_entry'].handler(args),
      'logging'
    );
    this.toolRegistry.register(
      'start_performance_timer',
      args => this.forestServer.tools['start_performance_timer'].handler(args),
      'logging'
    );
    this.toolRegistry.register(
      'end_performance_timer',
      args => this.forestServer.tools['end_performance_timer'].handler(args),
      'logging'
    );
    this.toolRegistry.register(
      'view_recent_logs',
      args => this.forestServer.tools['view_recent_logs'].handler(args),
      'logging'
    );

    // === MISSING INTEGRATED SCHEDULE TOOL ===
    this.toolRegistry.register(
      'integrated_schedule',
      args => this.forestServer.tools['integrated_schedule'].handler(args),
      'scheduling'
    );

    // === MISSING DEBUG AUTO LOOP TOOL ===
    this.toolRegistry.register(
      'debug_auto_loop',
      args => this.forestServer.tools['debug_auto_loop'].handler(args),
      'debug'
    );

    // === MISSING ARCHIVE METRICS TOOL ===
    this.toolRegistry.register(
      'get_archive_metrics',
      args => this.forestServer.tools['get_archive_metrics'].handler(args),
      'archiver'
    );

    // PHASE 2: PERFORMANCE MONITORING - Complete tool registration tracking
    const registrationEnd = Date.now();
    const registrationDuration = registrationEnd - registrationStart;
    
    if (perfTimer && this.performanceMonitor && typeof this.performanceMonitor.endTimer === 'function') {
      try {
        this.performanceMonitor.endTimer(perfTimer, {
          toolsRegistered: this.toolRegistry.getToolCount ? this.toolRegistry.getToolCount() : 'unknown',
          registrationDuration
        });
      } catch (perfError) {
        console.error('[PERF-ERROR] Failed to end tool registration timer:', perfError.message);
      }
    }
    
    logger.event('TOOL_REGISTRATION_COMPLETE', {
      duration: registrationDuration,
      toolCount: this.toolRegistry.getToolCount ? this.toolRegistry.getToolCount() : 'unknown'
    });
  }

  setupRouter() {
    // PHASE 1: VALIDATION PIPELINE SETUP - Initialize error handling for validation failures
    // Note: MCP SDK handles errors internally, so we'll handle validation errors in the tool dispatch
    try {
      // Enhanced error tracking for validation failures - internal logging only
      if (typeof this.server.onError === 'function') {
        this.server.onError((error) => {
          if (error.message && error.message.includes('Input validation failed')) {
            logger.error('VALIDATION_ERROR', {
              error: error.message,
              toolName: error.toolName || 'unknown',
              errorType: error.errorType || 'validation',
              timestamp: new Date().toISOString()
            });
          }
        });
      }
    } catch (errorHandlerSetupError) {
      // MCP SDK might not support custom error handlers - continue without it
      logger.warn('Error handler setup skipped - MCP SDK may not support custom error handlers', {
        error: errorHandlerSetupError.message
      });
    }
    const isTerminal = process.stdin.isTTY;
          logger.event('TOOL_ROUTER_SETUP_START');

      if (isTerminal) {
        console.error('🔧 DEBUG: ToolRouter setupRouter() called with TRUTHFUL VERIFICATION');
      }

      logger.event('SETTING_CALL_TOOL_HANDLER');
      this.server.setRequestHandler(CallToolRequestSchema, async request => {
        logger.event('CALL_TOOL_REQUEST_RECEIVED', { tool: request.params.name });
      const { name: toolName, arguments: args } = request.params;

      if (isTerminal) {
        console.error(`▶️ Executing tool: ${toolName}`);
      }

              try {
          // Step 1: Execute the tool as normal.
          logger.event('DISPATCHING_TOOL', { tool: toolName });
          const timerLabel = `TOOL_DISPATCH_${toolName}`;
          logger.startTimer(timerLabel);
          const originalResult = await this.dispatchTool(toolName, args);
          logger.endTimer(timerLabel, { tool: toolName });
          logger.event('TOOL_DISPATCH_COMPLETE', { tool: toolName });

        // SIMPLIFIED: Return definitive tool response
        // Tools should provide trustworthy responses the first time
        // No post-hoc critique that makes output unreliable by design
        return originalResult;
      } catch (error) {
        // NEW: Enhanced error handling with detailed messages and suggestions
        let enhancedErrorMessage = `Tool '${toolName}' failed: ${error.message}`;
        
        // Check if this is a tool not found error
        if (error.message && error.message.includes('not found in registry')) {
          const availableTools = this.toolRegistry.getToolNames();
          const similarTools = availableTools.filter(t => 
            t.toLowerCase().includes(toolName.toLowerCase()) || 
            toolName.toLowerCase().includes(t.toLowerCase()) ||
            this.calculateSimilarity(t, toolName) > 0.6
          );
          
          enhancedErrorMessage = `Tool '${toolName}' not found.`;
          
          if (similarTools.length > 0) {
            enhancedErrorMessage += ` Did you mean: ${similarTools.slice(0, 3).join(', ')}?`;
          }
          
          if (availableTools.length > 0) {
            const categories = this.toolRegistry.getStats()?.categories || {};
            const categoryInfo = Object.keys(categories).length > 0 
              ? ` Available categories: ${Object.keys(categories).join(', ')}.`
              : '';
            
            enhancedErrorMessage += ` Total available tools: ${availableTools.length}.${categoryInfo}`;
          }
        }
        
        // Check if this is a validation error
        else if (error.message && error.message.includes('Input validation failed')) {
          enhancedErrorMessage = error.message; // Keep detailed validation message
          
          // Add suggestion to check tool schema
          if (this.toolRegistry.hasSchema(toolName)) {
            enhancedErrorMessage += `\n💡 Tip: Use the tool schema to check required parameters.`;
          }
        }
        
        // Check if this is a dependency error
        else if (error.errorType === 'DEPENDENCY_FAILURE') {
          enhancedErrorMessage = `Tool '${toolName}' failed due to missing dependency: ${error.message}`;
          enhancedErrorMessage += `\n💡 This usually indicates a server initialization issue. Try restarting the server or check the logs.`;
        }
        
        logger.error('TOOL_EXECUTION_ERROR', {
          tool: toolName,
          error: error.message,
          errorType: error.errorType || 'unknown',
          enhancedMessage: enhancedErrorMessage,
          stack: error.stack,
        });
        
        if (isTerminal) {
          console.error('Tool execution failed:', { toolName, error: enhancedErrorMessage });
        }
        
        throw new Error(enhancedErrorMessage, { cause: error });
      }
    });
    logger.event('CALL_TOOL_HANDLER_SET');

    if (isTerminal) {
      console.error('🔧 DEBUG: CallToolRequestSchema handler registration completed');
    }

    logger.event('TOOL_ROUTER_SETUP_COMPLETE');
  }
  
  // NEW: Helper method to calculate string similarity for tool suggestions
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  // NEW: Helper method for calculating edit distance
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Ensure every tool present in the internal `ToolRegistry` is also present
   * in `forestServer.tools` so that the MCP capability advertisement is kept
   * in perfect sync.  This is a *no-op* if the tool already exists or if the
   * forest server instance is unavailable.
   *
   * The auto-generated advertisement entry is intentionally minimal – the
   * authoritative validation schema lives in the registry.  Calls are routed
   * straight back through the registry to avoid duplicate logic.
   *
   * This method is idempotent and safe to call multiple times.
   */
  _syncForestToolAdvertisements() {
    if (!this.forestServer || !this.forestServer.tools) {
      return;
    }

    const registeredToolNames = this.toolRegistry.getToolNames();

    for (const toolName of registeredToolNames) {
      if (!Object.prototype.hasOwnProperty.call(this.forestServer.tools, toolName)) {
        // Create a thin wrapper that forwards execution to the registry.
        this.forestServer.tools[toolName] = {
          description: '[Auto-advertised] Tool registered via ToolRouter',
          parameters: { type: 'object', properties: {}, required: [] },
          handler: args => this.toolRegistry.execute(toolName, args ?? {}),
        };
      }
    }
  }
}
