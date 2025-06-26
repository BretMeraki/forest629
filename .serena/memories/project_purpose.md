# Forest MCP Project Purpose

This is a Forest MCP (Model Context Protocol) system designed for Claude Desktop integration. The system implements a hierarchical task analysis (HTA) approach for goal achievement with adaptive task generation.

## Core Concept
- **HTA Analysis**: Breaks down complex goals into strategic hierarchical structures
- **Task Intelligence**: Generates specific actionable tasks based on HTA framework
- **Evolution Loop**: Adapts future tasks based on completion feedback (A → B → C evolution)
- **Local stdio servers**: Designed specifically for Claude Desktop using local communication

## Key Components
- **TaskIntelligence**: Main orchestrator for task selection and generation
- **HTABridge**: Connects to HTA Analysis Server for strategic framework creation
- **HTA Analysis Server**: Focused server for hierarchical task analysis
- **Task Completion**: Tracks completions and triggers evolution

## Architecture
The system uses focused MCP servers instead of monolithic modules, following single responsibility principle.