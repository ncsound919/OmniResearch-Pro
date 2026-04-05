import { useState, useEffect, useCallback } from 'react';
import { Search, Settings, Cpu, History, Bot, Play, FileText, Youtube, Instagram, Presentation, Trash2 } from 'lucide-react';
import { useAppStore } from './store';
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

import ResearchView from './views/ResearchView';
import HistoryView from './views/HistoryView';
import AgentsView from './views/AgentsView';
import SettingsView from './views/SettingsView';

export default function App() {
  const { history, deleteReport } = useAppStore();

  const [activeView, setActiveView] = useState<'research' | 'memory' | 'agents' | 'settings'>('research');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openCommand, setOpenCommand] = useState(false);
  const [mediaFormat, setMediaFormat] = useState<'markdown' | 'youtube' | 'instagram' | 'slides'>('markdown');

  // External report to load into ResearchView (from History or Agents)
  const [externalReport, setExternalReport] = useState<{ content: string; sector: string; format: string } | null>(null);

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

  const handleLoadReport = useCallback((report: { content: string; sector: string; format: string }) => {
    setExternalReport(report);
    setActiveView('research');
  }, []);

  const handleExternalReportConsumed = useCallback(() => {
    setExternalReport(null);
  }, []);

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
              }}>
                <Play className="mr-2 h-4 w-4" />
                <span>Run Analysis Pipeline</span>
              </CommandItem>
              <CommandItem onSelect={() => {
                setActiveView('agents');
                setOpenCommand(false);
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
            <ResearchView
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              externalReport={externalReport}
              onExternalReportConsumed={handleExternalReportConsumed}
            />
          )}

          {activeView === 'memory' && (
            <HistoryView onLoadReport={handleLoadReport} />
          )}

          {activeView === 'agents' && (
            <AgentsView onViewReport={handleLoadReport} />
          )}

          {activeView === 'settings' && (
            <SettingsView />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
