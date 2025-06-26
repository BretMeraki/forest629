/**
 * Error Boundary System - Prevents cascading failures
 */

import { getForestLogger } from '../winston-logger.js';

const logger = getForestLogger({ module: 'ErrorBoundary' });

export class ErrorBoundary {
  constructor(name, options = {}) {
    this.name = name;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.fallback = options.fallback;
    this.onError = options.onError;
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
    
    // PHASE 3: PERFORMANCE INTEGRATION - Connect to performance monitor
    this.performanceMonitor = options.performanceMonitor || null;
    
    this.errorCount = 0;
    this.lastError = null;
    this.isCircuitOpen = false;
    this.lastCircuitCheck = Date.now();
    this.successCount = 0;
    
    // PHASE 3: ERROR CATEGORIZATION - Track different types of failures
    this.errorCategories = {
      methodNotFound: 0,
      timeout: 0,
      resourceExhaustion: 0,
      networkError: 0,
      validation: 0,
      unknown: 0
    };
  }

  /**
   * Execute function with error boundary protection
   */
  async execute(fn, ...args) {
    // Check circuit breaker
    if (this.isCircuitOpen && Date.now() - this.lastCircuitCheck < 60000) {
      if (this.fallback) {
        logger.warn(`Circuit breaker open for '${this.name}', using fallback`);
        return await this.fallback(...args);
      }
      throw new Error(`Circuit breaker open for '${this.name}'`);
    }

    let lastError;
    let perfTimer = null;
    
    // PHASE 3: PERFORMANCE MONITORING - Track execution time
    if (this.performanceMonitor && typeof this.performanceMonitor.startTimer === 'function') {
      try {
        perfTimer = this.performanceMonitor.startTimer(`ERROR_BOUNDARY_${this.name}`);
      } catch (perfError) {
        logger.warn(`Failed to start performance timer for boundary '${this.name}'`, { error: perfError.message });
      }
    }
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn(...args);
        
        // Reset error count on success
        this.errorCount = 0;
        this.successCount++;
        this.isCircuitOpen = false;
        
        // PHASE 3: PERFORMANCE MONITORING - Track successful execution
        if (perfTimer && this.performanceMonitor && typeof this.performanceMonitor.endTimer === 'function') {
          try {
            this.performanceMonitor.endTimer(perfTimer, {
              boundary: this.name,
              attempt: attempt,
              success: true
            });
          } catch (perfError) {
            logger.warn(`Failed to end performance timer for boundary '${this.name}' (success)`, { error: perfError.message });
          }
        }
        
        return result;
      } catch (error) {
        lastError = error;
        this.errorCount++;
        this.lastError = error;
        
        // PHASE 3: ERROR CATEGORIZATION - Classify the error type
        const errorCategory = this.categorizeError(error);
        this.errorCategories[errorCategory]++;
        
        // PHASE 3: SPECIFIC HANDLING FOR METHOD-NOT-FOUND ERRORS
        if (errorCategory === 'methodNotFound') {
          const objectDebugInfo = this.captureObjectState(args[0]);
          logger.error(`Method not found error in boundary '${this.name}'`, {
            error: error.message,
            attempt: attempt,
            objectDebugInfo,
            stack: error.stack
          });
        }

        logger.warn(`Error boundary '${this.name}' caught error (attempt ${attempt}/${this.maxRetries})`, {
          error: error.message,
          errorCategory,
          stack: error.stack
        });

        // PHASE 3: PERFORMANCE CORRELATION - Check if errors correlate with resource pressure
        if (this.performanceMonitor) {
          const systemHealth = this.performanceMonitor.healthStatus;
          if (systemHealth && (systemHealth.memory === 'critical' || systemHealth.cpu === 'critical')) {
            logger.warn(`Error occurred during resource pressure in boundary '${this.name}'`, {
              systemHealth,
              errorCategory,
              attempt
            });
          }
        }

        // Check circuit breaker threshold
        if (this.errorCount >= this.circuitBreakerThreshold) {
          this.isCircuitOpen = true;
          this.lastCircuitCheck = Date.now();
          logger.error(`Circuit breaker opened for '${this.name}'`);
        }

        // Call error handler
        if (this.onError) {
          await this.onError(error, attempt, errorCategory);
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }

    // PHASE 3: PERFORMANCE MONITORING - Track failed execution
    if (perfTimer && this.performanceMonitor && typeof this.performanceMonitor.endTimer === 'function') {
      try {
        this.performanceMonitor.endTimer(perfTimer, {
          boundary: this.name,
          maxAttemptsReached: true,
          success: false,
          finalError: lastError?.message
        });
      } catch (perfError) {
        logger.warn(`Failed to end performance timer for boundary '${this.name}' (failed)`, { error: perfError.message });
      }
    }

    // All retries failed, try fallback
    if (this.fallback) {
      logger.warn(`All retries failed for '${this.name}', using fallback`);
      return await this.fallback(...args);
    }

    throw lastError;
  }

  /**
   * PHASE 3: ERROR CATEGORIZATION - Classify different types of failures
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('is not a function') || message.includes('method not found')) {
      return 'methodNotFound';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('memory') || message.includes('resource') || message.includes('limit')) {
      return 'resourceExhaustion';
    }
    if (message.includes('network') || message.includes('connection') || message.includes('enotfound')) {
      return 'networkError';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    
    return 'unknown';
  }

  /**
   * PHASE 3: OBJECT STATE CAPTURE - Capture debugging information for object-related errors
   */
  captureObjectState(obj) {
    if (!obj || typeof obj !== 'object') {
      return { type: typeof obj, value: obj };
    }

    try {
      return {
        type: typeof obj,
        constructor: obj.constructor?.name,
        hasPrototype: !!Object.getPrototypeOf(obj),
        ownProperties: Object.getOwnPropertyNames(obj),
        methods: Object.getOwnPropertyNames(obj).filter(prop => typeof obj[prop] === 'function'),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
    } catch (captureError) {
      return { 
        error: 'Failed to capture object state', 
        captureError: captureError.message 
      };
    }
  }

  /**
   * Get boundary status
   */
  getStatus() {
    return {
      name: this.name,
      errorCount: this.errorCount,
      successCount: this.successCount,
      isCircuitOpen: this.isCircuitOpen,
      lastError: this.lastError?.message,
      lastCircuitCheck: this.lastCircuitCheck,
      successRate: this.successCount / (this.successCount + this.errorCount) || 0,
      // PHASE 3: ERROR CATEGORIZATION - Include error category breakdown
      errorCategories: { ...this.errorCategories },
      performanceImpact: this.calculatePerformanceImpact()
    };
  }

  /**
   * PHASE 3: PERFORMANCE IMPACT CALCULATION
   */
  calculatePerformanceImpact() {
    const totalErrors = Object.values(this.errorCategories).reduce((sum, count) => sum + count, 0);
    const criticalErrors = this.errorCategories.methodNotFound + this.errorCategories.resourceExhaustion;
    
    return {
      totalErrors,
      criticalErrorRate: totalErrors > 0 ? criticalErrors / totalErrors : 0,
      isHighImpact: criticalErrors > 3 || this.errorCount > 10
    };
  }

  /**
   * Reset the error boundary
   */
  reset() {
    this.errorCount = 0;
    this.successCount = 0;
    this.isCircuitOpen = false;
    this.lastError = null;
    logger.info(`Error boundary '${this.name}' reset`);
  }
}

// Global error boundaries registry
export const errorBoundaries = new Map();

/**
 * Create or get error boundary
 */
export function createErrorBoundary(name, options) {
  if (!errorBoundaries.has(name)) {
    errorBoundaries.set(name, new ErrorBoundary(name, options));
  }
  return errorBoundaries.get(name);
}

/**
 * Execute function with automatic error boundary
 */
export async function withErrorBoundary(name, fn, options = {}) {
  const boundary = createErrorBoundary(name, options);
  return await boundary.execute(fn);
}

/**
 * Get status of all error boundaries
 */
export function getAllBoundaryStatuses() {
  const statuses = {};
  for (const [name, boundary] of errorBoundaries) {
    statuses[name] = boundary.getStatus();
  }
  return statuses;
} 