/**
 * Simple LLM Client for Dreamcatcher
 * 
 * Objective: Provide a unified interface to call OpenAI and Anthropic models
 * without heavy dependencies.
 */

import https from 'https';

export interface LLMResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class LLMClient {
  private openaiKey: string;
  private anthropicKey: string;
  private geminiKey: string;

  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY || '';
    this.anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    this.geminiKey = process.env.GEMINI_API_KEY || '';
    
    if (!this.openaiKey) console.warn('⚠️ [LLM] OPENAI_API_KEY not found. Builders will be powerless.');
    if (!this.anthropicKey) console.warn('⚠️ [LLM] ANTHROPIC_API_KEY not found. Architects will be blind.');
    if (!this.geminiKey) console.warn('⚠️ [LLM] GEMINI_API_KEY not found. Critics will be silent.');
  }

  async callOpenAI(model: string, system: string, user: string): Promise<LLMResponse> {
    // ... (existing OpenAI logic)
    const data = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    });
    return this.postRequest('api.openai.com', '/v1/chat/completions', this.openaiKey, data, 'openai');
  }

  async callAnthropic(model: string, system: string, user: string): Promise<LLMResponse> {
    // ... (existing Anthropic logic)
    const data = JSON.stringify({
      model,
      system,
      messages: [{ role: 'user', content: user }],
      max_tokens: 4096
    });
    return this.postRequest('api.anthropic.com', '/v1/messages', this.anthropicKey, data, 'anthropic');
  }

  async callGemini(model: string, system: string, user: string): Promise<LLMResponse> {
    const data = JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: `SYSTEM: ${system}\n\nUSER: ${user}` }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192
      }
    });

    // Gemini uses query param for key, not header
    return this.postRequest('generativelanguage.googleapis.com', `/v1beta/models/${model}:generateContent?key=${this.geminiKey}`, '', data, 'gemini');
  }

  private postRequest(hostname: string, path: string, key: string, data: string, provider: 'openai' | 'anthropic' | 'gemini'): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data).toString()
      };

      if (provider === 'openai') {
        headers['Authorization'] = `Bearer ${key}`;
      } else if (provider === 'anthropic') {
        headers['x-api-key'] = key;
        headers['anthropic-version'] = '2023-06-01';
      }
      // Gemini uses query param, so no auth header needed

      const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`[${provider}] API Error ${res.statusCode}: ${body}`));
            return;
          }
          
          try {
            const json = JSON.parse(body);
            let content = '';
            
            if (provider === 'openai') {
              content = json.choices[0].message.content;
            } else if (provider === 'anthropic') {
              content = json.content[0].text;
            } else if (provider === 'gemini') {
              content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
            
            resolve({ content });
          } catch (e) {
            reject(new Error(`[${provider}] Failed to parse response: ${e}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}
