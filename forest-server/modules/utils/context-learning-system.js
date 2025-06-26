/**
 * Context Learning System Module
 * Learns from user interactions and adapts system behavior
 */

export class ContextLearningSystem {
  constructor() {
    this.learningData = {
      userPreferences: {},
      behaviorPatterns: [],
      adaptations: [],
      contextHistory: []
    };
    
    this.maxHistorySize = 1000;
    this.learningEnabled = true;
  }

  recordUserInteraction(interaction) {
    if (!this.learningEnabled) return;
    
    const contextEntry = {
      timestamp: Date.now(),
      type: interaction.type,
      data: interaction.data,
      outcome: interaction.outcome,
      userSatisfaction: interaction.userSatisfaction || null
    };
    
    this.learningData.contextHistory.push(contextEntry);
    
    // Keep only recent history
    if (this.learningData.contextHistory.length > this.maxHistorySize) {
      this.learningData.contextHistory = this.learningData.contextHistory.slice(-this.maxHistorySize);
    }
    
    this.analyzePatterns();
  }

  analyzePatterns() {
    const recentInteractions = this.learningData.contextHistory.slice(-100);
    
    // Analyze time patterns
    this.analyzeTimePatterns(recentInteractions);
    
    // Analyze task preferences
    this.analyzeTaskPreferences(recentInteractions);
    
    // Analyze success patterns
    this.analyzeSuccessPatterns(recentInteractions);
  }

  analyzeTimePatterns(interactions) {
    const timePatterns = {};
    
    interactions.forEach(interaction => {
      const hour = new Date(interaction.timestamp).getHours();
      const timeSlot = this.getTimeSlot(hour);
      
      if (!timePatterns[timeSlot]) {
        timePatterns[timeSlot] = { count: 0, successful: 0 };
      }
      
      timePatterns[timeSlot].count++;
      if (interaction.outcome === 'success') {
        timePatterns[timeSlot].successful++;
      }
    });
    
    this.learningData.userPreferences.timePatterns = timePatterns;
  }

  analyzeTaskPreferences(interactions) {
    const taskTypes = {};
    
    interactions.forEach(interaction => {
      if (interaction.type === 'task_completion') {
        const taskType = interaction.data.taskType || 'unknown';
        
        if (!taskTypes[taskType]) {
          taskTypes[taskType] = { count: 0, averageRating: 0, totalRating: 0 };
        }
        
        taskTypes[taskType].count++;
        if (interaction.userSatisfaction) {
          taskTypes[taskType].totalRating += interaction.userSatisfaction;
          taskTypes[taskType].averageRating = taskTypes[taskType].totalRating / taskTypes[taskType].count;
        }
      }
    });
    
    this.learningData.userPreferences.taskTypes = taskTypes;
  }

  analyzeSuccessPatterns(interactions) {
    const patterns = {
      highSuccessFactors: [],
      lowSuccessFactors: [],
      optimalConditions: {}
    };
    
    const successfulInteractions = interactions.filter(i => i.outcome === 'success');
    const failedInteractions = interactions.filter(i => i.outcome === 'failure');
    
    // Analyze what leads to success
    if (successfulInteractions.length > 0) {
      patterns.optimalConditions = this.extractCommonFactors(successfulInteractions);
    }
    
    this.learningData.behaviorPatterns = patterns;
  }

  extractCommonFactors(interactions) {
    const factors = {};
    
    interactions.forEach(interaction => {
      if (interaction.data) {
        Object.keys(interaction.data).forEach(key => {
          if (!factors[key]) factors[key] = {};
          
          const value = interaction.data[key];
          if (!factors[key][value]) factors[key][value] = 0;
          factors[key][value]++;
        });
      }
    });
    
    return factors;
  }

  getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  getRecommendations() {
    const recommendations = [];
    
    // Time-based recommendations
    const timePatterns = this.learningData.userPreferences.timePatterns;
    if (timePatterns) {
      const bestTimeSlot = Object.keys(timePatterns).reduce((best, slot) => {
        const successRate = timePatterns[slot].successful / timePatterns[slot].count;
        const bestSuccessRate = timePatterns[best]?.successful / timePatterns[best]?.count || 0;
        return successRate > bestSuccessRate ? slot : best;
      }, Object.keys(timePatterns)[0]);
      
      if (bestTimeSlot) {
        recommendations.push({
          type: 'timing',
          message: `You tend to be most productive during ${bestTimeSlot}`,
          confidence: this.calculateConfidence(timePatterns[bestTimeSlot])
        });
      }
    }
    
    // Task type recommendations
    const taskTypes = this.learningData.userPreferences.taskTypes;
    if (taskTypes) {
      const preferredTasks = Object.keys(taskTypes)
        .filter(type => taskTypes[type].averageRating > 3)
        .sort((a, b) => taskTypes[b].averageRating - taskTypes[a].averageRating);
      
      if (preferredTasks.length > 0) {
        recommendations.push({
          type: 'task_preference',
          message: `You seem to prefer ${preferredTasks[0]} tasks`,
          confidence: this.calculateConfidence(taskTypes[preferredTasks[0]])
        });
      }
    }
    
    return recommendations;
  }

  calculateConfidence(data) {
    if (!data || !data.count) return 0;
    
    // Confidence increases with more data points
    const sampleConfidence = Math.min(data.count / 20, 1);
    
    // Confidence increases with consistency
    const consistencyConfidence = data.successful ? (data.successful / data.count) : 0.5;
    
    return (sampleConfidence + consistencyConfidence) / 2;
  }

  adaptBehavior(adaptationType, parameters) {
    const adaptation = {
      timestamp: Date.now(),
      type: adaptationType,
      parameters,
      reason: 'learning_system_recommendation'
    };
    
    this.learningData.adaptations.push(adaptation);
    
    // Keep only recent adaptations
    if (this.learningData.adaptations.length > 100) {
      this.learningData.adaptations = this.learningData.adaptations.slice(-100);
    }
    
    return adaptation;
  }

  getLearningStatus() {
    return {
      enabled: this.learningEnabled,
      dataPoints: this.learningData.contextHistory.length,
      patterns: Object.keys(this.learningData.behaviorPatterns).length,
      adaptations: this.learningData.adaptations.length,
      lastUpdate: this.learningData.contextHistory.length > 0 ? 
        this.learningData.contextHistory[this.learningData.contextHistory.length - 1].timestamp : null
    };
  }

  exportLearningData() {
    return JSON.stringify(this.learningData, null, 2);
  }

  importLearningData(data) {
    try {
      this.learningData = JSON.parse(data);
      return true;
    } catch (error) {
      console.error('Failed to import learning data:', error);
      return false;
    }
  }
}
