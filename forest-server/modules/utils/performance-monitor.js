/**
 * Performance Monitor Module
 * Tracks system performance metrics and provides optimization insights
 */

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      requestCount: 0,
      averageResponseTime: 0,
      memoryUsage: [],
      errorCount: 0,
      lastError: null
    };
    
    this.responseTimeHistory = [];
    this.maxHistorySize = 100;
    
    // Start monitoring
    this.startMonitoring();
  }

  startMonitoring() {
    // Monitor memory usage every 30 seconds
    setInterval(() => {
      this.recordMemoryUsage();
    }, 30000);
  }

  recordMemoryUsage() {
    const usage = process.memoryUsage();
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    });

    // Keep only last 100 entries
    if (this.metrics.memoryUsage.length > this.maxHistorySize) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-this.maxHistorySize);
    }
  }

  recordRequest(responseTime) {
    this.metrics.requestCount++;
    this.responseTimeHistory.push(responseTime);
    
    // Keep only last 100 response times
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-this.maxHistorySize);
    }
    
    // Calculate average response time
    this.metrics.averageResponseTime = 
      this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / 
      this.responseTimeHistory.length;
  }

  recordError(error) {
    this.metrics.errorCount++;
    this.metrics.lastError = {
      message: error.message,
      timestamp: Date.now(),
      stack: error.stack
    };
  }

  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const currentMemory = process.memoryUsage();
    
    return {
      ...this.metrics,
      uptime,
      currentMemory,
      requestsPerMinute: this.metrics.requestCount / (uptime / 60000),
      errorRate: this.metrics.errorCount / Math.max(this.metrics.requestCount, 1)
    };
  }

  getHealthStatus() {
    const metrics = this.getMetrics();
    const health = {
      status: 'healthy',
      issues: []
    };

    // Check memory usage
    if (metrics.currentMemory.heapUsed > 500 * 1024 * 1024) { // 500MB
      health.status = 'warning';
      health.issues.push('High memory usage detected');
    }

    // Check error rate
    if (metrics.errorRate > 0.05) { // 5% error rate
      health.status = 'warning';
      health.issues.push('High error rate detected');
    }

    // Check response time
    if (metrics.averageResponseTime > 5000) { // 5 seconds
      health.status = 'warning';
      health.issues.push('Slow response times detected');
    }

    return health;
  }

  reset() {
    this.metrics = {
      startTime: Date.now(),
      requestCount: 0,
      averageResponseTime: 0,
      memoryUsage: [],
      errorCount: 0,
      lastError: null
    };
    this.responseTimeHistory = [];
  }
}
