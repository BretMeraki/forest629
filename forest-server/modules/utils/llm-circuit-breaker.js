/**
 * LLM Circuit Breaker Utility
 * 
 * Prevents cascade failures from repeated LLM failures by implementing
 * a circuit breaker pattern. Tracks failure counts and timestamps,
 * opens the circuit after threshold failures, and provides immediate
 * fallback responses when the circuit is open.
 */

import { getForestLogger } from '../../utils/logger.js';

const logger = getForestLogger({ module: 'LLMCircuitBreaker' });

/**
 * Circuit breaker states
 */
const CIRCUIT_STATES = {
  CLOSED: 'closed',     // Normal operation
  OPEN: 'open',         // Circuit is open, failing fast
  HALF_OPEN: 'half_open' // Testing if service has recovered
};

/**
 * Default configuration for different call types
 */
const DEFAULT_CONFIG = {
  task_generation: {
    failureThreshold: 3,
    timeWindow: 60000,      // 60 seconds
    resetTimeout: 120000,   // 2 minutes
    halfOpenMaxCalls: 1
  },
  complexity_analysis: {
    failureThreshold: 2,
    timeWindow: 30000,      // 30 seconds
    resetTimeout: 60000,    // 1 minute
    halfOpenMaxCalls: 1
  },
  schedule_generation: {
    failureThreshold: 3,
    timeWindow: 60000,
    resetTimeout: 90000,
    halfOpenMaxCalls: 1
  },
  web_summarization: {
    failureThreshold: 5,    // More tolerant for web content
    timeWindow: 120000,     // 2 minutes
    resetTimeout: 180000,   // 3 minutes
    halfOpenMaxCalls: 2
  },
  default: {
    failureThreshold: 3,
    timeWindow: 60000,
    resetTimeout: 120000,
    halfOpenMaxCalls: 1
  }
};

export class LLMCircuitBreaker {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.circuits = new Map(); // Per call type circuit state
    this.metrics = {
      totalCalls: 0,
      totalFailures: 0,
      circuitOpens: 0,
      fallbacksUsed: 0,
      callsByType: new Map(),
      failuresByType: new Map()
    };
    
    logger.info('LLMCircuitBreaker initialized', {
      configuredTypes: Object.keys(this.config)
    });
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Async function to execute
   * @param {Function} fallback - Fallback function if circuit is open
   * @param {string} callType - Type of call for specific thresholds
   * @returns {Promise<any>} Result of fn or fallback
   */
  async call(fn, fallback, callType = 'default') {
    const circuit = this.getCircuit(callType);
    const config = this.config[callType] || this.config.default;
    
    this.metrics.totalCalls++;
    this.updateCallMetrics(callType);
    
    // Check circuit state
    if (circuit.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() - circuit.lastFailureTime > config.resetTimeout) {
        // Transition to half-open
        circuit.state = CIRCUIT_STATES.HALF_OPEN;
        circuit.halfOpenCalls = 0;
        logger.info('Circuit transitioning to half-open', { callType });
      } else {
        // Circuit is open, use fallback
        this.metrics.fallbacksUsed++;
        logger.debug('Circuit open, using fallback', { callType });
        return await this.executeFallback(fallback, callType);
      }
    }
    
    if (circuit.state === CIRCUIT_STATES.HALF_OPEN) {
      if (circuit.halfOpenCalls >= config.halfOpenMaxCalls) {
        // Too many half-open calls, use fallback
        this.metrics.fallbacksUsed++;
        return await this.executeFallback(fallback, callType);
      }
      circuit.halfOpenCalls++;
    }
    
    try {
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;
      
      // Success - reset circuit if it was half-open
      if (circuit.state === CIRCUIT_STATES.HALF_OPEN) {
        circuit.state = CIRCUIT_STATES.CLOSED;
        circuit.failures = [];
        logger.info('Circuit closed after successful half-open call', { callType });
      }
      
      logger.debug('LLM call succeeded', { callType, duration });
      return result;
      
    } catch (error) {
      return await this.handleFailure(error, fallback, callType);
    }
  }

  /**
   * Handle LLM call failure
   */
  async handleFailure(error, fallback, callType) {
    const circuit = this.getCircuit(callType);
    const config = this.config[callType] || this.config.default;
    const now = Date.now();
    
    this.metrics.totalFailures++;
    this.updateFailureMetrics(callType);
    
    // Add failure to circuit
    circuit.failures.push(now);
    circuit.lastFailureTime = now;
    
    // Clean old failures outside time window
    circuit.failures = circuit.failures.filter(
      failureTime => now - failureTime <= config.timeWindow
    );
    
    // Check if we should open the circuit
    if (circuit.failures.length >= config.failureThreshold) {
      if (circuit.state !== CIRCUIT_STATES.OPEN) {
        circuit.state = CIRCUIT_STATES.OPEN;
        this.metrics.circuitOpens++;
        logger.warn('Circuit opened due to failures', {
          callType,
          failures: circuit.failures.length,
          threshold: config.failureThreshold,
          error: error.message
        });
      }
    }
    
    // Use fallback
    this.metrics.fallbacksUsed++;
    logger.debug('LLM call failed, using fallback', {
      callType,
      error: error.message,
      circuitState: circuit.state
    });
    
    return await this.executeFallback(fallback, callType);
  }

  /**
   * Execute fallback function safely
   */
  async executeFallback(fallback, callType) {
    try {
      if (typeof fallback === 'function') {
        return await fallback();
      } else {
        return fallback; // Return static fallback value
      }
    } catch (fallbackError) {
      logger.error('Fallback function failed', {
        callType,
        error: fallbackError.message
      });
      throw new Error(`Both LLM call and fallback failed for ${callType}`);
    }
  }

  /**
   * Get or create circuit for call type
   */
  getCircuit(callType) {
    if (!this.circuits.has(callType)) {
      this.circuits.set(callType, {
        state: CIRCUIT_STATES.CLOSED,
        failures: [],
        lastFailureTime: 0,
        halfOpenCalls: 0
      });
    }
    return this.circuits.get(callType);
  }

  /**
   * Get current circuit breaker state
   */
  getState() {
    const states = {};
    for (const [callType, circuit] of this.circuits) {
      states[callType] = {
        state: circuit.state,
        failures: circuit.failures.length,
        lastFailureTime: circuit.lastFailureTime,
        halfOpenCalls: circuit.halfOpenCalls
      };
    }
    return states;
  }

  /**
   * Reset circuit breaker for specific call type or all
   */
  reset(callType = null) {
    if (callType) {
      const circuit = this.getCircuit(callType);
      circuit.state = CIRCUIT_STATES.CLOSED;
      circuit.failures = [];
      circuit.lastFailureTime = 0;
      circuit.halfOpenCalls = 0;
      logger.info('Circuit reset', { callType });
    } else {
      this.circuits.clear();
      logger.info('All circuits reset');
    }
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    return {
      ...this.metrics,
      circuitStates: this.getState(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update call metrics
   */
  updateCallMetrics(callType) {
    const current = this.metrics.callsByType.get(callType) || 0;
    this.metrics.callsByType.set(callType, current + 1);
  }

  /**
   * Update failure metrics
   */
  updateFailureMetrics(callType) {
    const current = this.metrics.failuresByType.get(callType) || 0;
    this.metrics.failuresByType.set(callType, current + 1);
  }
}

// Singleton instance for global use
export const globalCircuitBreaker = new LLMCircuitBreaker();

export default LLMCircuitBreaker;
