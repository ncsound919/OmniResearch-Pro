import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL?.replace(/\/$/, "");
const MIN_SEARCH_RESULTS = 1;
const MAX_SEARCH_RESULTS = 5;
const OLLAMA_REQUEST_TIMEOUT_MS = 10_000;
const SEARXNG_REQUEST_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_ERROR_LENGTH = 300;

type SearxngResult = {
  title?: string;
  url?: string;
  content?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hasSearchResultMetadata(result: SearxngResult): result is Required<Pick<SearxngResult, "title" | "url">> & SearxngResult {
  return Boolean(result.url && result.title);
}

function summarizePrompt(prompt: string, maxLength: number) {
  return prompt.length > maxLength ? `${prompt.substring(0, maxLength)}...` : prompt;
}

function createTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function summarizeUpstreamError(errorText: string) {
  const cleanedSnippet = errorText.replace(/\s+/g, " ");
  return cleanedSnippet.length > MAX_UPSTREAM_ERROR_LENGTH
    ? `${cleanedSnippet.slice(0, MAX_UPSTREAM_ERROR_LENGTH)}... [truncated]`
    : cleanedSnippet;
}

function buildUpstreamClientErrorDetail(errorText: string, fallback: string) {
  return errorText ? `${fallback}: ${summarizeUpstreamError(errorText)}` : fallback;
}

// ─── Agent State ────────────────────────────────────────────────────────────────

interface AgentState {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: string;
  error?: string;
  sector: string;
  focus: string;
  depth: string;
  format: string;
  modules: string[];
  startedAt: string;
}

const agentStore = new Map<string, AgentState>();

// ─── Google OAuth State ─────────────────────────────────────────────────────────

let googleTokens: any = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ─── Ollama Local Proxy ─────────────────────────────────────────────────────

  app.post("/api/ollama/generate", async (req, res) => {
    try {
      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : undefined;
      const model = typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : DEFAULT_OLLAMA_MODEL;

      if (!prompt) {
        return res.status(400).json({ error: "A prompt is required for Ollama generation." });
      }

      const ollamaTimeout = createTimeoutController(OLLAMA_REQUEST_TIMEOUT_MS);

      try {
        const ollamaResponse = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
          }),
          signal: ollamaTimeout.signal,
        });

        if (!ollamaResponse.ok) {
          const errorText = await ollamaResponse.text();
          console.error("Ollama upstream error response", {
            status: ollamaResponse.status,
            statusText: ollamaResponse.statusText,
            body: errorText,
          });

          const clientErrorDetail = buildUpstreamClientErrorDetail(
            errorText,
            ollamaResponse.statusText || "Upstream Ollama provider error",
          );

          ollamaTimeout.clear();
          return res.status(502).json({
            error: `Ollama request failed (${ollamaResponse.status}). ${clientErrorDetail}`,
          });
        }

        const data = await ollamaResponse.json();
        ollamaTimeout.clear();
        return res.json({
          response: data.response,
          model,
          mode: "ollama",
        });
      } catch (ollamaError) {
        ollamaTimeout.clear();
        if (isAbortError(ollamaError)) {
          console.error("Ollama request timed out", {
            baseUrl: DEFAULT_OLLAMA_BASE_URL,
            timeoutMs: OLLAMA_REQUEST_TIMEOUT_MS,
          });
          return res.status(504).json({
            error: `Ollama request timed out after ${OLLAMA_REQUEST_TIMEOUT_MS}ms.`,
          });
        }

        console.warn("Ollama runtime unavailable, using simulation fallback.", ollamaError);
        await new Promise((resolve) => setTimeout(resolve, 1200));

        return res.json({
          response: `[Ollama Local Simulation] No reachable Ollama runtime was detected at ${DEFAULT_OLLAMA_BASE_URL}. Based on the prompt: "${summarizePrompt(prompt, 80)}", here is a simulated offline synthesis preview.`,
          model,
          mode: "simulation",
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Web Search (SearXNG) ───────────────────────────────────────────────────

  app.post("/api/web-search", async (req, res) => {
    try {
      const query = typeof req.body?.query === "string" ? req.body.query.trim() : undefined;
      const requestedLimit = Number(req.body?.limit);
      const limit = Number.isFinite(requestedLimit)
        ? clamp(Math.trunc(requestedLimit), MIN_SEARCH_RESULTS, MAX_SEARCH_RESULTS)
        : MAX_SEARCH_RESULTS;

      if (!query) {
        return res.status(400).json({ error: "A search query is required." });
      }

      if (!SEARXNG_BASE_URL) {
        return res.json({
          results: [],
          provider: "disabled",
          warning: "SEARXNG_BASE_URL is not configured. Set the SEARXNG_BASE_URL environment variable to enable live open-source web search.",
        });
      }

      const searchUrl = new URL(`${SEARXNG_BASE_URL}/search`);
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("format", "json");
      searchUrl.searchParams.set("language", "en");
      searchUrl.searchParams.set("categories", "general");

      const searxngTimeout = createTimeoutController(SEARXNG_REQUEST_TIMEOUT_MS);
      let searchResponse: Response;

      try {
        searchResponse = await fetch(searchUrl, {
          headers: { Accept: "application/json" },
          signal: searxngTimeout.signal,
        });
      } catch (error) {
        searxngTimeout.clear();
        if (isAbortError(error)) {
          console.error("SearXNG request timed out", {
            baseUrl: SEARXNG_BASE_URL,
            timeoutMs: SEARXNG_REQUEST_TIMEOUT_MS,
          });
          return res.status(504).json({
            error: `SearXNG request timed out after ${SEARXNG_REQUEST_TIMEOUT_MS}ms.`,
          });
        }

        throw error;
      }

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        searxngTimeout.clear();

        console.error("SearXNG upstream error response", {
          status: searchResponse.status,
          statusText: searchResponse.statusText,
          body: errorText,
        });

        const clientErrorDetail = buildUpstreamClientErrorDetail(
          errorText,
          searchResponse.statusText || "Upstream search provider error",
        );

        return res.status(502).json({
          error: `SearXNG request failed (${searchResponse.status}). ${clientErrorDetail}`,
        });
      }

      const data = await searchResponse.json();
      searxngTimeout.clear();
      const results = Array.isArray(data?.results)
        ? (data.results as SearxngResult[])
            .filter(hasSearchResultMetadata)
            .slice(0, limit)
            .map((result) => ({
              title: result.title,
              url: result.url,
              snippet: result.content || "",
            }))
        : [];

      return res.json({ results });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // ─── Slack Integration ──────────────────────────────────────────────────────

  app.post("/api/slack/share", async (req, res) => {
    try {
      const { message, channel, token } = req.body;
      const slackToken = token || process.env.SLACK_BOT_TOKEN;
      
      if (!slackToken) {
        return res.status(400).json({ error: "SLACK_BOT_TOKEN is not configured." });
      }

      const { WebClient } = await import('@slack/web-api');
      const slack = new WebClient(slackToken);
      
      const result = await slack.chat.postMessage({
        text: message,
        channel: channel || '#general',
      });
      
      res.json({ success: true, ts: result.ts });
    } catch (error: any) {
      console.error("Slack error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Notion Integration ─────────────────────────────────────────────────────

  app.post("/api/notion/sync", async (req, res) => {
    try {
      const { title, content, token, dbId } = req.body;
      const notionToken = token || process.env.NOTION_API_KEY;
      const databaseId = dbId || process.env.NOTION_DATABASE_ID;
      
      if (!notionToken || !databaseId) {
        return res.status(400).json({ error: "NOTION_API_KEY or NOTION_DATABASE_ID is not configured." });
      }

      const { Client } = await import('@notionhq/client');
      const notion = new Client({ auth: notionToken });
      
      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: title
                }
              }
            ]
          }
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: content.substring(0, 2000)
                  }
                }
              ]
            }
          }
        ]
      });
      
      res.json({ success: true, url: (response as any).url });
    } catch (error: any) {
      console.error("Notion error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Agent Endpoints ────────────────────────────────────────────────────────

  app.post("/api/agent/run", async (req, res) => {
    try {
      const { sector, focus, depth, format, modules } = req.body;

      if (!sector) {
        return res.status(400).json({ error: "sector is required" });
      }

      const id = randomUUID();
      const agent: AgentState = {
        id,
        status: 'queued',
        progress: 0,
        sector: sector || 'Business',
        focus: focus || '',
        depth: depth || 'standard',
        format: format || 'markdown',
        modules: Array.isArray(modules) ? modules : [],
        startedAt: new Date().toISOString(),
      };

      agentStore.set(id, agent);
      res.json({ id, status: 'queued' });

      // Run the agent asynchronously
      runAgent(agent).catch(err => {
        console.error(`Agent ${id} failed:`, err);
        const a = agentStore.get(id);
        if (a) {
          a.status = 'failed';
          a.error = err.message || 'Unknown error';
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/status/:id", (req, res) => {
    const agent = agentStore.get(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json({
      id: agent.id,
      status: agent.status,
      progress: agent.progress,
      result: agent.result,
      error: agent.error,
      sector: agent.sector,
      focus: agent.focus,
    });
  });

  app.get("/api/agents", (req, res) => {
    const agents = Array.from(agentStore.values()).map(a => ({
      id: a.id,
      status: a.status,
      progress: a.progress,
      sector: a.sector,
      focus: a.focus,
      startedAt: a.startedAt,
    }));
    res.json({ agents });
  });

  app.delete("/api/agent/:id", (req, res) => {
    const deleted = agentStore.delete(req.params.id);
    res.json({ success: deleted });
  });

  // ─── Google Drive Integration ───────────────────────────────────────────────

  app.get("/api/google/auth-url", async (req, res) => {
    try {
      const { google } = await import('googleapis');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(400).json({
          error: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables.",
        });
      }

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:3000/api/google/callback'
      );

      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        prompt: 'consent',
      });

      res.json({ url });
    } catch (error: any) {
      console.error("Google auth URL error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/google/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send("Missing authorization code.");
      }

      const { google } = await import('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3000/api/google/callback'
      );

      const { tokens } = await oauth2Client.getToken(code);
      googleTokens = tokens;
      oauth2Client.setCredentials(tokens);

      res.send(`
        <html>
          <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#0f172a;color:white;">
            <div style="text-align:center">
              <h2>Google Drive Connected!</h2>
              <p>You can close this window and return to OmniResearch.</p>
              <script>setTimeout(()=>window.close(),2000)</script>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Google callback error:", error);
      res.status(500).send(`Authentication failed: ${error.message}`);
    }
  });

  app.get("/api/google/status", (req, res) => {
    res.json({ authenticated: !!googleTokens });
  });

  app.get("/api/google/drive/files", async (req, res) => {
    try {
      if (!googleTokens) {
        return res.status(401).json({ error: "Not authenticated with Google." });
      }

      const { google } = await import('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3000/api/google/callback'
      );
      oauth2Client.setCredentials(googleTokens);

      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const response = await drive.files.list({
        pageSize: 50,
        fields: 'files(id, name, mimeType, modifiedTime)',
        orderBy: 'modifiedTime desc',
        q: "trashed = false",
      });

      res.json({ files: response.data.files || [] });
    } catch (error: any) {
      console.error("Google Drive files error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/google/drive/download/:fileId", async (req, res) => {
    try {
      if (!googleTokens) {
        return res.status(401).json({ error: "Not authenticated with Google." });
      }

      const { google } = await import('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3000/api/google/callback'
      );
      oauth2Client.setCredentials(googleTokens);

      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const fileId = req.params.fileId;

      // Get file metadata to determine type
      const meta = await drive.files.get({ fileId, fields: 'name, mimeType' });
      const mimeType = meta.data.mimeType || '';
      const fileName = meta.data.name || fileId;

      let text = '';

      if (mimeType === 'application/vnd.google-apps.document') {
        // Google Docs: export as plain text
        const exported = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
        text = exported.data as string;
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Google Sheets: export as CSV
        const exported = await drive.files.export({ fileId, mimeType: 'text/csv' }, { responseType: 'text' });
        text = exported.data as string;
      } else {
        // Binary files: download content
        const downloaded = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
        text = typeof downloaded.data === 'string' ? downloaded.data : JSON.stringify(downloaded.data);
      }

      res.json({ filename: fileName, text, mimeType });
    } catch (error: any) {
      console.error("Google Drive download error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── File Processing ───────────────────────────────────────────────────────

  // Use raw express for multipart - import multer-like handling manually
  // Since we want to avoid installing new packages, use a simple approach with express raw body
  const multerLike = express.raw({ type: 'multipart/form-data', limit: '50mb' });

  app.post("/api/files/extract", async (req, res) => {
    try {
      // Parse multipart manually since we can't use multer
      const contentType = req.headers['content-type'] || '';
      
      if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({ error: "Expected multipart/form-data" });
      }

      // Get the boundary from content-type
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) {
        return res.status(400).json({ error: "No boundary found in content-type" });
      }

      // Read raw body
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', resolve);
        req.on('error', reject);
      });

      const body = Buffer.concat(chunks);
      const boundary = boundaryMatch[1].trim();
      const boundaryBuffer = Buffer.from(`--${boundary}`);

      // Find file content between boundaries
      const bodyStr = body.toString('binary');
      const parts = bodyStr.split(`--${boundary}`);
      
      let filename = 'unknown';
      let fileBuffer: Buffer | null = null;

      for (const part of parts) {
        if (part.includes('Content-Disposition') && part.includes('filename=')) {
          const filenameMatch = part.match(/filename="([^"]+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }

          // Find the empty line that separates headers from body
          const headerEndIndex = part.indexOf('\r\n\r\n');
          if (headerEndIndex !== -1) {
            let content = part.substring(headerEndIndex + 4);
            // Remove trailing \r\n
            if (content.endsWith('\r\n')) {
              content = content.slice(0, -2);
            }
            fileBuffer = Buffer.from(content, 'binary');
          }
        }
      }

      if (!fileBuffer) {
        return res.status(400).json({ error: "No file found in upload" });
      }

      const ext = path.extname(filename).toLowerCase();
      let text = '';

      if (ext === '.txt' || ext === '.md') {
        text = fileBuffer.toString('utf-8');
      } else if (ext === '.csv') {
        const raw = fileBuffer.toString('utf-8');
        // Parse CSV into a readable table
        const lines = raw.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          const rows = lines.slice(1).map(line =>
            line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
          );
          text = `Table: ${filename}\n`;
          text += `Columns: ${headers.join(' | ')}\n\n`;
          rows.forEach((row, i) => {
            text += headers.map((h, j) => `${h}: ${row[j] || ''}`).join(', ') + '\n';
          });
        }
      } else if (ext === '.pdf') {
        // Try to extract text from PDF - many PDFs have text content
        const rawText = fileBuffer.toString('utf-8');
        // Look for text between PDF stream objects
        const textParts: string[] = [];
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let match;
        while ((match = streamRegex.exec(rawText)) !== null) {
          const streamContent = match[1];
          // Extract text showing operations (Tj, TJ, etc.)
          const tjRegex = /\(([^)]*)\)\s*Tj/g;
          let tjMatch;
          while ((tjMatch = tjRegex.exec(streamContent)) !== null) {
            textParts.push(tjMatch[1]);
          }
        }

        if (textParts.length > 0) {
          text = textParts.join(' ');
        } else {
          // Fallback: try plain text extraction
          const printable = rawText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
          if (printable.length > 100) {
            text = printable.substring(0, 10000);
          } else {
            text = `[PDF text extraction limited for ${filename}. File sent as-is to AI for processing.]`;
          }
        }
      } else {
        text = fileBuffer.toString('utf-8');
      }

      res.json({
        filename,
        text,
        size: fileBuffer.length,
      });
    } catch (error: any) {
      console.error("File extraction error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Agent Runner (async, uses Gemini API) ────────────────────────────────

  async function runAgent(agent: AgentState) {
    const a = agentStore.get(agent.id);
    if (!a) return;

    // Transition to running
    a.status = 'running';
    a.progress = 10;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      a.status = 'failed';
      a.error = 'GEMINI_API_KEY is not configured on the server.';
      return;
    }

    try {
      // Build the prompt (mirrors geminiService.ts logic)
      const depthInstruction = a.depth === 'brief'
        ? "Keep the report concise and high-level (under 500 words)."
        : a.depth === 'exhaustive'
          ? "Provide an exhaustive, highly detailed deep-dive with extensive analysis and edge-case exploration."
          : "Provide a standard, comprehensive overview.";

      let formatInstructions = `Ensure the report is formatted in rich Markdown. Include an Executive Summary, Quantitative Analytics, and advanced cognitive mappings.`;
      if (a.format === 'youtube') {
        formatInstructions = `Format the output as a detailed YouTube Explainer Video Script. Include [Visual Cues/B-Roll], [On-Screen Text], and spoken [Narration]. Structure it with a Hook, Intro, Deep Dive, and Outro.`;
      } else if (a.format === 'instagram') {
        formatInstructions = `Format the output as a punchy, 60-second Instagram Reel script. Include [Visual: ...], [Text Overlay: ...], and fast-paced [Audio: ...]. Focus on high-retention hooks and rapid value delivery.`;
      } else if (a.format === 'slides') {
        formatInstructions = `Format the output as a Presentation Slide Deck. For each slide, provide 'Slide Title', 'Visual Content/Chart Description', and 'Speaker Notes'.`;
      }

      const prompt = `
You are the OmniResearch Semantic Engine running as an autonomous research agent.

Target Sector: "${a.sector}"
${a.focus ? `Specific Focus Area: "${a.focus}"` : ''}

CORE DIRECTIVES:
1. Dynamic Value Prioritization: Identify the most critical paradigm shifts, bottlenecks, or breakthroughs in ${a.sector} right now.
2. Adaptive Presentation: ${formatInstructions}
3. Depth & Scope: ${depthInstruction}
4. Cross-Referential Discovery: Find unexpected links between disparate sources and concepts.

${a.modules.length > 0 ? `
DOMAIN-SPECIFIC LENSES:
Apply the following specialized analytical lenses to this report:
${a.modules.map(m => `- ${m}`).join('\n')}
` : ''}

Invent 3-5 realistic-sounding books, datasets, or magazines to use as your reference base.
`;

      a.progress = 30;

      // Call Gemini API
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      a.progress = 50;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      a.progress = 90;

      const text = response.text || '';
      if (!text) {
        a.status = 'failed';
        a.error = 'Gemini returned empty response';
        return;
      }

      a.result = text;
      a.status = 'completed';
      a.progress = 100;
      console.log(`Agent ${a.id} completed successfully (${text.length} chars).`);
    } catch (error: any) {
      console.error(`Agent ${a.id} error:`, error);
      a.status = 'failed';
      a.error = error.message || 'Unknown error during agent execution';
    }
  }

  // ─── Vite Middleware ────────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
