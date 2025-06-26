# HTA Tree Pipeline Debug Playbook

## Overview
Structured, end-to-end debugging for the HTA tree pipeline from `build_hta_tree` to `get_next_task`.

## 1. Reproduce and Capture Failing Run

### 1-A Create Test Project
```bash
# Create throwaway test project
forest:create_project {
  "project_id": "hta_debug_test",
  "goal": "HTA debug and validation testing",
  "knowledge_level": 5,
  "life_structure_preferences": {
    "schedule": "flexible",
    "focus_duration": "1 hour"
  }
}

# Confirm active
forest:list_projects
```

### 1-B Trigger Tree Build with Maximum Logging
```bash
# Start server with diagnostic flag
node forest-server/server-modular.js --diagnostic

# Build tree with full logging
forest:build_hta_tree {
  "path_name": "general",
  "learning_style": "reading/writing",
  "focus_areas": ["debugging", "validation"]
}
```

### 1-C Capture Artifacts
**Log Files to Inspect:**
- `forest-app.log` - Normal operation logs
- `forest-errors.log` - Stack traces and errors
- `forest-performance.log` - Timing and performance metrics
- `.forest-data/projects/hta_debug_test/paths/general/hta.json` - Generated HTA structure

## 2. Static Code Inspection (Serena Tools)

### 2-A Map the Call Chain

| Stage | Key Method | Serena Command |
|-------|------------|----------------|
| 1. Tree Template | `HtaTreeBuilder.buildHTATree` | `find_symbol name_path:/HtaTreeBuilder/buildHTATree depth:1` |
| 2. Task Storage | `CleanForestServer.storeGeneratedTasks` | `find_symbol storeGeneratedTasks` |
| 3. Persistence | `DataPersistence.savePathData` | `find_symbol savePathData` |
| 4. Retrieval | `CleanForestServer.loadPathHTA` | `find_symbol loadPathHTA` |
| 5. Task Selection | `TaskIntelligence.getNextTask` | `find_symbol getNextTask` |

**Check Each Function For:**
- Cache invalidation calls (`invalidateProjectCache`)
- File name typos (`hta.json` vs `HTA.json`)
- Field name drift (`frontier_nodes` vs `frontierNodes`)
- TODO/FIXME markers
- Error handling gaps

### 2-B Verify Callers & Callees
```bash
# Check dependencies for each critical function
find_referencing_symbols name_path:buildHTATree relative_path:forest-server/modules/hta-tree-builder.js
find_referencing_symbols name_path:storeGeneratedTasks relative_path:forest-server/server-modular.js
find_referencing_symbols name_path:getNextTask relative_path:forest-server/modules/task-intelligence.js
```

## 3. Dynamic Trace (Sequential-thinking)

### 3-A Enable Full Event Capture
```bash
# Start performance monitoring
forest:start_performance_timer {"label": "hta_debug_total"}

# Enable task decision tracing
forest:debug_trace_task
```

### 3-B Generate Simplified Task Loop
```bash
# Test with minimal complexity
forest:debug_auto_loop {
  "prompt": "Generate three branches with one task each",
  "max_turns": 3
}
```

### 3-C Collect Metrics
```bash
# Performance analysis
forest:get_performance_metrics

# Cache validation
forest:get_cache_status

# Memory analysis
forest:analyze_performance
```

## 4. Data Layer Validation

### 4-A Inspect Generated HTA File
```bash
# Read the generated HTA structure
read_file .forest-data/projects/hta_debug_test/paths/general/hta.json

# Validate structure:
# - frontier_nodes.length > 0
# - Unique IDs across all nodes
# - No missing title/branch fields
# - hierarchy_metadata.total_tasks equals node count
```

### 4-B Force Fresh Load Test
```bash
# Clear all caches
forest:clear_all_caches {"force": true}

# Restart server and immediately test
forest:get_next_task {"energy_level": 5, "time_available": "45 minutes"}
```

## 5. Unit Test Safety Net

### 5-A Run Existing Jest Suites
```bash
npm test -- hta-tree-builder*
npm test -- task-intelligence*
npm test -- data-persistence*
```

### 5-B Add Focused Regression Test
Create test in `forest-server/tests/hta-pipeline.test.js`:
```javascript
describe('HTA Pipeline Integration', () => {
  test('complete pipeline: build -> store -> retrieve -> select', async () => {
    // Test implementation
  });
});
```

## 6. Common Failure Signatures & Quick Fixes

### "requires_branch_generation always true"
**Cause:** Generation loop failed
**Fix:** Check `_parseTasksFromLLMResponse` for malformed JSON parsing

### "frontier_nodes empty after skeleton fallback"
**Cause:** Field name mismatch between generation and storage
**Fix:** Verify `generateSkeletonBranches` and `storeGeneratedTasks` use same schema

### "getNextTask returns generic titles"
**Cause:** `shouldRejectResponse` filtering issues
**Fix:** Inspect rejection heuristics in task quality verification

### "Linter flood of 'implicit any'"
**Cause:** Missing TypeScript definitions
**Fix:** Add `@typedef` interfaces or convert to `.ts`

### "Cache corruption after restart"
**Cause:** Stale cache entries with invalid data
**Fix:** Use `clear_all_caches` with `force: true`

## 7. Clean-up & Confirmation

### 7-A Final Cleanup
```bash
# Clear all caches and logs
forest:clear_all_caches {"clear_logs": true, "force": true}

# Restart language server if using Serena
restart_language_server
```

### 7-B Validation Run
```bash
# Start fresh diagnostic build
node forest-server/server-modular.js --diagnostic

# Test complete pipeline
forest:build_hta_tree {"path_name": "general", "learning_style": "mixed"}
forest:get_hta_status
forest:get_next_task {"energy_level": 5, "time_available": "30 minutes"}
```

## Debug Tools Reference

### Forest MCP Debug Tools
- `debug_task_sequence` - Analyze task dependencies
- `repair_sequence` - Fix broken task chains
- `sync_forest_memory` - Backup/restore system state
- `clear_all_caches` - Complete cache reset
- `get_cache_status` - Cache health monitoring

### Serena Analysis Tools
- `find_symbol` - Locate functions and classes
- `find_referencing_symbols` - Track dependencies
- `read_file` - Inspect source code
- `search_for_pattern` - Find specific patterns

### Performance Monitoring
- `get_performance_metrics` - System performance data
- `analyze_performance` - Pattern analysis
- `start_performance_timer` - Begin timing operations

## Success Criteria

**Pipeline is healthy when:**
1. `build_hta_tree` completes without errors
2. Generated `hta.json` contains valid structure
3. `get_next_task` returns specific, actionable tasks
4. Task progression works (complete -> next task available)
5. Cache clearing and restart doesn't break functionality

**Red flags:**
- Generic task titles ("Learn more about X")
- Empty frontier_nodes after generation
- Cache misses on every request
- Recursive generation loops
- Missing or corrupted HTA files
