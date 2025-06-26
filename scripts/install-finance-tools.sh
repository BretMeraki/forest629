#!/bin/bash

# Install Finance Tools for Forest MCP Server
# This script installs the VoxLink Finance Tools MCP server integration

echo "🚀 Installing Finance Tools for Forest MCP Server..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv package manager..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    
    # Add uv to PATH for current session
    export PATH="$HOME/.cargo/bin:$PATH"
    
    echo "✅ uv installed successfully"
else
    echo "✅ uv is already installed"
fi

# Install finance-tools-mcp
echo "📊 Installing finance-tools-mcp..."
uv tool install finance-tools-mcp

if [ $? -eq 0 ]; then
    echo "✅ finance-tools-mcp installed successfully"
else
    echo "❌ Failed to install finance-tools-mcp"
    echo "💡 You can try installing manually with: uvx finance-tools-mcp"
    exit 1
fi

# Test the installation
echo "🧪 Testing finance tools installation..."
timeout 10s uvx finance-tools-mcp --help > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Finance tools are working correctly"
else
    echo "⚠️  Finance tools may need additional setup"
    echo "💡 You can test manually with: uvx finance-tools-mcp"
fi

echo ""
echo "🎉 Finance Tools Installation Complete!"
echo ""
echo "📋 Available Finance Tools in Forest:"
echo "   • analyze_stock - Comprehensive stock analysis"
echo "   • get_technical_analysis - Technical indicators and charts"
echo "   • get_financial_statements - Income, balance, cash flow statements"
echo "   • get_market_sentiment - Fear & Greed Index"
echo "   • get_market_news - Latest market and company news"
echo "   • calculate_finance - Financial calculations"
echo "   • get_options_analysis - Options data and analysis"
echo "   • get_economic_data - FRED economic data"
echo "   • search_economic_data - Search economic indicators"
echo ""
echo "🔧 Optional: Set FRED API key for enhanced economic data:"
echo "   export FRED_API_KEY=your_api_key_here"
echo ""
echo "🚀 Start Forest server and try: analyze_stock with ticker 'AAPL'"
