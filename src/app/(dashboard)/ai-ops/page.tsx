'use client';

import { useEffect, useState } from 'react';
import { Cpu, DollarSign, Activity, AlertTriangle, BarChart3 } from 'lucide-react';

interface ProviderUsage { provider: string; totalTokens: number; totalCalls: number; errorCount: number; avgLatencyMs: number }
interface DailyUsage { date: string; provider: string; totalTokens: number; totalCalls: number }
interface TaskDist { task: string; totalCalls: number; errorCount: number; errorRate: number }

export default function AiOpsPage() {
  const [providerUsage, setProviderUsage] = useState<ProviderUsage[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [taskDist, setTaskDist] = useState<TaskDist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/ai-ops/provider-usage').then((r) => r.json()),
      fetch('/api/admin/ai-ops/daily-usage').then((r) => r.json()),
      fetch('/api/admin/ai-ops/task-distribution').then((r) => r.json()),
    ]).then(([p, d, t]) => {
      if (p.ok) setProviderUsage(p.data);
      if (d.ok) setDailyUsage(d.data);
      if (t.ok) setTaskDist(t.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Memuat data AI Ops...</div>;

  const totalCost = providerUsage.reduce((sum, p) => sum + p.totalCalls * 0.0005, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu /> AI Operations</h1>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <Activity size={20} className="text-blue-500 mb-1" />
          <div className="text-2xl font-bold">{providerUsage.reduce((s, p) => s + p.totalCalls, 0)}</div>
          <div className="text-sm text-gray-500">Total Panggilan</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <DollarSign size={20} className="text-emerald-500 mb-1" />
          <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
          <div className="text-sm text-gray-500">Estimasi Biaya</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <AlertTriangle size={20} className="text-red-500 mb-1" />
          <div className="text-2xl font-bold">{providerUsage.reduce((s, p) => s + p.errorCount, 0)}</div>
          <div className="text-sm text-gray-500">Error</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <BarChart3 size={20} className="text-purple-500 mb-1" />
          <div className="text-2xl font-bold">{providerUsage.length}</div>
          <div className="text-sm text-gray-500">Provider Aktif</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h2 className="font-semibold mb-3">Per Provider</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Provider</th><th>Panggilan</th><th>Token</th><th>Error</th><th>Latensi</th></tr></thead>
            <tbody>
              {providerUsage.map((p) => (
                <tr key={p.provider} className="border-t">
                  <td className="py-2 font-medium">{p.provider}</td>
                  <td className="py-2">{p.totalCalls}</td>
                  <td className="py-2">{p.totalTokens}</td>
                  <td className="py-2"><span className={p.errorCount > 0 ? 'text-red-600' : 'text-gray-500'}>{p.errorCount}</span></td>
                  <td className="py-2">{p.avgLatencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h2 className="font-semibold mb-3">Distribusi Tugas</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Tugas</th><th>Panggilan</th><th>Error</th><th>Rate</th></tr></thead>
            <tbody>
              {taskDist.map((t) => (
                <tr key={t.task} className="border-t">
                  <td className="py-2">{t.task}</td>
                  <td className="py-2">{t.totalCalls}</td>
                  <td className="py-2">{t.errorCount}</td>
                  <td className="py-2">{(t.errorRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
