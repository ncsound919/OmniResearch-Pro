import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, HardDrive, Cloud, Search, FileText, Settings, Play, CheckCircle2, 
  Loader2, ShieldCheck, Cpu, Network, GitMerge, BookOpenCheck, Globe as GlobeIcon, Bot, 
  Wrench, Youtube, Instagram, Presentation, Terminal, Download, Copy, Check, 
  Layers, Target, AlignLeft, Info, Puzzle, Upload, Link as LinkIcon, Users, Share2, MessageSquare, UserPlus,
  History, Menu, Edit3, Save, Printer, Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateResearchReportStream, ResearchOptions } from './services/geminiService';
import { useAppStore } from './store';
import { format } from 'date-fns';

// shadcn components
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster, toast } from 'sonner';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// magicui components
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

const SECTORS = [
  "Biotech", "Gaming", "Finance", "Health", "Business", 
  "Software Development", "Music", "Logistics", "Supply Chain", 
  "Crypto", "Housing"
];

const SECTOR_MODULES: Record<string, { id: string, label: string, description: string }[]> = {
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

const DEFAULT_MODULES = [
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

export default function App() {
  const { addReport, history, agents, addAgent, deleteAgent, updateAgentProgress, deleteReport } = useAppStore();
  
  const [activeView, setActiveView] = useState<'research' | 'memory' | 'agents' | 'settings'>('research');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
  const [groundingSources, setGroundingSources] = useState<Array<{title: string, uri: string}>>([]);
  const [targetAudience, setTargetAudience] = useState('Executive Board');
  const [teamSync, setTeamSync] = useState(false);
  
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reportContent, setReportContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [openCommand, setOpenCommand] = useState(false);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenCommand((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

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

  const [slackToken, setSlackToken] = useState(() => localStorage.getItem('slackToken') || "");
  const [notionKey, setNotionKey] = useState(() => localStorage.getItem('notionKey') || "");
  const [notionDb, setNotionDb] = useState(() => localStorage.getItem('notionDb') || "");

  const handleSaveSettings = () => {
    localStorage.setItem('slackToken', slackToken);
    localStorage.setItem('notionKey', notionKey);
    localStorage.setItem('notionDb', notionDb);
    toast.success("Settings saved successfully.");
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

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

      const activeSources = [];
      if (sources.googleDrive) activeSources.push("Google Drive (PDFs, Datasets)");
      if (uploadedFiles.length > 0) activeSources.push(`Local Files (${uploadedFiles.length} uploaded)`);
      if (sources.webSearch) activeSources.push("Live Web Search");
      
      const currentModules = SECTOR_MODULES[selectedSector] || DEFAULT_MODULES;
      const activeModuleLabels = currentModules.filter(m => activeModules[m.id]).map(m => m.label);
      
      const processedFiles = await Promise.all(uploadedFiles.map(async (f) => ({
        name: f.name,
        mimeType: f.type || 'text/plain',
        data: await fileToBase64(f)
      })));

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
      
      // Save to memory
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
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
        <Toaster position="top-right" />
        
        <CommandDialog open={openCommand} onOpenChange={setOpenCommand}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => { setActiveView('research'); setOpenCommand(false); }}>
                <Search className="mr-2 h-4 w-4" />
                <span>Go to Research Engine</span>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveView('memory'); setOpenCommand(false); }}>
                <History className="mr-2 h-4 w-4" />
                <span>Go to Memory & History</span>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveView('agents'); setOpenCommand(false); }}>
                <Cpu className="mr-2 h-4 w-4" />
                <span>Go to Agent Deployment</span>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveView('settings'); setOpenCommand(false); }}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Go to Settings</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => { 
                setActiveView('research'); 
                setOpenCommand(false);
                handleRunPipeline();
              }}>
                <Play className="mr-2 h-4 w-4" />
                <span>Run Analysis Pipeline</span>
              </CommandItem>
              <CommandItem onSelect={() => {
                setOpenCommand(false);
                const newAgent = { 
                  id: Date.now().toString(), 
                  name: `Agent-${Math.floor(Math.random() * 1000)}`, 
                  status: 'running' as const, 
                  progress: 0,
                  sector: selectedSector,
                  focus: customFocus,
                  startedAt: new Date().toISOString()
                };
                addAgent(newAgent);
                toast.success(`Deployed ${newAgent.name}`);
                let p = 0;
                const interval = setInterval(() => {
                  p += 10;
                  if (p >= 100) {
                    clearInterval(interval);
                    updateAgentProgress(newAgent.id, 100, 'completed');
                  } else {
                    updateAgentProgress(newAgent.id, p);
                  }
                }, 1000);
              }}>
                <Cpu className="mr-2 h-4 w-4" />
                <span>Deploy New Agent</span>
              </CommandItem>
              <CommandItem onSelect={() => {
                setOpenCommand(false);
                toast.success("Memory cleared.");
                history.forEach(report => deleteReport(report.id));
              }}>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Clear Memory</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Output Format">
              <CommandItem onSelect={() => { setMediaFormat('markdown'); setOpenCommand(false); toast.success("Format set to Report"); }}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Set Format: Report</span>
              </CommandItem>
              <CommandItem onSelect={() => { setMediaFormat('youtube'); setOpenCommand(false); toast.success("Format set to YouTube"); }}>
                <Youtube className="mr-2 h-4 w-4" />
                <span>Set Format: YouTube</span>
              </CommandItem>
              <CommandItem onSelect={() => { setMediaFormat('instagram'); setOpenCommand(false); toast.success("Format set to Instagram"); }}>
                <Instagram className="mr-2 h-4 w-4" />
                <span>Set Format: Instagram</span>
              </CommandItem>
              <CommandItem onSelect={() => { setMediaFormat('slides'); setOpenCommand(false); toast.success("Format set to Slides"); }}>
                <Presentation className="mr-2 h-4 w-4" />
                <span>Set Format: Slides</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        {/* Left Navigation Rail */}
        <nav className="w-16 bg-slate-950 flex flex-col items-center py-6 gap-6 z-50 shadow-xl border-r border-slate-800 shrink-0">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 mb-4 cursor-pointer" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Bot size={24} className="text-white" />
          </div>
          
          <Tooltip>
            <TooltipTrigger>
              <button 
                onClick={() => setActiveView('research')}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeView === 'research' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                <Search size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Research Engine</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <button 
                onClick={() => setActiveView('memory')}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeView === 'memory' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                <History size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Memory & History</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <button 
                onClick={() => setActiveView('agents')}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeView === 'agents' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                <Cpu size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Agent Deployment</TooltipContent>
          </Tooltip>

          <div className="mt-auto">
            <Tooltip>
              <TooltipTrigger>
                <button 
                  onClick={() => setActiveView('settings')}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeView === 'settings' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                  <Settings size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </div>
        </nav>

        {/* Main App Area */}
        <div className="flex-1 flex overflow-hidden">
          {activeView === 'research' && (
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
                  <Label className="flex items-center gap-3 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors font-normal">
                    <Checkbox checked={sources.googleDrive} onCheckedChange={(c) => setSources({...sources, googleDrive: !!c})} disabled={status === 'running'} />
                    <Cloud size={16} className="text-blue-500" />
                    <span className="text-sm">Google Drive (Cloud)</span>
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
                    <Checkbox checked={sources.webSearch} onCheckedChange={(c) => setSources({...sources, webSearch: !!c})} disabled={status === 'running'} />
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
                        onCheckedChange={(c) => setActiveModules({...activeModules, [module.id]: !!c})} 
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
                    <Checkbox className="mt-0.5" checked={advancedOptions.crossDiscipline} onCheckedChange={(c) => setAdvancedOptions({...advancedOptions, crossDiscipline: !!c})} disabled={status === 'running'} />
                    <div className="space-y-1">
                      <div className="text-sm font-medium leading-none flex items-center gap-1.5">
                        <GitMerge size={14} className="text-purple-500"/> Cross-Discipline
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">Infer trends from adjacent sectors.</p>
                    </div>
                  </Label>
                  <Label className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors font-normal">
                    <Checkbox className="mt-0.5" checked={advancedOptions.synergyMapping} onCheckedChange={(c) => setAdvancedOptions({...advancedOptions, synergyMapping: !!c})} disabled={status === 'running'} />
                    <div className="space-y-1">
                      <div className="text-sm font-medium leading-none flex items-center gap-1.5">
                        <Network size={14} className="text-blue-500"/> Synergy Mapping
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">Map compounding value methodologies.</p>
                    </div>
                  </Label>
                  <Label className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors font-normal">
                    <Checkbox className="mt-0.5" checked={advancedOptions.referenceReinforcement} onCheckedChange={(c) => setAdvancedOptions({...advancedOptions, referenceReinforcement: !!c})} disabled={status === 'running'} />
                    <div className="space-y-1">
                      <div className="text-sm font-medium leading-none flex items-center gap-1.5">
                        <BookOpenCheck size={14} className="text-emerald-500"/> Ref Reinforcement
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
                      <Cloud size={14} className="text-blue-500"/> Auto-Sync to Notion
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
                              <div className={`relative z-10 mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                isCompleted ? 'bg-green-50 border-green-200 text-green-600' : 
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
                          <span className="text-slate-500 mr-3 select-none">[{new Date().toISOString().split('T')[1].slice(0,8)}]</span>
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
                                  code({node, inline, className, children, ...props}: any) {
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
          )}
          
          {activeView === 'memory' && (
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><History className="text-blue-500" /> Research Memory</h2>
                {history.length > 0 && (
                  <Button variant="destructive" onClick={() => {
                    history.forEach(report => deleteReport(report.id));
                    toast.success("Memory cleared.");
                  }}>
                    <Trash2 size={16} className="mr-2" /> Clear Memory
                  </Button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No research reports saved yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {history.map(report => (
                    <Card key={report.id} className="hover:shadow-md transition-shadow cursor-pointer border-slate-200" onClick={() => {
                      setReportContent(report.content);
                      setEditableContent(report.content);
                      setSelectedSector(report.sector);
                      setMediaFormat(report.format as any);
                      setStatus('completed');
                      setActiveView('research');
                    }}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="mb-2">{report.format}</Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <CardTitle className="text-lg line-clamp-2">{report.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-slate-500 mb-4">{new Date(report.date).toLocaleDateString()}</p>
                        <p className="text-sm text-slate-600 line-clamp-3">{report.content.substring(0, 150)}...</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === 'agents' && (
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Cpu className="text-blue-500" /> Agent Deployment</h2>
                <div className="flex gap-2">
                  {agents.length > 0 && (
                    <Button variant="outline" onClick={() => {
                      agents.forEach(agent => deleteAgent(agent.id));
                      toast.success("Agents cleared.");
                    }}>
                      <Trash2 size={16} className="mr-2" /> Clear Agents
                    </Button>
                  )}
                  <Button onClick={() => {
                    const newAgent = { 
                      id: Date.now().toString(), 
                      name: `Agent-${Math.floor(Math.random() * 1000)}`, 
                      status: 'running' as const, 
                      progress: 0,
                      sector: selectedSector,
                      focus: customFocus,
                      startedAt: new Date().toISOString()
                    };
                    addAgent(newAgent);
                    toast.success(`Deployed ${newAgent.name}`);
                    // Simulate progress
                    let p = 0;
                    const interval = setInterval(() => {
                      p += 10;
                      if (p >= 100) {
                        clearInterval(interval);
                        updateAgentProgress(newAgent.id, 100, 'completed');
                      } else {
                        updateAgentProgress(newAgent.id, p);
                      }
                    }, 1000);
                  }}>
                    <Play size={16} className="mr-2" /> Deploy New Agent
                  </Button>
                </div>
              </div>
              
              {agents.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                  <Cpu size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No active agents.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.map(agent => (
                    <Card key={agent.id} className="border-slate-200">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${agent.status === 'running' ? 'bg-blue-100 text-blue-600' : agent.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {agent.status === 'running' ? <Loader2 size={20} className="animate-spin" /> : agent.status === 'completed' ? <CheckCircle2 size={20} /> : <ShieldCheck size={20} />}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{agent.name}</h4>
                            <p className="text-xs text-slate-500">Sector: {agent.sector}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 w-1/3">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-full ${agent.status === 'running' ? 'bg-blue-500' : agent.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${agent.progress}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-600 w-8">{agent.progress}%</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => {
                            toast.info(`Agent ${agent.name} Logs`, { description: `Sector: ${agent.sector}\nStatus: ${agent.status}\nProgress: ${agent.progress}%` });
                          }}>
                            <Info size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => deleteAgent(agent.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div className="flex-1 p-8 overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings className="text-blue-500" /> System Settings</h2>
              <div className="max-w-2xl space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>API Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Gemini API Key</Label>
                      <Input type="password" value="••••••••••••••••••••••••" disabled />
                      <p className="text-xs text-slate-500">Managed via environment variables.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Slack Bot Token</Label>
                      <Input type="password" placeholder="xoxb-..." value={slackToken} onChange={(e) => setSlackToken(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Notion Integration Secret</Label>
                      <Input type="password" placeholder="secret_..." value={notionKey} onChange={(e) => setNotionKey(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Notion Database ID</Label>
                      <Input type="text" placeholder="Database ID" value={notionDb} onChange={(e) => setNotionDb(e.target.value)} />
                    </div>
                    <Button onClick={handleSaveSettings} className="mt-4">Save Settings</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
