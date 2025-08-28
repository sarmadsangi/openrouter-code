import axios from 'axios';
import { BaseTool } from './base-tool';
import { ToolResult } from '../types';

export class WebSearchTool extends BaseTool {
  name = 'WebSearch';
  description = 'Search the web for information';

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      this.validateParameters(parameters, ['query']);
      
      const query = parameters.query;
      const maxResults = parameters.maxResults || 5;
      
      // Using DuckDuckGo Instant Answer API (free, no API key required)
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'OpenRouterCode/1.0'
        }
      });
      
      const data = response.data;
      let results = [];
      
      // Extract instant answer
      if (data.AbstractText) {
        results.push(`Summary: ${data.AbstractText}`);
        if (data.AbstractURL) {
          results.push(`Source: ${data.AbstractURL}`);
        }
      }
      
      // Extract related topics
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        results.push('\nRelated Topics:');
        data.RelatedTopics.slice(0, maxResults).forEach((topic: any, index: number) => {
          if (topic.Text) {
            results.push(`${index + 1}. ${topic.Text}`);
            if (topic.FirstURL) {
              results.push(`   URL: ${topic.FirstURL}`);
            }
          }
        });
      }
      
      // Extract definition if available
      if (data.Definition) {
        results.push(`\nDefinition: ${data.Definition}`);
        if (data.DefinitionURL) {
          results.push(`Source: ${data.DefinitionURL}`);
        }
      }
      
      if (results.length === 0) {
        return this.createResult(true, `No detailed results found for "${query}". You might want to try a more specific search term.`);
      }
      
      return this.createResult(true, results.join('\n'));
    } catch (error: any) {
      return this.createResult(false, '', `Web search failed: ${error.message}`);
    }
  }
}