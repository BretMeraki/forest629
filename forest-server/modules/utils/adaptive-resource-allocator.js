/**
 * Adaptive Resource Allocator Module
 * Manages system resources based on current load and performance
 */

export class AdaptiveResourceAllocator {
  constructor() {
    this.resourceLimits = {
      maxConcurrentTasks: 10,
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      maxLogSize: 50 * 1024 * 1024 // 50MB
    };
    
    this.currentUsage = {
      activeTasks: 0,
      memoryUsage: 0,
      cacheSize: 0,
      logSize: 0
    };
    
    this.adaptationHistory = [];
  }

  canAllocateTask() {
    return this.currentUsage.activeTasks < this.resourceLimits.maxConcurrentTasks;
  }

  allocateTask() {
    if (!this.canAllocateTask()) {
      throw new Error('Cannot allocate task: resource limit reached');
    }
    
    this.currentUsage.activeTasks++;
    return this.currentUsage.activeTasks;
  }

  releaseTask() {
    if (this.currentUsage.activeTasks > 0) {
      this.currentUsage.activeTasks--;
    }
    return this.currentUsage.activeTasks;
  }

  updateMemoryUsage(usage) {
    this.currentUsage.memoryUsage = usage;
    
    // Adapt limits based on memory pressure
    if (usage > this.resourceLimits.maxMemoryUsage * 0.8) {
      this.adaptResourceLimits('memory_pressure');
    }
  }

  updateCacheSize(size) {
    this.currentUsage.cacheSize = size;
    
    if (size > this.resourceLimits.maxCacheSize * 0.9) {
      this.adaptResourceLimits('cache_pressure');
    }
  }

  adaptResourceLimits(reason) {
    const adaptation = {
      timestamp: Date.now(),
      reason,
      oldLimits: { ...this.resourceLimits },
      newLimits: null
    };

    switch (reason) {
      case 'memory_pressure':
        this.resourceLimits.maxConcurrentTasks = Math.max(2, this.resourceLimits.maxConcurrentTasks - 2);
        this.resourceLimits.maxCacheSize = Math.max(10 * 1024 * 1024, this.resourceLimits.maxCacheSize * 0.8);
        break;
        
      case 'cache_pressure':
        this.resourceLimits.maxCacheSize = Math.max(10 * 1024 * 1024, this.resourceLimits.maxCacheSize * 0.7);
        break;
        
      case 'low_load':
        this.resourceLimits.maxConcurrentTasks = Math.min(20, this.resourceLimits.maxConcurrentTasks + 1);
        this.resourceLimits.maxCacheSize = Math.min(200 * 1024 * 1024, this.resourceLimits.maxCacheSize * 1.1);
        break;
    }

    adaptation.newLimits = { ...this.resourceLimits };
    this.adaptationHistory.push(adaptation);
    
    // Keep only last 50 adaptations
    if (this.adaptationHistory.length > 50) {
      this.adaptationHistory = this.adaptationHistory.slice(-50);
    }

    console.log(`Resource limits adapted due to ${reason}:`, adaptation);
  }

  getResourceStatus() {
    const memoryUsage = process.memoryUsage();
    
    return {
      limits: this.resourceLimits,
      usage: {
        ...this.currentUsage,
        memoryUsage: memoryUsage.heapUsed
      },
      utilization: {
        tasks: (this.currentUsage.activeTasks / this.resourceLimits.maxConcurrentTasks) * 100,
        memory: (memoryUsage.heapUsed / this.resourceLimits.maxMemoryUsage) * 100,
        cache: (this.currentUsage.cacheSize / this.resourceLimits.maxCacheSize) * 100
      },
      adaptationCount: this.adaptationHistory.length
    };
  }

  shouldThrottle() {
    const status = this.getResourceStatus();
    return status.utilization.memory > 80 || status.utilization.tasks > 90;
  }

  getRecommendedDelay() {
    if (!this.shouldThrottle()) return 0;
    
    const status = this.getResourceStatus();
    const maxUtilization = Math.max(status.utilization.memory, status.utilization.tasks);
    
    // Exponential backoff based on utilization
    return Math.min(5000, Math.pow(2, (maxUtilization - 80) / 10) * 100);
  }
}
