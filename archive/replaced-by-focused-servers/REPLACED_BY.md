# Replaced Modules

## `hta-tree-builder.js`

**Original Location:** `forest-server/modules/hta-tree-builder.js`
**Replaced By:** `hta-analysis-server.js` (focused HTA Analysis MCP server)
**Date Archived:** 2025-01-27
**Reason:** Monolithic module doing too much - broke into focused MCP server

### What the original module did:
- HTA tree construction 
- Strategic task generation (MOVED to Task Generation Server)
- Goal complexity analysis
- Depth calculation
- Question tree generation
- Task sequencing (MOVED to Task Generation Server)

### What the replacement does:
- **HTA Analysis Server** (`hta-analysis-server.js`):
  - Goal complexity analysis
  - Strategic branch generation
  - Depth calculation
  - Question tree generation
  - Dependency mapping
  - **Does NOT generate tasks** (that's for Task Generation Server)

### Migration Notes:
- All HTA analysis logic moved to focused server
- Task generation logic will be moved to separate Task Generation Server
- Import references need to be updated to use MCP client calls instead of direct imports
- The new server is testable in isolation and follows MCP best practices

### How to use the replacement:
```javascript
// Old way (monolithic):
const htaBuilder = new HtaTreeBuilder(dataPersistence, projectManagement, llm);
const hta = await htaBuilder.generateHTAFramework(config, pathName, learningStyle, focusAreas);

// New way (focused MCP server):
const htaClient = new McpClient(htaAnalysisServerTransport);
const hta = await htaClient.request({
  method: 'tools/call',
  params: {
    name: 'create_hta_structure',
    arguments: {
      goal: config.goal,
      focus_areas: focusAreas,
      knowledge_level: config.knowledge_level,
      learning_style: learningStyle
    }
  }
});
```
