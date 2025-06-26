/**
 * Finance Tools for Forest MCP Server
 * 
 * Provides financial analysis capabilities through integration with VoxLink Finance Tools
 */

import { FinanceBridge } from '../modules/finance-bridge.js';

export class FinanceTools {
  constructor(dataPersistence, projectManagement) {
    this.financeBridge = new FinanceBridge(dataPersistence, projectManagement);
  }

  /**
   * Analyze a stock ticker with comprehensive financial data
   */
  async analyzeStock(args) {
    const { ticker } = args;
    
    if (!ticker) {
      throw new Error('Ticker symbol is required');
    }

    try {
      const analysis = await this.financeBridge.getTickerAnalysis(ticker.toUpperCase());
      
      return {
        content: [{
          type: 'text',
          text: `# 📊 Stock Analysis: ${ticker.toUpperCase()}\n\n${this.formatAnalysisResponse(analysis)}`
        }],
        ticker_analysis: analysis
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to analyze ${ticker}: ${error.message}\n\n💡 Make sure the ticker symbol is valid and the finance server is running.`
        }],
        error: error.message
      };
    }
  }

  /**
   * Get technical analysis and price history
   */
  async getTechnicalAnalysis(args) {
    const { ticker, period = '1y' } = args;
    
    if (!ticker) {
      throw new Error('Ticker symbol is required');
    }

    try {
      const priceHistory = await this.financeBridge.getPriceHistory(ticker.toUpperCase(), period);
      
      return {
        content: [{
          type: 'text',
          text: `# 📈 Technical Analysis: ${ticker.toUpperCase()}\n\n**Period:** ${period}\n\n${this.formatAnalysisResponse(priceHistory)}`
        }],
        technical_analysis: priceHistory
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get technical analysis for ${ticker}: ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Get financial statements
   */
  async getFinancials(args) {
    const { ticker, statement_type = 'income', period = 'annual' } = args;
    
    if (!ticker) {
      throw new Error('Ticker symbol is required');
    }

    try {
      const financials = await this.financeBridge.getFinancialStatements(
        ticker.toUpperCase(), 
        statement_type, 
        period
      );
      
      return {
        content: [{
          type: 'text',
          text: `# 💰 Financial Statements: ${ticker.toUpperCase()}\n\n**Type:** ${statement_type}\n**Period:** ${period}\n\n${this.formatAnalysisResponse(financials)}`
        }],
        financial_statements: financials
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get financials for ${ticker}: ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Get market sentiment via Fear & Greed Index
   */
  async getMarketSentiment(args) {
    try {
      const sentiment = await this.financeBridge.getFearGreedIndex();
      
      return {
        content: [{
          type: 'text',
          text: `# 😨😍 Market Sentiment (Fear & Greed Index)\n\n${this.formatAnalysisResponse(sentiment)}`
        }],
        market_sentiment: sentiment
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get market sentiment: ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Get market news
   */
  async getMarketNews(args) {
    const { ticker } = args;
    
    try {
      const news = await this.financeBridge.getMarketNews(ticker?.toUpperCase());
      
      const title = ticker ? `📰 News for ${ticker.toUpperCase()}` : '📰 Market News';
      
      return {
        content: [{
          type: 'text',
          text: `# ${title}\n\n${this.formatAnalysisResponse(news)}`
        }],
        market_news: news
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get market news: ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Perform financial calculations
   */
  async calculateFinance(args) {
    const { expression } = args;
    
    if (!expression) {
      throw new Error('Mathematical expression is required');
    }

    try {
      const result = await this.financeBridge.calculate(expression);
      
      return {
        content: [{
          type: 'text',
          text: `# 🧮 Financial Calculation\n\n**Expression:** \`${expression}\`\n\n**Result:** ${this.formatAnalysisResponse(result)}`
        }],
        calculation_result: result
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to calculate "${expression}": ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Get options data
   */
  async getOptionsAnalysis(args) {
    const { ticker, option_type = 'both', days_ahead = 30 } = args;
    
    if (!ticker) {
      throw new Error('Ticker symbol is required');
    }

    try {
      const options = await this.financeBridge.getOptionsData(
        ticker.toUpperCase(), 
        option_type, 
        days_ahead
      );
      
      return {
        content: [{
          type: 'text',
          text: `# 📋 Options Analysis: ${ticker.toUpperCase()}\n\n**Type:** ${option_type}\n**Days Ahead:** ${days_ahead}\n\n${this.formatAnalysisResponse(options)}`
        }],
        options_analysis: options
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get options data for ${ticker}: ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Get economic data from FRED
   */
  async getEconomicData(args) {
    const { series_id, limit = 100 } = args;
    
    if (!series_id) {
      throw new Error('FRED series ID is required');
    }

    try {
      const data = await this.financeBridge.getFredData(series_id, limit);
      
      return {
        content: [{
          type: 'text',
          text: `# 📊 Economic Data: ${series_id}\n\n${this.formatAnalysisResponse(data)}`
        }],
        economic_data: data
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get economic data for ${series_id}: ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Search FRED economic series
   */
  async searchEconomicData(args) {
    const { search_text } = args;
    
    if (!search_text) {
      throw new Error('Search text is required');
    }

    try {
      const results = await this.financeBridge.searchFredSeries(search_text);
      
      return {
        content: [{
          type: 'text',
          text: `# 🔍 Economic Data Search: "${search_text}"\n\n${this.formatAnalysisResponse(results)}`
        }],
        search_results: results
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to search economic data for "${search_text}": ${error.message}`
        }],
        error: error.message
      };
    }
  }

  /**
   * Format analysis response for display
   */
  formatAnalysisResponse(response) {
    if (typeof response === 'string') {
      return response;
    }
    
    if (Array.isArray(response)) {
      return response.map(item => 
        typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)
      ).join('\n\n');
    }
    
    if (typeof response === 'object' && response !== null) {
      return JSON.stringify(response, null, 2);
    }
    
    return String(response);
  }
}
