# Forest MCP Server

A domain-agnostic life orchestration system built as a Model Context Protocol (MCP) server. Forest provides intelligent task management, scheduling, and progress tracking through a modular, well-documented architecture.

## 🛡️ **NEW: Forest Defense System**

This repository includes the **complete Forest Defense System** - an integrated health monitoring and self-healing system that protects the Forest MCP server:

- **🔍 Real-time Health Monitoring**: Tracks all function calls and component health automatically
- **⚠️ Contradiction Detection**: Validates component health claims vs. actual status in real-time
- **🔧 Automatic Self-Healing**: Triggers recovery procedures when issues are detected
- **💾 Memory Integration**: Persistent health data storage and analysis
- **🔗 Event-Driven Architecture**: Components communicate through events for coordinated response
- **📊 MCP Tool Integration**: Defense tools accessible via MCP interface for user interaction

### Defense System Components
- **`modules/context-guard.js`** - Health validation and contradiction detection engine
- **`modules/self-heal-manager.js`** - Automatic self-healing and recovery system
- **`modules/utils/component-health-reporter.js`** - Health monitoring and data collection
- **`test-defense-*.js`** - Comprehensive test suite for defense system validation

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