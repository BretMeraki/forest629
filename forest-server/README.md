# Forest MCP Server

A domain-agnostic life orchestration system built as a Model Context Protocol (MCP) server. Forest provides intelligent task management, scheduling, and progress tracking through a modular, well-documented architecture.

## 🌟 Features

- **Domain Agnostic**: Works for any learning goal or project type
- **Intelligent Task Selection**: AI-powered task prioritization based on energy, time, and context
- **Hierarchical Task Analysis (HTA)**: Structured approach to breaking down complex goals
- **Smart Scheduling**: Adaptive daily schedule generation
- **Progress Tracking**: Comprehensive completion analysis and learning insights
- **Truthful Filtering**: Built-in system for honest, non-sycophantic responses

## 📁 Project Structure

### Core Modules

- **`models/`** - Data models with full JSDoc documentation
  - `hta-node.js` - HTA node representation with validation and utilities
  - `schedule-block.js` - Time block management with formatting helpers
  - `project.js` - Project configuration and metadata management
  - `index.js` - Model utilities and type conversion helpers

- **`modules/`** - Business logic modules
  - `task-logic/` - Refactored task management (Scorer, Selector, Formatter)
  - `utils/` - Utility modules (FileSystem, CacheManager)
  - `data-persistence.js` - Coordinated data management with caching
  - `task-intelligence.js` - AI-powered task intelligence orchestration
  - `tool-router.js` - MCP tool routing with truthful filtering

- **`servers/`** - MCP server implementations
  - `filesystem-server.js` - File system operations
  - `memory-server.js` - Memory management
  - `sequential-thinking-server.js` - Structured thinking support

## 🔧 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/BretMeraki/618forest.git
   cd 618forest
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Start the server**
   ```bash
   node server-modular.js
   ```

## 🚀 Quick Start (5 Minutes)

1. **Start the server**
   ```bash
   node server-modular.js
   ```
2. **Create your first project**
   ```bash
   # Minimal example – fill in goal and schedule preferences
   create_project {
     "project_id": "my-learning",
     "goal": "Become a full-stack developer",
     "life_structure_preferences": { "wake_time": "07:00", "sleep_time": "23:00" }
   }
   ```
3. **Generate your learning roadmap**
   ```bash
   build_hta_tree { "learning_style": "deep", "focus_areas": [] }
   ```
   Even if AI generation fails, Forest will fall back to a **skeleton** roadmap so you always have tasks to start with.
4. **Get your first task**
   ```bash
   get_next_task {}
   ```
5. **Complete tasks and iterate**
   ```bash
   complete_task { "id": "node_1", "feedback": "Done" }
   ```

> **Troubleshooting**
> • If you see "No active project" errors, run `switch_project` or `create_project` first.
> • Skeleton roadmaps are fully functional – they just use a generic structure instead of AI-crafted tasks.

---

## 📖 Documentation

### JSDoc Documentation

This project features **comprehensive JSDoc documentation** across all modules:

#### ✅ Fully Documented Modules

- **Task Logic System** (`modules/task-logic/`)
  - `TaskScorer` - 8 methods for intelligent task scoring
  - `TaskSelector` - 2 methods for optimal task selection  
  - `TaskFormatter` - 3 methods for user-friendly response formatting

- **Data Models** (`models/`)
  - `HtaNode` - 15 methods including validation, state management, and utilities
  - `ScheduleBlock` - 17 methods for time block management and formatting
  - `Project` - 21 methods for project configuration and analysis
  - `ModelUtils` - 8 utility methods for data conversion

- **Utility Modules** (`modules/utils/`)
  - `FileSystem` - 15+ methods for all file operations
  - `CacheManager` - 11 methods for intelligent caching

- **Data Persistence** (`modules/`)
  - `DataPersistence` - 16 methods coordinating cache and file operations

#### Documentation Features

- **Parameter Types**: All parameters documented with TypeScript-style types
- **Return Values**: Clear descriptions of what each method returns
- **Error Conditions**: `@throws` annotations for methods that can fail
- **Examples**: Usage patterns and relationships explained
- **Optional Parameters**: Clearly marked with default values

### Architecture Highlights

#### Phase 2: Modular Architecture ✅
- **Single Responsibility**: Each module has a focused purpose
- **Data Models**: Rich, validated models with business logic
- **Separated Concerns**: Task logic split into specialized components
- **Clean Coordination**: DataPersistence orchestrates file I/O and caching

#### Phase 3: Comprehensive Testing ✅
- **49 Unit Tests**: Fast, reliable test suite (600ms runtime)
- **Pure Logic Testing**: No brittle dependencies or file system operations
- **Business Rule Verification**: Tests serve as living documentation

## 🚀 Usage Examples

### Task Management
```javascript
import { TaskScorer, TaskSelector } from './modules/task-logic/index.js';

// Score a task based on user context
const score = TaskScorer.calculateTaskScore(task, energyLevel, timeAvailable, context, projectContext);

// Select optimal task from available options
const optimalTask = TaskSelector.selectOptimalTask(htaData, energyLevel, timeAvailable, context, projectContext);
```

### Data Models
```javascript
import { HtaNode, ScheduleBlock, Project } from './models/index.js';

// Create a new task node
const task = HtaNode.create({
  title: "Learn React Components",
  description: "Understanding props and state",
  branch: "web_development",
  difficulty: 3,
  duration: "45 minutes"
});

// Create a schedule block
const block = ScheduleBlock.create({
  title: "Morning Learning Session",
  startTime: "9:00 AM",
  duration: 60,
  type: "learning"
});
```

### Data Persistence
```javascript
import { DataPersistence } from './modules/data-persistence.js';

const persistence = new DataPersistence('./data');

// Load project data (with automatic caching)
const projectData = await persistence.loadProjectData('my-project', 'config.json');

// Save with cache invalidation
await persistence.saveProjectData('my-project', 'config.json', newData);
```

## 🧪 Testing

The project maintains a comprehensive test suite:

```bash
npm test
```

**Test Results:**
- ✅ 49 tests passing
- ⚡ 600ms execution time
- 🎯 Pure logic testing (no brittle dependencies)
- 📊 Excellent business rule coverage

## 🏗️ Development Principles

1. **Domain Agnostic**: No hardcoded domain logic
2. **Modular Design**: Single responsibility principle
3. **Comprehensive Documentation**: Every function documented with JSDoc
4. **Test-Driven**: Reliable unit test foundation
5. **Type Safety**: Clear parameter and return type documentation
6. **Performance**: Smart caching and efficient algorithms

## 🔄 MCP Integration

Forest operates as an MCP server providing tools for:

- **Project Management**: Create and configure learning projects
- **Task Intelligence**: Get optimal next tasks based on context
- **Schedule Generation**: Create adaptive daily schedules
- **Progress Tracking**: Complete tasks and capture insights
- **Strategy Evolution**: Adapt approach based on feedback

## 📝 Contributing

1. Follow JSDoc documentation standards
2. Maintain test coverage for new features
3. Ensure domain agnosticism
4. Write pure functions where possible
5. Update documentation for any API changes

## 📄 License

This project is part of the Forest MCP ecosystem for domain-agnostic life orchestration.

## 🏁 Production Readiness (v1.0)

Forest.os is now **production ready**. The core workflow has been hardened to guarantee users always receive actionable tasks – even in rare edge-cases where both AI generation and skeleton formatting encounter issues.

Key highlights:

• 160+ automated tests passing (unit + integration)  
• Defensive fallbacks ensure users never see framework-only artifacts  
• Comprehensive structured logging with daily rotation  
• Built-in health and metrics endpoints (`/health`, `/metrics`)  
• Modular architecture ready for horizontal scaling

### Quick Start for New Users (5 Minutes)
1. **Start the server**  
   ```bash
   npm run start:prod
   ```
2. **Create your first project** using the `create_project` tool  
3. **Build your learning roadmap** with `build_hta_tree` – AI or skeleton fallback both generate tasks  
4. **Get started** with `get_next_task`  
5. **Monitor progress** via `current_status`

👉 *If you encounter a "No active project" message, simply run `switch_project` or create a new project first.*

### Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| *Framework-only artifact* | Pre-v1.0 bug | Upgrade to v1.0 – defensive fallback now enabled |
| *No active project* | Forgot to create/switch project | Run `list_projects` ➜ `switch_project` or `create_project` |
| *LLM parsing failed* | Malformed response | Skeleton fallback auto-engages; monitor logs for details |
| *Performance dip* | High concurrent LLM calls | Tune `FOREST_MAX_CONCURRENT_LLMS` env variable |

--- 