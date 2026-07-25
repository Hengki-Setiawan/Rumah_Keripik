'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, Truck, Bot, BarChart3 } from 'lucide-react';

interface SloMetric {
  sloTarget: string;
  sloSatisfied: boolean;
}

interface AiChatSlo extends SloMetric {
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalCalls: number;
  errorRate: number;
}

interface OrderSlo extends SloMetric {
  rate: number;
  total: number;
  completed: number;
}

interface DeliverySlo extends SloMetric {
  rate: number;
  total: number;
  delivered: number;
}

interface SloData {
  aiChat: AiChatSlo;
  orderCompletion: OrderSlo;
  deliverySuccess: DeliverySlo;
}

export default function SloDashboardPage() {
  const [data, setData] = useState<SloData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/slo')
      .then((r) => r.json())
      .then((res) => { if (res.ok) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Memuat SLO...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 /> Service Level Objectives</h1>
      <p className="text-gray-500 text-sm">Rolling 7-hari — target SLO untuk setiap metrik</p>

      <div className="grid grid-cols-3 gap-4">
        <div className={`bg-white p-5 rounded-xl border ${data?.aiChat.sloSatisfied ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <Bot size={20} className="text-blue-500" />
            {data?.aiChat.sloSatisfied ? <CheckCircle size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
          </div>
          <h3 className="font-semibold text-sm mb-1">AI Chat Response</h3>
          <div className="text-2xl font-bold">{data?.aiChat.avgLatencyMs}<span className="text-sm font-normal text-gray-500">ms</span></div>
          <div className="text-xs text-gray-500 mt-1">
            P95: {data?.aiChat.p95LatencyMs}ms | Error: {(data && (data.aiChat.errorRate * 100).toFixed(1)) || '0'}%
          </div>
          <div className="text-xs mt-2 text-gray-400">Target: {data?.aiChat.sloTarget} | {data?.aiChat.totalCalls} calls</div>
        </div>

        <div className={`bg-white p-5 rounded-xl border ${data?.orderCompletion.sloSatisfied ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <Activity size={20} className="text-purple-500" />
            {data?.orderCompletion.sloSatisfied ? <CheckCircle size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
          </div>
          <h3 className="font-semibold text-sm mb-1">Order Completion</h3>
          <div className="text-2xl font-bold">{data?.orderCompletion.rate}<span className="text-sm font-normal text-gray-500">%</span></div>
          <div className="text-xs text-gray-500 mt-1">
            {data?.orderCompletion.completed}/{data?.orderCompletion.total} selesai
          </div>
          <div className="text-xs mt-2 text-gray-400">Target: {data?.orderCompletion.sloTarget}</div>
        </div>

        <div className={`bg-white p-5 rounded-xl border ${data?.deliverySuccess.sloSatisfied ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <Truck size={20} className="text-amber-500" />
            {data?.deliverySuccess.sloSatisfied ? <CheckCircle size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
          </div>
          <h3 className="font-semibold text-sm mb-1">Delivery Success</h3>
          <div className="text-2xl font-bold">{data?.deliverySuccess.rate}<span className="text-sm font-normal text-gray-500">%</span></div>
          <div className="text-xs text-gray-500 mt-1">
            {data?.deliverySuccess.delivered}/{data?.deliverySuccess.total} terkirim
          </div>
          <div className="text-xs mt-2 text-gray-400">Target: {data?.deliverySuccess.sloTarget}</div>
        </div>
      </div>
    </div>
  );
}