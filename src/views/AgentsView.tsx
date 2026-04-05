import { useState, useEffect, useRef } from 'react';
import {
  Cpu, Loader2, CheckCircle2, ShieldCheck, Play, Trash2, Info, FileText, Clock
} from 'lucide-react';
import { useAppStore, AgentTask } from '../store';
import { SECTORS, SECTOR_MODULES, DEFAULT_MODULES } from './ResearchView';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

interface AgentsViewProps {
  onViewReport: (report: { content: string; sector: string; format: string }) => void;
}

export default function AgentsView({ onViewReport }: AgentsViewProps) {
  const { agents, addAgent, deleteAgent, updateAgentProgress } = useAppStore();

  const [sector, setSector] = useState(SECTORS[0]);
  const [focus, setFocus] = useState('');
  const [depth, setDepth] = useState<'brief' | 'standard' | 'exhaustive'>('standard');
  const [format, setFormat] = useState<'markdown' | 'youtube' | 'instagram' | 'slides'>('markdown');
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRefs.current.forEach(interval => clearInterval(interval));
      pollingRefs.current.clear();
    };
  }, []);

  // Reset modules when sector changes
  useEffect(() => {
    setActiveModules({});
  }, [sector]);

  const startPolling = (agentId: string) => {
    // Don't start duplicate polling
    if (pollingRefs.current.has(agentId)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agent/status/${agentId}`);
        if (!res.ok) {
          clearInterval(interval);
          pollingRefs.current.delete(agentId);
          return;
        }
        const data = await res.json();

        updateAgentProgress(agentId, data.progress, data.status);

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          pollingRefs.current.delete(agentId);

          if (data.status === 'completed' && data.result) {
            // Update the agent's result in the store
            const store = useAppStore.getState();
            const agent = store.agents.find(a => a.id === agentId);
            if (agent) {
              useAppStore.setState({
                agents: store.agents.map(a =>
                  a.id === agentId ? { ...a, result: data.result, status: 'completed', progress: 100 } : a
                )
              });
            }
            toast.success(`Agent ${agentId.slice(0, 8)} completed!`);
          } else if (data.status === 'failed') {
            toast.error(`Agent ${agentId.slice(0, 8)} failed: ${data.error || 'Unknown error'}`);
          }
        }
      } catch {
        // Network error - keep polling
      }
    }, 2000);

    pollingRefs.current.set(agentId, interval);
  };

  const handleDeploy = async () => {
    const currentModules = SECTOR_MODULES[sector] || DEFAULT_MODULES;
    const selectedModules = currentModules.filter(m => activeModules[m.id]).map(m => m.label);

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sector,
          focus,
          depth,
          format,
          modules: selectedModules,
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to deploy agent');
      }

      const data = await res.json();
      const agentId = data.id;

      const newAgent: AgentTask = {
        id: agentId,
        name: `Agent-${agentId.slice(0, 6)}`,
        status: 'queued',
        progress: 0,
        sector,
        focus,
        depth,
        format,
        modules: selectedModules,
        startedAt: new Date().toISOString(),
      };

      addAgent(newAgent);
      toast.success(`Deployed ${newAgent.name}`);
      startPolling(agentId);
    } catch (err: any) {
      toast.error(`Deploy failed: ${err.message}`);
    }
  };

  const handleDelete = async (agentId: string) => {
    // Stop polling
    const interval = pollingRefs.current.get(agentId);
    if (interval) {
      clearInterval(interval);
      pollingRefs.current.delete(agentId);
    }

    // Delete from server (fire-and-forget)
    fetch(`/api/agent/${agentId}`, { method: 'DELETE' }).catch(() => { });

    deleteAgent(agentId);
  };

  const handleViewReport = (agent: AgentTask) => {
    if (agent.result) {
      onViewReport({
        content: agent.result,
        sector: agent.sector,
        format: agent.format,
      });
    }
  };

  const handleClearAll = () => {
    pollingRefs.current.forEach(interval => clearInterval(interval));
    pollingRefs.current.clear();
    agents.forEach(agent => {
      fetch(`/api/agent/${agent.id}`, { method: 'DELETE' }).catch(() => { });
      deleteAgent(agent.id);
    });
    toast.success("Agents cleared.");
  };

  // Resume polling for agents that are still running/queued
  useEffect(() => {
    agents.forEach(agent => {
      if ((agent.status === 'running' || agent.status === 'queued') && !pollingRefs.current.has(agent.id)) {
        startPolling(agent.id);
      }
    });
  }, []);

  const currentModules = SECTOR_MODULES[sector] || DEFAULT_MODULES;

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Cpu className="text-blue-500" /> Agent Deployment</h2>
        <div className="flex gap-2">
          {agents.length > 0 && (
            <Button variant="outline" onClick={handleClearAll}>
              <Trash2 size={16} className="mr-2" /> Clear Agents
            </Button>
          )}
        </div>
      </div>

      {/* Deploy Configuration */}
      <Card className="mb-6 border-slate-200">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Deploy New Agent</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Sector</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Focus (optional)</Label>
              <Input
                placeholder="e.g., AI integration"
                value={focus}
                onChange={e => setFocus(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Depth</Label>
              <Tabs value={depth} onValueChange={(v: any) => setDepth(v)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="brief" className="text-xs">Brief</TabsTrigger>
                  <TabsTrigger value="standard" className="text-xs">Std</TabsTrigger>
                  <TabsTrigger value="exhaustive" className="text-xs">Deep</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Format</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="markdown">Report</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="instagram">Reel</SelectItem>
                  <SelectItem value="slides">Slides</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Module checkboxes */}
          {currentModules.length > 0 && (
            <div className="mb-4">
              <Label className="text-xs text-slate-500 mb-2 block">Domain Lenses</Label>
              <div className="flex flex-wrap gap-3">
                {currentModules.map(m => (
                  <Label key={m.id} className="flex items-center gap-2 text-xs font-normal cursor-pointer">
                    <Checkbox
                      checked={!!activeModules[m.id]}
                      onCheckedChange={c => setActiveModules({ ...activeModules, [m.id]: !!c })}
                    />
                    {m.label}
                  </Label>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleDeploy}>
            <Play size={16} className="mr-2" /> Deploy New Agent
          </Button>
        </CardContent>
      </Card>

      {/* Agent List */}
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
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${agent.status === 'queued' ? 'bg-amber-100 text-amber-600' :
                      agent.status === 'running' ? 'bg-blue-100 text-blue-600' :
                        agent.status === 'completed' ? 'bg-green-100 text-green-600' :
                          'bg-red-100 text-red-600'
                    }`}>
                    {agent.status === 'queued' ? <Clock size={20} /> :
                      agent.status === 'running' ? <Loader2 size={20} className="animate-spin" /> :
                        agent.status === 'completed' ? <CheckCircle2 size={20} /> :
                          <ShieldCheck size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{agent.name}</h4>
                    <p className="text-xs text-slate-500">
                      Sector: {agent.sector}
                      {agent.focus && ` | Focus: ${agent.focus}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-1/3">
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${agent.status === 'queued' ? 'bg-amber-500' :
                        agent.status === 'running' ? 'bg-blue-500' :
                          agent.status === 'completed' ? 'bg-green-500' :
                            'bg-red-500'
                      }`} style={{ width: `${agent.progress}%` }} />
                  </div>
                  <Badge variant="outline" className="text-[10px] w-20 justify-center">
                    {agent.status === 'queued' ? 'Queued' :
                      agent.status === 'running' ? `${agent.progress}%` :
                        agent.status === 'completed' ? 'Done' : 'Failed'}
                  </Badge>
                  {agent.status === 'completed' && agent.result && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleViewReport(agent)}>
                      <FileText size={14} className="mr-1" /> View Report
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => {
                    toast.info(`Agent ${agent.name} Info`, {
                      description: `Sector: ${agent.sector}\nStatus: ${agent.status}\nProgress: ${agent.progress}%\nDepth: ${agent.depth || 'standard'}\nFormat: ${agent.format || 'markdown'}`
                    });
                  }}>
                    <Info size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDelete(agent.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
