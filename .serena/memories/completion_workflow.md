# Task Completion Workflow

## When a task is completed:

1. **Run Tests**: `npm test` to ensure all functionality works
2. **Lint Code**: `npm run lint` to check code style
3. **Format Code**: `npm run format` (if available)
4. **Test Core Loop**: `node test-working-core-loop.js` to validate evolution
5. **Start Servers**: Test with actual MCP servers running
6. **Validate Integration**: Ensure HTA Bridge connects properly

## Testing Commands:
- `node test-core-loop.js` - Test basic core loop
- `node test-working-core-loop.js` - Test A → B → C evolution
- `node hta-analysis-server.js` - Start HTA server for testing
- `npm test` - Run full Jest test suite

## Validation Steps:
1. Verify task generation works
2. Verify evolution based on feedback
3. Verify breakthrough detection
4. Verify HTA integration
5. Verify completion tracking