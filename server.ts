import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Ollama Local Proxy
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

  // Optional open-source web search via SearXNG
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

        // Log full upstream error body server-side for diagnostics
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

  // Slack Integration
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

  // Notion Integration
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
      
      // Basic block creation (simplified for markdown)
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
                    content: content.substring(0, 2000) // Notion limit per block
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

  // Vite middleware for development
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
