import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedReport {
  id: string;
  title: string;
  date: string;
  content: string;
  sector: string;
  format: string;
}

export interface AgentTask {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  sector: string;
  focus: string;
  startedAt: string;
}

interface AppState {
  history: SavedReport[];
  addReport: (report: SavedReport) => void;
  deleteReport: (id: string) => void;
  
  agents: AgentTask[];
  addAgent: (agent: AgentTask) => void;
  updateAgentProgress: (id: string, progress: number, status?: AgentTask['status']) => void;
  deleteAgent: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      history: [],
      addReport: (report) => set((state) => ({ history: [report, ...state.history] })),
      deleteReport: (id) => set((state) => ({ history: state.history.filter(r => r.id !== id) })),
      
      agents: [],
      addAgent: (agent) => set((state) => ({ agents: [agent, ...state.agents] })),
      updateAgentProgress: (id, progress, status) => set((state) => ({
        agents: state.agents.map(a => a.id === id ? { ...a, progress, status: status || a.status } : a)
      })),
      deleteAgent: (id) => set((state) => ({ agents: state.agents.filter(a => a.id !== id) })),
    }),
    { name: 'omniresearch-storage' }
  )
);
