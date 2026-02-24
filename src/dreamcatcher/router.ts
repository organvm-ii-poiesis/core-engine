/**
 * Dreamcatcher Model Router
 * 
 * Objective: Assign tasks to the optimal AI model based on the
 * "Token Arbitrage" strategy defined in the spec.
 */

import { LLMClient } from './llm-client.js';

export type AgentRole = 'ARCHITECT' | 'BUILDER' | 'CRITIC';

export interface ModelProvider {
  name: string;
  contextWindow: number;
  costTier: 'low' | 'medium' | 'high';
}

const PROVIDERS: Record<AgentRole, ModelProvider> = {
  ARCHITECT: {
    name: 'claude-3-5-sonnet-20240620',
    contextWindow: 200000,
    costTier: 'medium'
  },
  BUILDER: {
    name: 'gpt-4o',
    contextWindow: 128000,
    costTier: 'medium'
  },
  CRITIC: {
    name: 'gemini-1.5-pro-latest',
    contextWindow: 1000000,
    costTier: 'medium'
  }
};

export class ModelRouter {
  private client: LLMClient;

  constructor() {
    this.client = new LLMClient();
  }

  getProviderFor(role: AgentRole): ModelProvider {
    return PROVIDERS[role];
  }

  async callProvider(role: AgentRole, prompt: string, context: string): Promise<string> {
    const provider = this.getProviderFor(role);
    console.log(`🤖 [Router] Routing to ${role} (${provider.name})...`);
    
    try {
      // System prompt construction
      const systemPrompt = `You are The ${role} of the Omni-Dromenon Metasystem.
      Your goal is to maintain and grow the system autonomously.
      
      CONTEXT:
      ${context}
      
      INSTRUCTIONS:
      ${this.getRoleInstructions(role)}
      `;

      if (role === 'ARCHITECT') {
        const response = await this.client.callAnthropic(provider.name, systemPrompt, prompt);
        return response.content;
      } else if (role === 'BUILDER') {
        const response = await this.client.callOpenAI(provider.name, systemPrompt, prompt);
        return response.content;
      } else {
        // The Critic (Gemini) watches the others
        const response = await this.client.callGemini(provider.name, systemPrompt, prompt);
        return response.content;
      }
    } catch (error: any) {
      console.error(`❌ [Router] Error calling ${role}:`, error.message);
      return `[ERROR] Failed to contact ${role}: ${error.message}`;
    }
  }

  private getRoleInstructions(role: AgentRole): string {
    switch(role) {
      case 'ARCHITECT':
        return "Analyze the request and produce a detailed Markdown plan (TASK_PLAN.md). Do not write code yet.";
      case 'BUILDER':
        return "Read the plan and output the specific code file content. Wrap code in ```block```.";
      default:
        return "Review the changes for safety and consistency.";
    }
  }
}

