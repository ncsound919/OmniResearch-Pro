import { History, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';

interface HistoryViewProps {
  onLoadReport: (report: { content: string; sector: string; format: string }) => void;
}

export default function HistoryView({ onLoadReport }: HistoryViewProps) {
  const { history, deleteReport } = useAppStore();

  return (
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
              onLoadReport({
                content: report.content,
                sector: report.sector,
                format: report.format,
              });
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
  );
}
