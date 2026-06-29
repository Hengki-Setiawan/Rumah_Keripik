'use client';

import { useState, useEffect } from 'react';
import { getAutoReplyRules, addAutoReplyRule, updateAutoReplyRule, deleteAutoReplyRule, getChatLogs, getChatStats } from '@/actions/bot-config';
import { Plus, X, Search, ToggleLeft, ToggleRight, Trash2, Bot, MessageSquare } from 'lucide-react';

export default function BotConfigPage() {
  const [tab, setTab] = useState<'rules' | 'logs'>('rules');
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, rules: 0, groq: 0, notFound: 0, total_tokens: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ keyword: '', response: '' });

  useEffect(() => {
    fetchData().catch(console.error);
  }, []);

  async function fetchData() {
    const [r, s] = await Promise.all([getAutoReplyRules(), getChatStats()]);
    setRules(r);
    setStats(s);
    setLoading(false);
  }

  async function fetchLogs() {
    setLogs(await getChatLogs());
  }

  useEffect(() => {
    if (tab === 'logs') fetchLogs().catch(console.error);
  }, [tab]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.keyword.trim() || !form.response.trim()) return;
    const res = await addAutoReplyRule(form);
    if (res.success) {
      setForm({ keyword: '', response: '' });
      setShowForm(false);
      setMessage({ type: 'success', text: 'Rule berhasil ditambah' });
      fetchData();
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal tambah rule' });
    }
  }

  async function handleToggle(id: number, current: number) {
    await updateAutoReplyRule(id, { is_active: current ? 0 : 1 });
    fetchData();
  }

  async function handleDelete(id: number) {
    await deleteAutoReplyRule(id);
    setMessage({ type: 'success', text: 'Rule berhasil dihapus' });
    fetchData();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Bot Configuration</h1>
        <p className="text-gray-600">Atur perilaku chatbot, auto reply rules, dan pantau penggunaan</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}><X size={16} /></button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Chat</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Dijawab Rule</p>
          <p className="text-2xl font-bold text-green-600">{stats.rules}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Pake AI (token)</p>
          <p className="text-2xl font-bold text-orange-600">{stats.groq}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Token Terpakai</p>
          <p className="text-2xl font-bold text-blue-600">~{stats.total_tokens}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('rules')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
            tab === 'rules' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Bot size={16} /> Auto Reply Rules
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
            tab === 'logs' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <MessageSquare size={16} /> Conversation Log
        </button>
      </div>

      {tab === 'rules' && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {rules.length} rule — chat cocok keyword → langsung balas (0 token)
            </p>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
            >
              <Plus size={16} /> Tambah Rule
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleAdd} className="p-4 bg-orange-50 border-b border-orange-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Keyword</label>
                  <input
                    value={form.keyword}
                    onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                    placeholder="contoh: harga"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Response</label>
                  <textarea
                    value={form.response}
                    onChange={(e) => setForm({ ...form, response: e.target.value })}
                    placeholder="Balasan otomatis untuk keyword ini"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button type="submit" className="px-4 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                  Simpan
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                  Batal
                </button>
              </div>
            </form>
          )}

          {rules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bot size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Belum ada auto reply rule</p>
              <p className="text-sm">Tambah rule untuk menghemat token AI</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left px-4 py-3 font-medium">Keyword</th>
                    <th className="text-left px-4 py-3 font-medium">Response</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-center px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-mono">
                          {rule.keyword}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-md truncate">{rule.response}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggle(rule.id, rule.is_active)}>
                          {rule.is_active ? (
                            <ToggleRight size={20} className="text-green-600" />
                          ) : (
                            <ToggleLeft size={20} className="text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">Riwayat percakapan chatbot (50 terakhir)</p>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Belum ada percakapan</p>
              <p className="text-sm">Riwayat akan muncul setelah WA online</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left px-4 py-3 font-medium">Waktu</th>
                    <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                    <th className="text-left px-4 py-3 font-medium">Pesan</th>
                    <th className="text-center px-4 py-3 font-medium">Sumber</th>
                    <th className="text-right px-4 py-3 font-medium">Token</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">{log.no_wa_pelanggan}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-gray-900">{log.user_message}</p>
                        {log.bot_response && (
                          <p className="truncate text-gray-500 text-xs mt-0.5">→ {log.bot_response}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          log.sumber === 'rule' ? 'bg-green-100 text-green-700' :
                          log.sumber === 'groq' ? 'bg-orange-100 text-orange-700' :
                          log.sumber === 'gemini' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {log.sumber}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.tokens_used || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
