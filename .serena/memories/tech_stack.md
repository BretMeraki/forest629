# Tech Stack

## Core Technologies
- **Node.js**: JavaScript runtime
- **ES Modules**: Modern JavaScript module system
- **MCP SDK**: Model Context Protocol SDK (@modelcontextprotocol/sdk)

## Key Dependencies
- **Winston**: Logging framework
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Express**: HTTP server (optional)

## Architecture Pattern
- **MCP Servers**: Local stdio-based servers for Claude Desktop
- **Modular Design**: Focused single-responsibility modules
- **Event-driven**: Uses event bus for component communication

## File Structure
- `forest-server/modules/`: Core business logic modules
- `forest-server/servers/`: MCP server implementations
- `archive/`: Archived/deprecated modules
- `__tests__/`: Jest test files