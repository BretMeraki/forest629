/**
 * Finance Bridge Module
 * 
 * Bridges the gap between Forest MCP server and VoxLink Finance Tools MCP server
 * Provides financial analysis capabilities within Forest projects
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class FinanceBridge {
  constructor(dataPersistence, projectManagement) {
    this.dataPersistence = dataPersistence;
    this.projectManagement = projectManagement;
    this.financeClient = null;
    this.financeTransport = null;
    this.isConnected = false;
  }

  /**
   * Connect to the Finance Tools MCP server
   */
  async connect() {
    if (this.isConnected) return;

    try {
      // Use uvx to run the finance-tools-mcp server
      this.financeTransport = new StdioClientTransport({
        command: 'uvx',
        args: ['finance-tools-mcp']
      });

      this.financeClient = new Client(
        { name: 'forest-finance-bridge', version: '1.0.0' },
        { capabilities: {} }
      );

      await this.financeClient.connect(this.financeTransport);
      this.isConnected = true;
      console.log('✅ Connected to Finance Tools MCP Server');
    } catch (error) {
      console.warn('⚠️ Could not connect to Finance Tools MCP Server:', error.message);
      console.warn('Make sure uvx and finance-tools-mcp are installed');
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from the Finance Tools MCP server
   */
  async disconnect() {
    if (this.financeTransport) {
      await this.financeTransport.close();
      this.isConnected = false;
    }
  }

  /**
   * Get comprehensive ticker analysis
   */
  async getTickerAnalysis(ticker) {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: 'get_ticker_data',
          arguments: { ticker }
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to get ticker analysis:', error.message);
      throw error;
    }
  }

  /**
   * Get price history and technical analysis
   */
  async getPriceHistory(ticker, period = '1y') {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: 'get_price_history',
          arguments: { ticker, period }
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to get price history:', error.message);
      throw error;
    }
  }

  /**
   * Get financial statements
   */
  async getFinancialStatements(ticker, statement_type = 'income', period = 'annual') {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: 'get_financial_statements',
          arguments: { ticker, statement_type, period }
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to get financial statements:', error.message);
      throw error;
    }
  }

  /**
   * Get Fear & Greed Index
   */
  async getFearGreedIndex() {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: 'get_overall_sentiment_tool',
          arguments: {}
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to get Fear & Greed Index:', error.message);
      throw error;
    }
  }

  /**
   * Get market news
   */
  async getMarketNews(ticker = null) {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const toolName = ticker ? 'get_ticker_news_tool' : 'cnbc_news_feed';
      const args = ticker ? { ticker } : {};

      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to get market news:', error.message);
      throw error;
    }
  }

  /**
   * Perform financial calculations
   */
  async calculate(expression) {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: 'calculate',
          arguments: { expression }
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to perform calculation:', error.message);
      throw error;
    }
  }

  /**
   * Get options data
   */
  async getOptionsData(ticker, option_type = 'both', days_ahead = 30) {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: 'super_option_tool',
          arguments: { ticker, option_type, days_ahead }
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to get options data:', error.message);
      throw error;
    }
  }

  /**
   * Get FRED economic data
   */
  async getFredData(series_id, limit = 100) {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: 'get_fred_series',
          arguments: { series_id, limit }
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to get FRED data:', error.message);
      throw error;
    }
  }

  /**
   * Search FRED series
   */
  async searchFredSeries(search_text) {
    await this.connect();
    
    if (!this.isConnected) {
      throw new Error('Finance Tools MCP server not available');
    }

    try {
      const response = await this.financeClient.request({
        method: 'tools/call',
        params: {
          name: 'search_fred_series',
          arguments: { search_text }
        }
      }, {});

      return response.content || response.result;
    } catch (error) {
      console.error('❌ Failed to search FRED series:', error.message);
      throw error;
    }
  }
}
