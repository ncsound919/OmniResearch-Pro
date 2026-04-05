import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';

export default function SettingsView() {
  const [slackToken, setSlackToken] = useState(() => localStorage.getItem('slackToken') || "");
  const [notionKey, setNotionKey] = useState(() => localStorage.getItem('notionKey') || "");
  const [notionDb, setNotionDb] = useState(() => localStorage.getItem('notionDb') || "");

  const handleSaveSettings = () => {
    localStorage.setItem('slackToken', slackToken);
    localStorage.setItem('notionKey', notionKey);
    localStorage.setItem('notionDb', notionDb);
    toast.success("Settings saved successfully.");
  };

  return (
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
  );
}
