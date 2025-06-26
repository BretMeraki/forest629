/**
 * Task Batcher Module
 * Batches similar tasks together for efficient processing
 */

export class TaskBatcher {
  constructor() {
    this.batches = new Map();
    this.batchConfig = {
      maxBatchSize: 10,
      maxWaitTime: 5000, // 5 seconds
      minBatchSize: 2
    };
    
    this.timers = new Map();
    this.processors = new Map();
  }

  addTask(batchKey, task, processor) {
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, []);
      this.processors.set(batchKey, processor);
    }
    
    const batch = this.batches.get(batchKey);
    batch.push({
      id: this.generateTaskId(),
      data: task,
      timestamp: Date.now()
    });
    
    // Start timer if this is the first task in batch
    if (batch.length === 1) {
      this.startBatchTimer(batchKey);
    }
    
    // Process immediately if batch is full
    if (batch.length >= this.batchConfig.maxBatchSize) {
      this.processBatch(batchKey);
    }
    
    return batch[batch.length - 1].id;
  }

  startBatchTimer(batchKey) {
    if (this.timers.has(batchKey)) {
      clearTimeout(this.timers.get(batchKey));
    }
    
    const timer = setTimeout(() => {
      this.processBatch(batchKey);
    }, this.batchConfig.maxWaitTime);
    
    this.timers.set(batchKey, timer);
  }

  async processBatch(batchKey) {
    const batch = this.batches.get(batchKey);
    const processor = this.processors.get(batchKey);
    
    if (!batch || batch.length === 0) return;
    
    // Clear timer
    if (this.timers.has(batchKey)) {
      clearTimeout(this.timers.get(batchKey));
      this.timers.delete(batchKey);
    }
    
    // Only process if we have minimum batch size or timeout occurred
    if (batch.length < this.batchConfig.minBatchSize) {
      const oldestTask = batch[0];
      const age = Date.now() - oldestTask.timestamp;
      
      if (age < this.batchConfig.maxWaitTime) {
        // Wait longer for more tasks
        this.startBatchTimer(batchKey);
        return;
      }
    }
    
    // Remove batch from queue
    const tasksToProcess = [...batch];
    this.batches.set(batchKey, []);
    
    try {
      console.log(`Processing batch ${batchKey} with ${tasksToProcess.length} tasks`);
      
      if (processor) {
        await processor(tasksToProcess);
      }
      
      console.log(`Batch ${batchKey} processed successfully`);
    } catch (error) {
      console.error(`Batch ${batchKey} processing failed:`, error);
      
      // Optionally re-queue failed tasks
      this.handleBatchFailure(batchKey, tasksToProcess, error);
    }
  }

  handleBatchFailure(batchKey, failedTasks, error) {
    // Simple retry logic - add tasks back to batch
    const batch = this.batches.get(batchKey) || [];
    
    failedTasks.forEach(task => {
      task.retryCount = (task.retryCount || 0) + 1;
      
      // Only retry up to 3 times
      if (task.retryCount <= 3) {
        batch.push(task);
      } else {
        console.error(`Task ${task.id} failed permanently after 3 retries`);
      }
    });
    
    this.batches.set(batchKey, batch);
    
    // Restart timer if we have tasks to retry
    if (batch.length > 0) {
      this.startBatchTimer(batchKey);
    }
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getBatchStatus() {
    const status = {};
    
    for (const [batchKey, batch] of this.batches) {
      status[batchKey] = {
        taskCount: batch.length,
        oldestTask: batch.length > 0 ? batch[0].timestamp : null,
        hasTimer: this.timers.has(batchKey)
      };
    }
    
    return status;
  }

  flushBatch(batchKey) {
    if (this.batches.has(batchKey)) {
      this.processBatch(batchKey);
    }
  }

  flushAllBatches() {
    for (const batchKey of this.batches.keys()) {
      this.flushBatch(batchKey);
    }
  }

  configureBatching(config) {
    this.batchConfig = { ...this.batchConfig, ...config };
  }

  removeBatch(batchKey) {
    if (this.timers.has(batchKey)) {
      clearTimeout(this.timers.get(batchKey));
      this.timers.delete(batchKey);
    }
    
    this.batches.delete(batchKey);
    this.processors.delete(batchKey);
  }

  shutdown() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    // Process remaining batches
    this.flushAllBatches();
    
    // Clear all data
    this.batches.clear();
    this.timers.clear();
    this.processors.clear();
  }
}
