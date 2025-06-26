/**
 * Background Processor Module
 * Handles background tasks and scheduled operations
 */

export class BackgroundProcessor {
  constructor() {
    this.tasks = new Map();
    this.intervals = new Map();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Background processor started');
  }

  stop() {
    if (!this.isRunning) return;
    
    // Clear all intervals
    for (const [name, intervalId] of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
    
    this.isRunning = false;
    console.log('Background processor stopped');
  }

  addTask(name, taskFunction, intervalMs = 60000) {
    if (this.tasks.has(name)) {
      this.removeTask(name);
    }

    this.tasks.set(name, taskFunction);
    
    const intervalId = setInterval(async () => {
      try {
        await taskFunction();
      } catch (error) {
        console.error(`Background task ${name} failed:`, error);
      }
    }, intervalMs);
    
    this.intervals.set(name, intervalId);
    console.log(`Background task ${name} scheduled every ${intervalMs}ms`);
  }

  removeTask(name) {
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name));
      this.intervals.delete(name);
    }
    
    this.tasks.delete(name);
    console.log(`Background task ${name} removed`);
  }

  async runTaskOnce(name) {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task ${name} not found`);
    }

    try {
      await task();
      console.log(`Background task ${name} executed successfully`);
    } catch (error) {
      console.error(`Background task ${name} failed:`, error);
      throw error;
    }
  }

  getTaskStatus() {
    return {
      isRunning: this.isRunning,
      taskCount: this.tasks.size,
      tasks: Array.from(this.tasks.keys())
    };
  }
}
