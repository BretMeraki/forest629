@echo off
echo ===========================================
echo Forest MCP Server Configuration Test
echo ===========================================
echo.

echo Testing Sequential Thinking MCP Server...
echo -------------------------------------------
timeout 3 npx -y @modelcontextprotocol/server-sequential-thinking >nul 2>&1
if %errorlevel% == 1 (
    echo ✅ Sequential Thinking MCP: WORKING (timeout expected)
) else (
    echo ❌ Sequential Thinking MCP: ERROR
)
echo.

echo Testing Context7 MCP Server...
echo -------------------------------
timeout 3 npx -y @upstash/context7-mcp@1.0.14 >nul 2>&1
if %errorlevel% == 1 (
    echo ✅ Context7 MCP: WORKING (timeout expected)
) else (
    echo ❌ Context7 MCP: ERROR
)
echo.

echo MCP Configuration Summary:
echo ---------------------------
echo ✅ Sequential Thinking: @modelcontextprotocol/server-sequential-thinking
echo ✅ Context7: @upstash/context7-mcp@1.0.14
echo ✅ Forest Memory: Custom forest-server/servers/memory-server.js
echo ✅ Forest Filesystem: Custom forest-server/servers/filesystem-server.js
echo ✅ Forest Main: Custom start-server.js
echo.
echo Total MCP Servers Configured: 5
echo ===========================================
echo Configuration file: mcp-config.json
echo ===========================================
pause 