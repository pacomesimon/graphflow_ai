import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Shared LLM client with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

// Helper to safely fetch and extract webpage text content for reference
async function fetchWebpageContent(url: string): Promise<{ url: string; title: string; text: string; error?: string }> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { url, title: '', text: '', error: 'Invalid URL protocol' };
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      return { url, title: parsed.hostname, text: '', error: `HTTP ${response.status} ${response.statusText}` };
    }

    const rawHtml = await response.text();

    // Extract title
    const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : parsed.hostname;

    // Strip non-content tags & extract readable text
    let cleaned = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length > 10000) {
      cleaned = cleaned.slice(0, 10000) + '... [truncated]';
    }

    return { url, title, text: cleaned };
  } catch (err: any) {
    return { url, title: '', text: '', error: err.message || 'Failed to fetch' };
  }
}

// AI Assistant Chat & Architectural Engine Route
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { messages, currentModelSpec, webReferences } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'GEMINI_API_KEY is not configured on the server. Please add it to your environment secrets.' 
      });
    }

    // Process external web reference URLs if provided by user
    let webpageContext = '';
    const referencedSources: Array<{ url: string; title: string }> = [];

    if (Array.isArray(webReferences) && webReferences.length > 0) {
      const validUrls = webReferences
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map(u => u.trim().startsWith('http') ? u.trim() : `https://${u.trim()}`);

      if (validUrls.length > 0) {
        const fetchedDocs = await Promise.all(validUrls.map(fetchWebpageContent));
        const successfulDocs = fetchedDocs.filter(d => !d.error && d.text);

        if (successfulDocs.length > 0) {
          successfulDocs.forEach(d => referencedSources.push({ url: d.url, title: d.title }));
          webpageContext = `\n\nUSER-ATTACHED REFERENCE WEBPAGES:\nThe user has attached the following external reference webpage(s) to guide your analysis:\n\n` +
            successfulDocs.map(doc => `--- SOURCE: ${doc.url} (Title: ${doc.title}) ---\n${doc.text}\n--- END SOURCE ---`).join('\n\n') +
            `\n\nINSTRUCTION: Actively analyze the attached reference webpages above. Ground your answers, tensor dimensions, architectural recommendations, and formulas on the technical content provided in these references. Cite the source title or URL when referencing specific details.`;
        } else {
          webpageContext = `\n\nUSER-ATTACHED REFERENCE URLS:\nThe user requested reference to: ${validUrls.join(', ')}. Direct web fetch was unavailable or timed out; ground your analysis using your deep learning domain knowledge and search understanding of this reference.`;
        }
      }
    }

    const systemInstruction = `You are "GraphFlow Copilot", an elite Principal Deep Learning Infrastructure Architect and AI System Engineer.
You specialize in large-scale model topologies (dense & sparse MoE up to 1 Trillion parameters), tensor dimension transformations, arithmetic intensity (FLOPs/Byte), roofline model evaluation, memory wall dynamics (weights, KV cache, activations, ZeRO sharding), and PyTorch modular structures.

Current Model Architecture JSON Status:
\`\`\`json
${JSON.stringify(currentModelSpec, null, 2)}
\`\`\`${webpageContext}

YOUR CAPABILITIES:
1. Explain: Explain why certain blocks are memory-bound vs compute-bound, how GQA saves KV cache memory, how SwiGLU compares to standard GeLU, or analyze dimension transitions.
2. Diagnose & Fix: If there is a dimension mismatch or memory bottleneck, identify the precise tensor discrepancy and provide the solution.
3. Edit the Architecture: When the user asks you to modify the model (e.g. "Add a Conv2d block", "Convert attention layers to GQA with 8 KV heads", "Fix dimension mismatch", "Optimize for 80GB VRAM", "Delete block 3", "Change d_model to 4096"):
   - Provide an insightful, concise engineering rationale.
   - At the end of your response, output a structured JSON code block containing the updated model or atomic action using this EXACT delimiter format:
\`\`\`json-action
{
  "action": "UPDATE_SPEC",
  "summary": "Brief summary of what was changed",
  "updatedSpec": <COMPLETE_UPDATED_MODEL_ARCHITECTURE_SPEC_JSON>
}
\`\`\`
Ensure any updatedSpec conforms to the ModelArchitectureSpec schema with "blocks", "connections", "runtime", "precision", and "distributed".

Keep all responses sharp, highly technical, and immediately actionable. Do not use decorative emojis.`;

    // Format chat contents for gemini-3.8-flash
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.2
      }
    });

    const replyText = response.text || 'No response generated.';
    
    // Check if an action was proposed in ```json-action
    let actionPayload = null;
    const actionMatch = replyText.match(/```json-action\s*([\s\S]*?)\s*```/);
    if (actionMatch && actionMatch[1]) {
      try {
        actionPayload = JSON.parse(actionMatch[1]);
      } catch (e) {
        console.error('Failed to parse json-action payload:', e);
      }
    }

    return res.json({
      reply: replyText.replace(/```json-action[\s\S]*?```/, '').trim(),
      action: actionPayload,
      referencedSources
    });
  } catch (error: any) {
    console.error('Error in /api/assistant/chat:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred while communicating with Gemini.' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Vite Middleware for Development / Static serving for production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer();
