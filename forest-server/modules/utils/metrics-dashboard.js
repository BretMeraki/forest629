/**
 * Metrics Dashboard Module
 * Provides comprehensive system metrics and monitoring
 */

export class MetricsDashboard {
  constructor() {
    this.metrics = {
      system: {
        uptime: 0,
        memoryUsage: {},
        cpuUsage: 0
      },
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0
      },
      tasks: {
        completed: 0,
        failed: 0,
        inProgress: 0,
        queued: 0
      },
      projects: {
        active: 0,
        total: 0
      }
    };
    
    this.startTime = Date.now();
    this.requestHistory = [];
    this.taskHistory = [];
  }

  updateSystemMetrics() {
    this.metrics.system.uptime = Date.now() - this.startTime;
    this.metrics.system.memoryUsage = process.memoryUsage();
    
    // CPU usage would require additional monitoring
    this.metrics.system.cpuUsage = 0; // Placeholder
  }

  recordRequest(success, responseTime) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    
    this.requestHistory.push({
      timestamp: Date.now(),
      success,
      responseTime
    });
    
    // Keep only last 1000 requests
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-1000);
    }
    
    // Calculate average response time
    const recentRequests = this.requestHistory.slice(-100);
    this.metrics.requests.averageResponseTime = 
      recentRequests.reduce((sum, req) => sum + req.responseTime, 0) / recentRequests.length;
  }

  recordTask(status) {
    this.taskHistory.push({
      timestamp: Date.now(),
      status
    });
    
    // Keep only last 1000 tasks
    if (this.taskHistory.length > 1000) {
      this.taskHistory = this.taskHistory.slice(-1000);
    }
    
    // Update task counts
    const recentTasks = this.taskHistory.slice(-100);
    this.metrics.tasks.completed = recentTasks.filter(t => t.status === 'completed').length;
    this.metrics.tasks.failed = recentTasks.filter(t => t.status === 'failed').length;
  }

  updateProjectMetrics(activeCount, totalCount) {
    this.metrics.projects.active = activeCount;
    this.metrics.projects.total = totalCount;
  }

  getMetrics() {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  getHealthScore() {
    const metrics = this.getMetrics();
    let score = 100;
    
    // Deduct points for high memory usage
    const memoryUsagePercent = (metrics.system.memoryUsage.heapUsed / metrics.system.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) score -= 20;
    else if (memoryUsagePercent > 60) score -= 10;
    
    // Deduct points for high error rate
    const errorRate = metrics.requests.failed / Math.max(metrics.requests.total, 1);
    if (errorRate > 0.1) score -= 30;
    else if (errorRate > 0.05) score -= 15;
    
    // Deduct points for slow response times
    if (metrics.requests.averageResponseTime > 5000) score -= 25;
    else if (metrics.requests.averageResponseTime > 2000) score -= 10;
    
    return Math.max(0, score);
  }

  getPerformanceTrends() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentRequests = this.requestHistory.filter(r => r.timestamp > oneHourAgo);
    const recentTasks = this.taskHistory.filter(t => t.timestamp > oneHourAgo);
    
    return {
      requestsPerHour: recentRequests.length,
      successRate: recentRequests.filter(r => r.success).length / Math.max(recentRequests.length, 1),
      averageResponseTime: recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / Math.max(recentRequests.length, 1),
      tasksPerHour: recentTasks.length,
      taskSuccessRate: recentTasks.filter(t => t.status === 'completed').length / Math.max(recentTasks.length, 1)
    };
  }

  generateReport() {
    const metrics = this.getMetrics();
    const healthScore = this.getHealthScore();
    const trends = this.getPerformanceTrends();
    
    return {
      timestamp: Date.now(),
      healthScore,
      metrics,
      trends,
      recommendations: this.getRecommendations(healthScore, metrics, trends)
    };
  }

  getRecommendations(healthScore, metrics, trends) {
    const recommendations = [];
    
    if (healthScore < 70) {
      recommendations.push('System health is below optimal. Consider investigating performance issues.');
    }
    
    if (trends.successRate < 0.95) {
      recommendations.push('Request success rate is low. Check error logs for issues.');
    }
    
    if (trends.averageResponseTime > 2000) {
      recommendations.push('Response times are high. Consider optimizing slow operations.');
    }
    
    const memoryUsagePercent = (metrics.system.memoryUsage.heapUsed / metrics.system.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push('Memory usage is high. Consider implementing memory optimization strategies.');
    }
    
    return recommendations;
  }
}
