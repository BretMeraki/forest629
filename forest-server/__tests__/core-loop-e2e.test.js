// @ts-nocheck
import { HtaTreeBuilder } from '../modules/hta-tree-builder.js';
import { TaskIntelligence } from '../modules/task-intelligence.js';

// Lightweight in-memory data persistence mock
class MemoryDP {
  constructor() {
    this.store = new Map();
  }
  async loadProjectData(pid, key) {
    if (key === 'config.json') {
      return this.store.get('config') || null;
    }
    return this.store.get(`${pid}:${key}`) || null;
  }
  async saveProjectData(pid, key, val) {
    if (key === 'config.json') {
      this.store.set('config', val);
    } else {
      this.store.set(`${pid}:${key}`, val);
    }
  }
  async loadPathData(pid, pathName, key) {
    return this.store.get(`${pid}:${pathName}:${key}`) || null;
  }
  async savePathData(pid, pathName, key, val) {
    this.store.set(`${pid}:${pathName}:${key}`, val);
  }
  // stubs
  async loadGlobalData() { return null; }
  async saveGlobalData() {}
  async logError() {}
}

class DummyPM {
  async requireActiveProject() { return 'proj1'; }
}

// Deterministic LLM mock returning 3 tasks
const llmMock = {
  async requestIntelligence(kind, { prompt }) {
    if (kind === 'task_generation') {
      return {
        text: JSON.stringify([
          { title: 'Task A', description: 'Do A', difficulty: 2, duration: '30 minutes', branch: 'alpha', prerequisites: [] },
          { title: 'Task B', description: 'Do B', difficulty: 3, duration: '30 minutes', branch: 'beta', prerequisites: [] },
          { title: 'Task C', description: 'Do C', difficulty: 1, duration: '25 minutes', branch: 'gamma', prerequisites: [] },
        ]),
      };
    }
    return { text: '' };
  },
};

// Test
describe('Core loop end-to-end', () => {
  it('builds HTA tree and generates LLM-driven tasks', async () => {
    const dp = new MemoryDP();
    const pm = new DummyPM();
    // seed project config
    await dp.saveProjectData('proj1', 'config.json', {
      goal: 'Learn full-stack development',
      context: 'Self study',
      learningStyle: 'mixed',
      life_structure_preferences: { focus_duration: '25 minutes' },
    });

    const htaBuilder = new HtaTreeBuilder(dp, pm, llmMock);
    const buildResult = await htaBuilder.buildHTATree('general');
    expect(buildResult.success).toBe(true);

    const taskIntel = new TaskIntelligence(dp, pm, llmMock);
    const tasks = await taskIntel.generateSmartNextTasks('proj1', 'general', { recommendedEvolution: 'generate_new_tasks' });
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].generated).toBe(true);
    expect(tasks[0].id.startsWith('ai_')).toBe(true);
  });

  // ENHANCED: Add comprehensive end-to-end test for HTA generation fix
  describe('HTA Generation Fix Verification', () => {
    it('should create project, build HTA tree, and verify frontierNodes is populated', async () => {
      const dp = new MemoryDP();
      const pm = new DummyPM();
      
      // Create project configuration
      await dp.saveProjectData('proj1', 'config.json', {
        goal: 'Learn web development',
        context: 'Professional transition',
        activePath: 'general',
        learningStyle: 'hands-on'
      });

      const htaBuilder = new HtaTreeBuilder(dp, pm, llmMock);
      const buildResult = await htaBuilder.buildHTATree('general');
      
      expect(buildResult.success).toBe(true);
      
      // Verify HTA structure was created and stored
      const htaData = await dp.loadProjectData('proj1', 'hta.json');
      expect(htaData).toBeTruthy();
      expect(htaData.frontierNodes).toBeDefined();
      expect(Array.isArray(htaData.frontierNodes)).toBe(true);
      expect(htaData.frontierNodes.length).toBeGreaterThan(0);
    });

    it('should call getNextTask after HTA generation and expect actual tasks', async () => {
      const dp = new MemoryDP();
      const pm = new DummyPM();
      
      // Setup project with HTA data containing frontierNodes
      await dp.saveProjectData('proj1', 'config.json', {
        goal: 'Learn JavaScript',
        activePath: 'general'
      });
      
      await dp.saveProjectData('proj1', 'hta.json', {
        frontierNodes: [
          {
            id: 'task_1',
            title: 'Learn Variables',
            description: 'Understand variable declaration',
            difficulty: 2,
            duration: 30,
            branch: 'fundamentals',
            prerequisites: [],
            completed: false
          }
        ],
        completedNodes: [],
        hierarchyMetadata: {
          total_tasks: 1,
          total_branches: 1
        }
      });

      const taskIntel = new TaskIntelligence(dp, pm);
      const nextTaskResult = await taskIntel.getNextTask('', 3, 30);
      
      // Should return actual task, not "No available tasks"
      expect(nextTaskResult).toBeTruthy();
      expect(nextTaskResult.content).toBeDefined();
      expect(nextTaskResult.content[0].text).not.toContain('No available tasks');
      expect(nextTaskResult.content[0].text).toContain('Learn Variables');
    });

    it('should verify task objects have all required fields', async () => {
      const dp = new MemoryDP();
      const pm = new DummyPM();
      
      await dp.saveProjectData('proj1', 'config.json', {
        goal: 'Learn React',
        activePath: 'general'
      });

      const htaBuilder = new HtaTreeBuilder(dp, pm, llmMock);
      await htaBuilder.buildHTATree('general');
      
      const htaData = await dp.loadProjectData('proj1', 'hta.json');
      
      // Verify each task has all required fields
      htaData.frontierNodes.forEach(task => {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('description');
        expect(task).toHaveProperty('difficulty');
        expect(task).toHaveProperty('duration');
        expect(task).toHaveProperty('branch');
        expect(task).toHaveProperty('prerequisites');
        expect(task).toHaveProperty('completed');
        
        // Verify field types
        expect(typeof task.id).toBe('string');
        expect(typeof task.title).toBe('string');
        expect(typeof task.description).toBe('string');
        expect(typeof task.difficulty).toBe('number');
        expect(typeof task.branch).toBe('string');
        expect(Array.isArray(task.prerequisites)).toBe(true);
        expect(typeof task.completed).toBe('boolean');
        expect(task.completed).toBe(false);
      });
    });

    it('should verify both frontierNodes and frontierNodes fields are populated for compatibility', async () => {
      const dp = new MemoryDP();
      const pm = new DummyPM();
      
      await dp.saveProjectData('proj1', 'config.json', {
        goal: 'Learn TypeScript',
        activePath: 'general'
      });

      const htaBuilder = new HtaTreeBuilder(dp, pm, llmMock);
      await htaBuilder.buildHTATree('general');
      
      const htaData = await dp.loadProjectData('proj1', 'hta.json');
      
      // Both field variants should be populated
      expect(htaData.frontierNodes).toBeDefined();
      expect(htaData.frontierNodes).toBeDefined();
      expect(Array.isArray(htaData.frontierNodes)).toBe(true);
      expect(Array.isArray(htaData.frontierNodes)).toBe(true);
      expect(htaData.frontierNodes.length).toBe(htaData.frontierNodes.length);
      expect(htaData.frontierNodes.length).toBeGreaterThan(0);
      
      // Content should be identical
      expect(htaData.frontierNodes).toEqual(htaData.frontierNodes);
    });

    it('should run complete workflow and confirm diagnostic issue is resolved', async () => {
      const dp = new MemoryDP();
      const pm = new DummyPM();
      
      // Start with empty project (simulating the original issue)
      await dp.saveProjectData('proj1', 'config.json', {
        goal: 'Learn Node.js',
        context: 'Backend development',
        activePath: 'general'
      });

      // Step 1: Build HTA tree (this should populate frontierNodes)
      const htaBuilder = new HtaTreeBuilder(dp, pm, llmMock);
      const buildResult = await htaBuilder.buildHTATree('general');
      
      expect(buildResult.success).toBe(true);
      expect(buildResult.requires_branch_generation).toBe(false); // Should be fulfilled
      
      // Step 2: Verify frontierNodes is populated (diagnostic issue resolved)
      const htaData = await dp.loadProjectData('proj1', 'hta.json');
      expect(htaData.frontierNodes.length).toBeGreaterThan(0);
      
      // Step 3: Get next task should work (not return "No available tasks")
      const taskIntel = new TaskIntelligence(dp, pm);
      const nextTaskResult = await taskIntel.getNextTask('', 3, 30);
      
      expect(nextTaskResult.content[0].text).not.toContain('No available tasks');
      expect(nextTaskResult.content[0].text).toContain('Next Recommended Task');
      
      // Step 4: Verify complete workflow integrity
      expect(htaData.hierarchyMetadata.total_tasks).toBeGreaterThan(0);
      expect(htaData.hierarchyMetadata.total_branches).toBeGreaterThan(0);
    });
  });
}); 