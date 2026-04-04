import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface UploadedFile {
  name: string;
  mimeType: string;
  data: string;
}

export interface ResearchSource {
  title: string;
  uri: string;
}

const OPEN_SOURCE_SEARCH_LIMIT = 5;

export interface ResearchOptions {
  crossDiscipline: boolean;
  synergyMapping: boolean;
  referenceReinforcement: boolean;
  useWebSearch: boolean;
  toolCalling: boolean;
  mediaFormat: 'markdown' | 'youtube' | 'instagram' | 'slides';
  aiEngine: 'gemini-cloud' | 'ollama-local';
  customFocus?: string;
  depth: 'brief' | 'standard' | 'exhaustive';
  sectorModules?: string[];
  signal?: AbortSignal;
  uploadedFiles?: UploadedFile[];
  targetAudience: string;
}

export type ReportStreamChunk = {
  text?: string;
  sources?: ResearchSource[];
};

type SearchResult = ResearchSource & {
  snippet: string;
};

type WebSearchApiResult = {
  title?: string;
  url?: string;
  snippet?: string;
};

type WebSearchApiResponse = {
  results?: WebSearchApiResult[];
};

type WebSearchApiResultWithUrl = Required<Pick<WebSearchApiResult, 'title' | 'url'>> & WebSearchApiResult;

function hasWebSearchMetadata(result: WebSearchApiResult): result is WebSearchApiResultWithUrl {
  return Boolean(result?.title && result?.url);
}

function buildOpenSourceSearchContext(results: SearchResult[]) {
  if (results.length === 0) {
    return '';
  }

  return `
LIVE OPEN-SOURCE SEARCH BRIEFING:
${results.map(formatSearchResultLine).join('\n')}
`;
}

function formatSearchResultLine(result: SearchResult, index: number) {
  return `${index + 1}. ${result.title} — ${result.snippet || 'No summary provided.'} (${result.uri})`;
}

async function fetchOpenSourceSearchContext(sector: string, options: ResearchOptions): Promise<SearchResult[]> {
  if (!options.useWebSearch || options.signal?.aborted) {
    return [];
  }

  const query = [sector, options.customFocus, ...(options.sectorModules ?? [])]
    .filter(Boolean)
    .join(" ");

  if (!query) {
    return [];
  }

  try {
    const response = await fetch('/api/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: OPEN_SOURCE_SEARCH_LIMIT }),
      signal: options.signal
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as WebSearchApiResponse;
    if (!Array.isArray(data.results)) {
      return [];
    }

    return data.results
      .filter(hasWebSearchMetadata)
      .map((result) => ({
        title: result.title,
        uri: result.url,
        snippet: result.snippet || '',
      }));
  } catch (error) {
    console.warn('Open-source web search unavailable:', error);
    return [];
  }
}

export async function* generateResearchReportStream(sector: string, sources: string[], options: ResearchOptions): AsyncGenerator<ReportStreamChunk, void, unknown> {
  if (options.signal?.aborted) throw new Error('Aborted');
  const liveSearchResults = await fetchOpenSourceSearchContext(sector, options);
  let formatInstructions = `Ensure the report is formatted in rich Markdown. Include an Executive Summary, Quantitative Analytics, and the requested advanced cognitive mappings. Tailor the tone, vocabulary, and complexity specifically for an audience of: ${options.targetAudience}.`;
  if (options.mediaFormat === 'youtube') {
    formatInstructions = `Format the output as a detailed YouTube Explainer Video Script tailored for: ${options.targetAudience}. Include [Visual Cues/B-Roll], [On-Screen Text], and spoken [Narration]. Structure it with a Hook, Intro, Deep Dive, and Outro.`;
  } else if (options.mediaFormat === 'instagram') {
    formatInstructions = `Format the output as a punchy, 60-second Instagram Reel script tailored for: ${options.targetAudience}. Include [Visual: ...], [Text Overlay: ...], and fast-paced [Audio: ...]. Focus on high-retention hooks and rapid value delivery.`;
  } else if (options.mediaFormat === 'slides') {
    formatInstructions = `Format the output as a Presentation Slide Deck tailored for: ${options.targetAudience}. For each slide, provide 'Slide Title', 'Visual Content/Chart Description', and 'Speaker Notes'.`;
  }

  const depthInstruction = options.depth === 'brief' ? "Keep the report concise and high-level (under 500 words)." :
                           options.depth === 'exhaustive' ? "Provide an exhaustive, highly detailed deep-dive with extensive analysis and edge-case exploration." :
                           "Provide a standard, comprehensive overview.";
  const openSourceSearchContext = buildOpenSourceSearchContext(liveSearchResults);

  const prompt = `
You are the OmniResearch Semantic Engine.
${options.aiEngine === 'ollama-local' ? 'You are currently running in Local Privacy Mode backed by an Ollama-compatible local model when available.' : 'You are running in Cloud Mode (Gemini 3.1 Pro).'}

Target Sector: "${sector}"
${options.customFocus ? `Specific Focus Area / Query: "${options.customFocus}"` : ''}
Simulated Data Sources: ${sources.join(", ")} (Includes PDFs, Datasets, Magazines, and Books)
${openSourceSearchContext}

CORE DIRECTIVES:
1. Dynamic Value Prioritization: Identify the most critical paradigm shifts, bottlenecks, or breakthroughs in ${sector} right now.
2. Adaptive Presentation: ${formatInstructions}
3. Depth & Scope: ${depthInstruction}
4. Cross-Referential Discovery: Find unexpected links between disparate sources and concepts.

${options.crossDiscipline ? `5. Cross-Discipline Inference & Trend Spotting: Explicitly connect trends in ${sector} to other relevant industries.` : ''}
${options.synergyMapping ? `6. Synergy Mapping: Include a structured breakdown showing how different methodologies combine to create compounding value.` : ''}
${options.referenceReinforcement ? `7. Reference Reinforcement: Explicitly reinforce claims by citing multiple converging simulated sources.` : ''}
${options.toolCalling ? `8. Agentic Tool Calling: You have access to external tools. Explicitly state when you are "calling" a tool (e.g., \`[Tool Call: Analyze Dataset CSV]\` or \`[Tool Call: Run Python Script]\`) to process the datasets and PDFs.` : ''}

${options.sectorModules && options.sectorModules.length > 0 ? `
DOMAIN-SPECIFIC LENSES:
Apply the following specialized analytical lenses to this report:
${options.sectorModules.map(m => `- ${m}`).join('\n')}
` : ''}

Invent 3-5 realistic-sounding books, datasets, or magazines to use as your reference base.
`;

  try {
    if (liveSearchResults.length > 0) {
      yield {
        sources: liveSearchResults
      };
    }

    if (options.aiEngine === 'ollama-local') {
      const response = await fetch('/api/ollama/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: options.signal
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Ollama API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      yield { text: data.response };
      return;
    }

    const requestConfig: any = {
      temperature: 0.7,
    };

    if (options.useWebSearch) {
      requestConfig.tools = [{ googleSearch: {} }];
      requestConfig.toolConfig = { includeServerSideToolInvocations: true };
    }

    const parts: any[] = [{ text: prompt }];

    if (options.uploadedFiles && options.uploadedFiles.length > 0) {
      options.uploadedFiles.forEach(file => {
        parts.push({
          inlineData: {
            data: file.data,
            mimeType: file.mimeType
          }
        });
      });
    }

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.1-pro-preview",
      contents: { parts },
      config: requestConfig,
    });

    for await (const chunk of responseStream) {
      if (options.signal?.aborted) throw new Error('Aborted');
      
      if (chunk.text) {
        yield { text: chunk.text };
      }

      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && groundingChunks.length > 0) {
        const extractedSources = groundingChunks
          .map((g: any) => g.web?.uri && g.web?.title ? { uri: g.web.uri, title: g.web.title } : null)
          .filter(Boolean);
        
        if (extractedSources.length > 0) {
          yield { sources: extractedSources };
        }
      }
    }
  } catch (error) {
    console.error("Error generating report:", error);
    throw new Error("Failed to generate research content. Please check your API key and try again.");
  }
}
