# Suggested Commands for Forest MCP Development

## Testing Commands
- `node test-core-loop-evolution.js` - Test the core A → B → C evolution
- `node hta-analysis-server.js` - Start the HTA Analysis Server
- `npm test` - Run Jest test suite
- `node forest-server/server-modular.js` - Start main Forest server

## Development Commands
- `npm install` - Install dependencies
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Windows System Commands
- `dir` - List directory contents
- `type filename` - View file contents
- `copy source dest` - Copy files
- `del filename` - Delete files
- `cd directory` - Change directory
- `mkdir dirname` - Create directory

## Git Commands
- `git status` - Check repository status
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit changes
- `git push` - Push to remote

## MCP Server Commands
- Start HTA server: `node hta-analysis-server.js`
- Start memory server: `node forest-server/servers/memory-server.js memory.json`
- Start filesystem server: `node forest-server/servers/filesystem-server.js`