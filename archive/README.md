# Archive Directory

This directory contains modules and code that have been replaced during the MCP refactoring process.

## Structure

### `monolithic-modules/`
Contains large, monolithic modules that have been broken down into focused MCP servers.

### `replaced-by-focused-servers/`
Contains modules that have been replaced by dedicated, focused MCP servers.

### `deprecated-logic/`
Contains logic that is no longer needed due to architectural changes.

## Archival Process

When archiving modules:
1. Move the entire module file to the appropriate subdirectory
2. Create a `REPLACED_BY.md` file explaining what replaced it
3. Update any import references to point to new implementations
4. Keep archived files for reference but don't import them

## Current Archived Modules

- `hta-tree-builder.js` → Replaced by `hta-analysis-server.js` (focused HTA Analysis MCP server)

## Restoration

If you need to restore any archived module:
1. Check the `REPLACED_BY.md` file to understand what replaced it
2. Consider if the focused server approach is better
3. Only restore if absolutely necessary for compatibility
