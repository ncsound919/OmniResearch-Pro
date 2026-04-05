import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, HardDrive, Cloud, Search, FileText, Settings, Play, CheckCircle2,
  Loader2, ShieldCheck, Cpu, Network, GitMerge, BookOpenCheck, Globe as GlobeIcon, Bot,
  Wrench, Youtube, Instagram, Presentation, Terminal, Download, Copy,
  Layers, Target, AlignLeft, Info, Puzzle, Upload, Link as LinkIcon, Users, Share2, MessageSquare, UserPlus,
  Edit3, Save, Printer
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateResearchReportStream, ResearchOptions } from '../services/geminiService';
import { useAppStore } from '../store';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from 'sonner';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Globe } from "@/components/ui/globe";

const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(new Error('Aborted'));
  const timeout = setTimeout(() => {
    if (signal) signal.removeEventListener('abort', abortHandler);
    resolve();
  }, ms);
  const abortHandler = () => {
    clearTimeout(timeout);
    reject(new Error('Aborted'));
  };
  if (signal) signal.addEventListener('abort', abortHandler);
});

export const SECTORS = [
  "Biotech", "Gaming", "Finance", "Health", "Business",
  "Software Development", "Music", "Logistics", "Supply Chain",
  "Crypto", "Housing"
];

export const SECTOR_MODULES: Record<string, { id: string, label: string, description: string }[]> = {
  "Biotech": [
    { id: "clinical_trials", label: "Clinical Trial Cross-Ref", description: "Cross-reference with recent Phase II/III trial data." },
    { id: "regulatory", label: "FDA/EMA Regulatory Check", description: "Analyze against current regulatory frameworks." },
    { id: "pathway_analysis", label: "Molecular Pathway Analysis", description: "Map out relevant biological mechanisms." }
  ],
  "Finance": [
    { id: "sec_filings", label: "SEC Filings Analysis", description: "Extract insights from recent 10-K and 10-Q reports." },
    { id: "market_sentiment", label: "Market Sentiment Overlay", description: "Correlate findings with real-time market sentiment." },
    { id: "risk_modeling", label: "Quantitative Risk Modeling", description: "Assess systemic and idiosyncratic risks." }
  ],
  "Software Development": [
    { id: "repo_analysis", label: "GitHub Repo Analysis", description: "Analyze relevant open-source repositories." },
    { id: "arch_review", label: "Architecture Review", description: "Evaluate system design and tech stack compatibility." },
    { id: "sec_audit", label: "Vulnerability Scanning", description: "Simulate a security and dependency audit." }
  ],
  "Crypto": [
    { id: "on_chain", label: "On-Chain Analytics", description: "Incorporate transaction volume and wallet behavior." },
    { id: "tokenomics", label: "Tokenomics Modeling", description: "Analyze token utility, distribution, and inflation." },
    { id: "smart_contract", label: "Smart Contract Audit", description: "Review protocol security and logic." }
  ],
  "Health": [
    { id: "epidemiology", label: "Epidemiological Trends", description: "Analyze population health statistics." },
    { id: "telemedicine", label: "Telehealth Integration", description: "Assess digital health infrastructure impacts." }
  ],
  "Gaming": [
    { id: "player_retention", label: "Player Retention Metrics", description: "Analyze engagement and churn models." },
    { id: "monetization", label: "Monetization Strategy", description: "Evaluate in-game economies and pricing." }
  ],
  "Business": [
    { id: "competitor_analysis", label: "Competitor Landscape", description: "Map out key competitors and market share." },
    { id: "swot", label: "SWOT Generation", description: "Generate a Strengths, Weaknesses, Opportunities, Threats matrix." }
  ]
};

export const DEFAULT_MODULES = [
  { id: "competitor_analysis", label: "Competitor Landscape", description: "Map out key competitors and market share." },
  { id: "swot", label: "SWOT Generation", description: "Generate a Strengths, Weaknesses, Opportunities, Threats matrix." }
];

const WORKFLOW_STEPS = [
  { id: 'connect', label: 'Connecting Sources', icon: Database },
  { id: 'ingest', label: 'Ingesting & Chunking', icon: Layers },
  { id: 'embed', label: 'Vector Embedding', icon: Network },
  { id: 'retrieve', label: 'Semantic Retrieval', icon: Search },
  { id: 'synthesize', label: 'Report Synthesis', icon: FileText },
];

interface ResearchViewProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  externalReport?: { content: string; sector: string; format: string } | null;
  onExternalReportConsumed?: () => void;
}

export default function ResearchView({ isSidebarOpen, setIsSidebarOpen, externalReport, onExternalReportConsumed }: ResearchViewProps) {
  const { addReport } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState("");

  const [selectedSector, setSelectedSector] = useState(SECTORS[0]);
  const [customFocus, setCustomFocus] = useState("");
  const [depth, setDepth] = useState<'brief' | 'standard' | 'exhaustive'>('standard');
  const [sources, setSources] = useState({
    googleDrive: true,
    localStorage: false,
    webSearch: false,
  });
  const [advancedOptions, setAdvancedOptions] = useState({
    crossDiscipline: false,
    synergyMapping: false,
    referenceReinforcement: false,
  });
  const [aiEngine, setAiEngine] = useState<'gemini-cloud' | 'ollama-local'>('gemini-cloud');
  const [toolCalling, setToolCalling] = useState(false);
  const [mediaFormat, setMediaFormat] = useState<'markdown' | 'youtube' | 'instagram' | 'slides'>('markdown');
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [groundingSources, setGroundingSources] = useState<Array<{ title: string, uri: string }>>([]);
  const [targetAudience, setTargetAudience] = useState('Executive Board');
  const [teamSync, setTeamSync] = useState(false);

  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reportContent, setReportContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  // Google Drive state
  const [googleAuthed, setGoogleAuthed] = useState(false);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string; modifiedTime: string }>>([]);
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<string[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [slackToken] = useState(() => localStorage.getItem('slackToken') || "");
  const [notionKey] = useState(() => localStorage.getItem('notionKey') || "");
  const [notionDb] = useState(() => localStorage.getItem('notionDb') || "");

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    setActiveModules({});
  }, [selectedSector]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle external report loading (from agent results)
  useEffect(() => {
    if (externalReport) {
      setReportContent(externalReport.content);
      setEditableContent(externalReport.content);
      setSelectedSector(externalReport.sector);
      setMediaFormat(externalReport.format as any);
      setStatus('completed');
      onExternalReportConsumed?.();
    }
  }, [externalReport, onExternalReportConsumed]);

  // Check Google Drive auth status when checkbox toggled
  useEffect(() => {
    if (sources.googleDrive) {
      checkGoogleAuth();
    }
  }, [sources.googleDrive]);

  const checkGoogleAuth = async () => {
    try {
      const res = await fetch('/api/google/status');
      const data = await res.json();
      setGoogleAuthed(data.authenticated);
      if (data.authenticated) {
        loadDriveFiles();
      }
    } catch {
      setGoogleAuthed(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      const res = await fetch('/api/google/auth-url');
      const data = await res.json();
      if (data.url) {
        const popup = window.open(data.url, 'google-auth', 'width=600,height=700');
        // Poll for auth completion
        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/google/status');
            const statusData = await statusRes.json();
            if (statusData.authenticated) {
              clearInterval(interval);
              popup?.close();
              setGoogleAuthed(true);
              loadDriveFiles();
              toast.success("Google Drive connected!");
            }
          } catch { /* keep polling */ }
        }, 2000);
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(interval), 300000);
      }
    } catch (err: any) {
      toast.error(`Google Drive auth error: ${err.message}`);
    }
  };

  const loadDriveFiles = async () => {
    setLoadingDriveFiles(true);
    try {
      const res = await fetch('/api/google/drive/files');
      const data = await res.json();
      if (data.files) {
        setDriveFiles(data.files);
      }
    } catch (err: any) {
      toast.error(`Failed to load Drive files: ${err.message}`);
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const extractFileText = async (file: File): Promise<{ name: string; text: string }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/files/extract', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        return { name: data.filename, text: data.text };
      }
    } catch { /* fall through to base64 */ }
    // Fallback: use base64
    return { name: file.name, text: '' };
  };

  const handleShareToSlack = async () => {
    try {
      const response = await fetch('/api/slack/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `New Research Report Generated: ${selectedSector}\n\n${reportContent.substring(0, 500)}...`,
          channel: '#research-updates',
          token: slackToken
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Shared to Slack channel #research-updates");
      } else {
        throw new Error(data.error || "Failed to share to Slack");
      }
    } catch (error: any) {
      toast.error(`Slack Error: ${error.message}`);
    }
  };

  const handleSyncToNotion = async (contentToSync: string) => {
    try {
      const response = await fetch('/api/notion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Research Report: ${selectedSector}`,
          content: contentToSync,
          token: notionKey,
          dbId: notionDb
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Synced to Notion workspace");
      } else {
        throw new Error(data.error || "Failed to sync to Notion");
      }
    } catch (error: any) {
      toast.error(`Notion Error: ${error.message}`);
    }
  };

  const handleRunPipeline = async () => {
    if (status === 'running') return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setStatus('running');
    setCurrentStepIndex(0);
    setReportContent("");
    setGroundingSources([]);
    setErrorMsg("");
    setLogs(["Initializing OmniResearch Engine v1.1.0 with open-source accelerators..."]);

    const logSequence = [
      sources.googleDrive ? "Authenticating Google Drive OAuth 2.0..." : "Skipping Google Drive connector.",
      uploadedFiles.length > 0 ? `Preparing ${uploadedFiles.length} uploaded file(s) for ingestion...` : "Waiting for live and cloud sources...",
      "Chunking documents (1000 tokens, 200 overlap)...",
      aiEngine === 'ollama-local' ? "Routing synthesis through local Ollama runtime..." : "Generating embeddings and retrieval plan for Gemini Cloud...",
      sources.webSearch ? "Querying live web search through optional SearXNG connector..." : "Skipping live web search connector.",
      "Running hybrid search (Keyword + Semantic)...",
      toolCalling ? "Agentic tools enabled for downstream analysis..." : "Agentic tools disabled; using direct synthesis path.",
      "Reranking results with cross-encoder...",
      aiEngine === 'ollama-local' ? "Synthesizing intelligence report with local privacy mode..." : "Synthesizing intelligence report with Gemini Cloud..."
    ];

    try {
      // Simulate steps 1-4
      for (let i = 0; i < 4; i++) {
        setCurrentStepIndex(i);
        setLogs(prev => [...prev, logSequence[i * 2], logSequence[i * 2 + 1]]);
        await delay(1200, signal);
      }

      // Step 5: Report Generation
      setCurrentStepIndex(4);
      setLogs(prev => [...prev, logSequence[8], "Streaming response from AI Engine..."]);

      const activeSources: string[] = [];
      if (sources.googleDrive) activeSources.push("Google Drive (PDFs, Datasets)");
      if (uploadedFiles.length > 0) activeSources.push(`Local Files (${uploadedFiles.length} uploaded)`);
      if (sources.webSearch) activeSources.push("Live Web Search");

      const currentModules = SECTOR_MODULES[selectedSector] || DEFAULT_MODULES;
      const activeModuleLabels = currentModules.filter(m => activeModules[m.id]).map(m => m.label);

      // Extract text from local files via server endpoint
      const extractedTexts: Array<{ name: string; text: string }> = [];
      for (const f of uploadedFiles) {
        const extracted = await extractFileText(f);
        if (extracted.text) {
          extractedTexts.push(extracted);
        }
      }

      // Fall back to base64 for files without extracted text
      const processedFiles = await Promise.all(uploadedFiles.map(async (f) => {
        const extracted = extractedTexts.find(e => e.name === f.name);
        if (extracted && extracted.text) {
          return {
            name: f.name,
            mimeType: 'text/plain',
            data: btoa(unescape(encodeURIComponent(extracted.text)))
          };
        }
        return {
          name: f.name,
          mimeType: f.type || 'text/plain',
          data: await fileToBase64(f)
        };
      }));

      // Download selected Google Drive files and add as processed files
      if (sources.googleDrive && googleAuthed && selectedDriveFiles.length > 0) {
        setLogs(prev => [...prev, `Downloading ${selectedDriveFiles.length} file(s) from Google Drive...`]);
        for (const fileId of selectedDriveFiles) {
          try {
            const res = await fetch(`/api/google/drive/download/${fileId}`, { signal });
            if (res.ok) {
              const data = await res.json();
              processedFiles.push({
                name: data.filename || fileId,
                mimeType: 'text/plain',
                data: btoa(unescape(encodeURIComponent(data.text)))
              });
            }
          } catch { /* skip failed downloads */ }
        }
      }

      const reportStream = generateResearchReportStream(selectedSector, activeSources, {
        ...advancedOptions,
        useWebSearch: sources.webSearch,
        toolCalling,
        mediaFormat,
        aiEngine,
        customFocus,
        depth,
        sectorModules: activeModuleLabels,
        signal,
        uploadedFiles: processedFiles,
        targetAudience
      });

      let finalContent = "";
      for await (const chunk of reportStream) {
        if (signal.aborted) throw new Error('Aborted');
        if (chunk.text) {
          finalContent += chunk.text;
          setReportContent(prev => prev + chunk.text!);
        }
        if (chunk.sources) {
          setGroundingSources(prev => {
            const newSources = [...prev];
            chunk.sources!.forEach(s => {
              if (!newSources.find(existing => existing.uri === s.uri)) {
                newSources.push(s);
              }
            });
            return newSources;
          });
        }
      }
      setStatus('completed');
      setEditableContent(finalContent);
      toast.success("Analysis complete!", { description: `Generated ${mediaFormat} for ${selectedSector}.` });

      addReport({
        id: Date.now().toString(),
        title: `${mediaFormat.toUpperCase()} - ${selectedSector}`,
        date: new Date().toISOString(),
        content: finalContent,
        sector: selectedSector,
        format: mediaFormat
      });

      if (teamSync) {
        await handleSyncToNotion(finalContent);
      }
    } catch (error: any) {
      if (error.message === 'Aborted' || error.name === 'AbortError') {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Pipeline aborted by user.`]);
        setStatus('idle');
        toast.info("Pipeline Aborted", { description: "The research process was cancelled." });
      } else {
        console.error(error);
        setErrorMsg(error.message || "An error occurred during the pipeline execution.");
        setStatus('error');
        toast.error("Pipeline Failed", { description: error.message });
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelPipeline = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportContent);
    toast.success("Copied to clipboard", {
      description: "The report has been copied to your clipboard.",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([isEditing ? editableContent : reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSector.replace(/\s+/g, '-').toLowerCase()}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started", {
      description: `Saving ${a.download}`,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveEdit = () => {
    setReportContent(editableContent);
    setIsEditing(false);
    toast.success("Changes saved");
  };

  return (
    <ResizablePanelGroup orientation="horizontal" className="flex-1">
      {/* Sidebar Configuration */}
      {isSidebarOpen && (
        <>
          <ResizablePanel
            defaultSize={25}
            minSize={20}
            maxSize={40}
            className="bg-white border-r border-slate-200 flex flex-col h-screen shadow-sm z-10 shrink-0 overflow-hidden whitespace-nowrap"
          >
            <div className="p-5 border-b border-slate-200 bg-slate-950 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Database className="text-blue-400" size={22} />
                  <h1 className="text-lg font-bold tracking-tight">OmniResearch</h1>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400 font-mono">Semantic Engine v1.0</p>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px] px-1.5 py-0 h-4">BETA</Badge>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-5 flex flex-col gap-6">
                {/* Sector Selection */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Target size={16} className="text-slate-400" />
                    <span>Target Domain</span>
                  </div>

                  <Select value={selectedSector} onValueChange={setSelectedSector} disabled={status === 'running'}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="customFocus" className="text-xs text-slate-500">Specific Focus Area (Optional)</Label>
                    <Input
                      id="customFocus"
                      placeholder="e.g., AI integration, supply chain..."
                      value={customFocus}
                      onChange={(e) => setCustomFocus(e.target.value)}
                      disabled={status === 'running'}
                      className="text-sm"
                    />
                  </div>
                </section>

                <Separator />

                {/* Data Sources */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Database size={16} className="text-slate-400" />
                    <span>Data Ingestion</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex flex-col items-start gap-2 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors font-normal">
                      <div className="flex items-center gap-3 w-full">
                        <Checkbox checked={sources.googleDrive} onCheckedChange={(c) => setSources({ ...sources, googleDrive: !!c })} disabled={status === 'running'} />
                        <Cloud size={16} className="text-blue-500" />
                        <span className="text-sm">Google Drive (Cloud)</span>
                      </div>
                      {sources.googleDrive && !googleAuthed && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-8 text-xs h-7"
                          onClick={(e) => { e.preventDefault(); handleConnectGoogleDrive(); }}
                        >
                          <Cloud size={12} className="mr-1" /> Connect Google Drive
                        </Button>
                      )}
                      {sources.googleDrive && googleAuthed && (
                        <div className="ml-8 w-full pr-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">Connected</Badge>
                            {loadingDriveFiles && <Loader2 size={12} className="animate-spin text-slate-400" />}
                          </div>
                          {driveFiles.length > 0 && (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {driveFiles.map(f => (
                                <Label key={f.id} className="flex items-center gap-2 text-xs font-normal cursor-pointer hover:bg-slate-50 rounded p-1">
                                  <Checkbox
                                    checked={selectedDriveFiles.includes(f.id)}
                                    onCheckedChange={(c) => {
                                      if (c) setSelectedDriveFiles(prev => [...prev, f.id]);
                                      else setSelectedDriveFiles(prev => prev.filter(id => id !== f.id));
                                    }}
                                  />
                                  <span className="truncate">{f.name}</span>
                                </Label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Label>
                    <Label className="flex flex-col items-start gap-2 p-3 rounded-md border border-slate-200 bg-slate-50/50 transition-colors font-normal">
                      <div className="flex items-center gap-2">
                        <HardDrive size={16} className="text-slate-600" />
                        <span className="text-sm font-medium">Local Documents</span>
                      </div>
                      <Input
                        type="file"
                        multiple
                        accept=".txt,.pdf,.csv,.md"
                        onChange={handleFileUpload}
                        disabled={status === 'running'}
                        className="text-xs h-8 cursor-pointer file:text-xs file:bg-slate-100 file:text-slate-700 file:border-0 file:rounded file:px-2 file:py-0.5 file:mr-2 hover:file:bg-slate-200"
                      />
                      {uploadedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {uploadedFiles.map((f, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 bg-slate-200 text-slate-700">{f.name}</Badge>
                          ))}
                        </div>
                      )}
                    </Label>
                    <Label className="flex items-center gap-3 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors font-normal">
                      <Checkbox checked={sources.webSearch} onCheckedChange={(c) => setSources({ ...sources, webSearch: !!c })} disabled={status === 'running'} />
                      <GlobeIcon size={16} className="text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="text-sm">Live Web Search</span>
                        <span className="text-[11px] text-slate-500">Uses optional SearXNG for open-source metasearch grounding and returns empty results when the SEARXNG_BASE_URL integration is not configured.</span>
                      </div>
                    </Label>
                  </div>
                </section>

                <Separator />

                {/* Engine & Tools */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Cpu size={16} className="text-slate-400" />
                    <span>Engine & Tools</span>
                  </div>

                  <Tabs value={aiEngine} onValueChange={(v: any) => setAiEngine(v)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="gemini-cloud" disabled={status === 'running'} className="text-xs">
                        <Cloud size={14} className="mr-1.5" /> Cloud
                      </TabsTrigger>
                      <TabsTrigger value="ollama-local" disabled={status === 'running'} className="text-xs">
                        <ShieldCheck size={14} className="mr-1.5" /> Local
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {aiEngine === 'ollama-local'
                      ? 'Open-source local inference via Ollama. If no runtime is reachable, the app falls back to a safe simulation.'
                      : 'Gemini Cloud remains the default, with optional live grounding layered in when web search is enabled.'}
                  </p>

                  <Label className="flex items-center justify-between p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors font-normal mt-2">
                    <div className="flex items-center gap-2">
                      <Wrench size={16} className="text-amber-500" />
                      <span className="text-sm">Agentic Tool Calling</span>
                    </div>
                    <Checkbox checked={toolCalling} onCheckedChange={(c) => setToolCalling(!!c)} disabled={status === 'running'} />
                  </Label>
                </section>

                <Separator />

                {/* Sector-Specific Modules */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Puzzle size={16} className="text-slate-400" />
                    <span>Domain Lenses</span>
                  </div>
                  <div className="space-y-2">
                    {(SECTOR_MODULES[selectedSector] || DEFAULT_MODULES).map((module) => (
                      <Label key={module.id} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors font-normal">
                        <Checkbox
                          className="mt-0.5"
                          checked={!!activeModules[module.id]}
                          onCheckedChange={(c) => setActiveModules({ ...activeModules, [module.id]: !!c })}
                          disabled={status === 'running'}
                        />
                        <div className="space-y-1">
                          <div className="text-sm font-medium leading-none text-slate-800">
                            {module.label}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug">{module.description}</p>
                        </div>
                      </Label>
                    ))}
                  </div>
                </section>

                <Separator />

                {/* Synthesis Directives */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Settings size={16} className="text-slate-400" />
                    <span>Synthesis Directives</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Research Depth</Label>
                    <Tabs value={depth} onValueChange={(v: any) => setDepth(v)} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="brief" disabled={status === 'running'} className="text-xs">Brief</TabsTrigger>
                        <TabsTrigger value="standard" disabled={status === 'running'} className="text-xs">Standard</TabsTrigger>
                        <TabsTrigger value="exhaustive" disabled={status === 'running'} className="text-xs">Deep</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="space-y-2 pt-1">
                    <Label className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors font-normal">
                      <Checkbox className="mt-0.5" checked={advancedOptions.crossDiscipline} onCheckedChange={(c) => setAdvancedOptions({ ...advancedOptions, crossDiscipline: !!c })} disabled={status === 'running'} />
                      <div className="space-y-1">
                        <div className="text-sm font-medium leading-none flex items-center gap-1.5">
                          <GitMerge size={14} className="text-purple-500" /> Cross-Discipline
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">Infer trends from adjacent sectors.</p>
                      </div>
                    </Label>
                    <Label className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors font-normal">
                      <Checkbox className="mt-0.5" checked={advancedOptions.synergyMapping} onCheckedChange={(c) => setAdvancedOptions({ ...advancedOptions, synergyMapping: !!c })} disabled={status === 'running'} />
                      <div className="space-y-1">
                        <div className="text-sm font-medium leading-none flex items-center gap-1.5">
                          <Network size={14} className="text-blue-500" /> Synergy Mapping
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">Map compounding value methodologies.</p>
                      </div>
                    </Label>
                    <Label className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors font-normal">
                      <Checkbox className="mt-0.5" checked={advancedOptions.referenceReinforcement} onCheckedChange={(c) => setAdvancedOptions({ ...advancedOptions, referenceReinforcement: !!c })} disabled={status === 'running'} />
                      <div className="space-y-1">
                        <div className="text-sm font-medium leading-none flex items-center gap-1.5">
                          <BookOpenCheck size={14} className="text-emerald-500" /> Ref Reinforcement
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">Cite multiple converging sources.</p>
                      </div>
                    </Label>
                  </div>
                </section>

                <Separator />

                {/* Audience & Tone */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Users size={16} className="text-slate-400" />
                    <span>Audience & Tone</span>
                  </div>
                  <Select value={targetAudience} onValueChange={setTargetAudience} disabled={status === 'running'}>
                    <SelectTrigger className="w-full text-xs h-9 bg-white">
                      <SelectValue placeholder="Select target audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Executive Board">Executive Board (High-level, ROI focus)</SelectItem>
                      <SelectItem value="Academic Peers">Academic Peers (Rigorous, cited, technical)</SelectItem>
                      <SelectItem value="General Public">General Public (Accessible, engaging, clear)</SelectItem>
                      <SelectItem value="Creative Team">Creative Team (Inspiring, visual-first, conceptual)</SelectItem>
                      <SelectItem value="Students">Students (Educational, structured, foundational)</SelectItem>
                      <SelectItem value="Technical Experts">Technical Experts (Deep dive, specifications)</SelectItem>
                    </SelectContent>
                  </Select>
                </section>

                <Separator />

                {/* Team Collaboration */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Share2 size={16} className="text-slate-400" />
                    <span>Team Workspace</span>
                  </div>
                  <Label className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors font-normal border border-slate-200">
                    <Checkbox className="mt-0.5" checked={teamSync} onCheckedChange={(c) => setTeamSync(!!c)} disabled={status === 'running'} />
                    <div className="space-y-1">
                      <div className="text-sm font-medium leading-none flex items-center gap-1.5">
                        <Cloud size={14} className="text-blue-500" /> Auto-Sync to Notion
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">Push live updates to shared team workspace.</p>
                    </div>
                  </Label>
                </section>

                <Separator />

                {/* Media Output Format */}
                <section className="space-y-3 pb-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <AlignLeft size={16} className="text-slate-400" />
                    <span>Output Format</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={mediaFormat === 'markdown' ? 'default' : 'outline'}
                      className={`h-auto py-2.5 flex flex-col gap-1.5 ${mediaFormat === 'markdown' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      onClick={() => setMediaFormat('markdown')} disabled={status === 'running'}
                    >
                      <FileText size={16} /> <span className="text-xs">Report</span>
                    </Button>
                    <Button
                      variant={mediaFormat === 'youtube' ? 'default' : 'outline'}
                      className={`h-auto py-2.5 flex flex-col gap-1.5 ${mediaFormat === 'youtube' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                      onClick={() => setMediaFormat('youtube')} disabled={status === 'running'}
                    >
                      <Youtube size={16} /> <span className="text-xs">YouTube</span>
                    </Button>
                    <Button
                      variant={mediaFormat === 'instagram' ? 'default' : 'outline'}
                      className={`h-auto py-2.5 flex flex-col gap-1.5 ${mediaFormat === 'instagram' ? 'bg-pink-600 hover:bg-pink-700' : ''}`}
                      onClick={() => setMediaFormat('instagram')} disabled={status === 'running'}
                    >
                      <Instagram size={16} /> <span className="text-xs">Reel</span>
                    </Button>
                    <Button
                      variant={mediaFormat === 'slides' ? 'default' : 'outline'}
                      className={`h-auto py-2.5 flex flex-col gap-1.5 ${mediaFormat === 'slides' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                      onClick={() => setMediaFormat('slides')} disabled={status === 'running'}
                    >
                      <Presentation size={16} /> <span className="text-xs">Slides</span>
                    </Button>
                  </div>
                </section>

              </div>
            </ScrollArea>

            <div className="p-5 border-t border-slate-200 bg-slate-50/80 backdrop-blur-sm">
              {status === 'running' ? (
                <Button
                  size="lg"
                  className="w-full font-semibold shadow-md bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCancelPipeline}
                >
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancel Pipeline
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full font-semibold shadow-md"
                  onClick={handleRunPipeline}
                  disabled={!sources.googleDrive && uploadedFiles.length === 0 && !sources.webSearch}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Run Analysis
                </Button>
              )}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
        </>
      )}

      {/* Main Content Area */}
      <ResizablePanel defaultSize={isSidebarOpen ? 75 : 100} className="flex flex-col h-screen overflow-hidden relative">

        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-20 sticky top-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {status === 'idle' && "Ready for Analysis"}
              {status === 'running' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  Pipeline Execution in Progress
                </>
              )}
              {status === 'completed' && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  {mediaFormat === 'youtube' ? "YouTube Explainer Script" :
                    mediaFormat === 'instagram' ? "Instagram Reel Script" :
                      mediaFormat === 'slides' ? "Presentation Slide Deck" :
                        "Intelligence Report"}
                </>
              )}
              {status === 'error' && (
                <>
                  <ShieldCheck className="h-5 w-5 text-red-600" />
                  Pipeline Error
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {status === 'idle' && "Configure parameters in the sidebar and run the pipeline."}
              {status === 'running' && `Processing data for ${selectedSector}...`}
              {status === 'completed' && `Generated for ${selectedSector} using ${aiEngine === 'ollama-local' ? 'Local Ollama' : 'Gemini Cloud'}.`}
              {status === 'error' && "Review the error message below."}
            </p>
          </div>

          {status === 'completed' && (
            <div className="flex items-center gap-2">
              {/* Mock Collaborators */}
              <div className="hidden sm:flex items-center -space-x-2 mr-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-bold text-blue-700 z-30">JD</div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-xs font-bold text-emerald-700 z-20">AS</div>
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs text-slate-500 z-10 hover:bg-slate-200 cursor-pointer">
                  <UserPlus size={14} />
                </div>
              </div>

              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-9">
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy to clipboard</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="h-9">
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download as Markdown</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
                    <Printer className="mr-2 h-4 w-4" /> Print
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Print Report</TooltipContent>
              </Tooltip>

              <Button variant="default" size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700" onClick={handleShareToSlack}>
                <MessageSquare className="mr-2 h-4 w-4" /> Share
              </Button>
            </div>
          )}
        </header>

        {/* Content Scroll Area */}
        <ScrollArea className="flex-1 relative z-10">
          <div className="p-6 md:p-8 max-w-5xl mx-auto min-h-full">

            {/* Idle State with MagicUI Globe */}
            {status === 'idle' && (
              <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="absolute inset-0 flex items-center justify-center opacity-40 mix-blend-multiply pointer-events-none">
                  <Globe className="top-28" />
                </div>
                <div className="relative z-10 flex flex-col items-center text-center max-w-md p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-100 shadow-xl">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <Bot size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">OmniResearch Engine</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Select your target sector, configure data sources, and adjust synthesis directives to begin the automated RAG pipeline.
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                    <Info size={14} /> Ready to process documents
                  </div>
                </div>
              </div>
            )}

            {/* Running State */}
            {status === 'running' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pipeline Steps */}
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="pb-4 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Layers size={16} className="text-blue-500" /> Pipeline Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      {WORKFLOW_STEPS.map((step, index) => {
                        const isCompleted = index < currentStepIndex;
                        const isCurrent = index === currentStepIndex;
                        const Icon = step.icon;

                        return (
                          <div key={step.id} className="flex items-start gap-4 relative">
                            {index !== WORKFLOW_STEPS.length - 1 && (
                              <div className={`absolute left-4 top-8 bottom-[-24px] w-px ${isCompleted ? 'bg-green-200' : 'bg-slate-100'}`} />
                            )}
                            <div className={`relative z-10 mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${isCompleted ? 'bg-green-50 border-green-200 text-green-600' :
                                isCurrent ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-slate-50 border-slate-100 text-slate-400'
                              }`}>
                              {isCompleted ? <CheckCircle2 size={16} /> :
                                isCurrent ? <Loader2 size={16} className="animate-spin" /> :
                                  <Icon size={14} />}
                            </div>
                            <div className="pt-1">
                              <h4 className={`text-sm font-semibold ${isCurrent ? 'text-blue-700' : isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                                {step.label}
                              </h4>
                              {isCurrent && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                  className="text-xs text-slate-500 mt-1 font-medium"
                                >
                                  Processing...
                                </motion.p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Terminal Output */}
                <Card className="bg-[#0f172a] border-slate-800 shadow-xl overflow-hidden flex flex-col h-[450px]">
                  <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-800 flex justify-between items-center text-slate-400 text-xs font-medium uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Terminal size={14} /> System Logs
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-slate-400 hover:text-slate-200" onClick={() => setLogs([])}>
                      Clear
                    </Button>
                  </div>
                  <div
                    ref={terminalRef}
                    className="flex-1 overflow-y-auto p-4 font-mono text-[13px] text-green-400 flex flex-col gap-2 custom-scrollbar"
                  >
                    {logs.map((log, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className="leading-relaxed"
                      >
                        <span className="text-slate-500 mr-3 select-none">[{new Date().toISOString().split('T')[1].slice(0, 8)}]</span>
                        <span className={log.includes("Error") ? "text-red-400" : log.includes("Streaming") ? "text-blue-400" : "text-green-400"}>{log}</span>
                      </motion.div>
                    ))}
                    <div className="animate-pulse mt-1 text-green-400 font-bold">_</div>
                  </div>
                </Card>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <Card className="border-red-200 bg-red-50/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-red-700 flex items-center gap-2">
                    <ShieldCheck size={20} /> Pipeline Failure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
                </CardContent>
              </Card>
            )}

            {/* Completed State - Report Display */}
            <AnimatePresence>
              {(status === 'completed' || (status === 'running' && reportContent.length > 0)) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  <Card className="shadow-sm border-slate-200 overflow-hidden">
                    <CardContent className="p-8 md:p-12">
                      {isEditing ? (
                        <div className="flex flex-col gap-4">
                          <div className="flex justify-end gap-2 mb-2">
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                              <Save className="w-4 h-4 mr-2" /> Save Changes
                            </Button>
                          </div>
                          <textarea
                            value={editableContent}
                            onChange={(e) => setEditableContent(e.target.value)}
                            className="w-full h-[60vh] p-4 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          {status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-0 right-0 text-slate-400 hover:text-blue-600"
                              onClick={() => setIsEditing(true)}
                            >
                              <Edit3 className="w-4 h-4 mr-2" /> Edit
                            </Button>
                          )}
                          <div className="prose prose-slate prose-blue max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-img:rounded-xl prose-img:shadow-sm">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '')
                                  const codeString = String(children).replace(/\n$/, '')
                                  return !inline && match ? (
                                    <div className="relative group">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 hover:bg-slate-700 text-slate-300"
                                        onClick={() => {
                                          navigator.clipboard.writeText(codeString);
                                          toast.success("Code copied to clipboard");
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <SyntaxHighlighter
                                        {...props}
                                        children={codeString}
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        className="rounded-md !mt-0"
                                      />
                                    </div>
                                  ) : (
                                    <code {...props} className={className}>
                                      {children}
                                    </code>
                                  )
                                }
                              }}
                            >
                              {reportContent}
                            </ReactMarkdown>
                            {status === 'running' && <span className="inline-block w-2.5 h-5 bg-blue-500 animate-pulse ml-1 align-middle rounded-sm"></span>}
                          </div>
                        </div>
                      )}

                      {/* Grounding Sources Display */}
                      {groundingSources.length > 0 && (
                        <div className="mt-10 pt-6 border-t border-slate-100">
                          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4 uppercase tracking-wider">
                            <LinkIcon size={16} className="text-blue-500" /> Web Sources & Citations
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {groundingSources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                              >
                                <GlobeIcon size={14} className="text-slate-400 mt-0.5 group-hover:text-blue-500 flex-shrink-0" />
                                <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 line-clamp-2 leading-snug">
                                  {source.title || source.uri}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
