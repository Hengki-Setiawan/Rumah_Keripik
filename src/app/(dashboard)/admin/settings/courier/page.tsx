'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface CourierSettings {
  geofenceRadius: number;
  locationInterval: number;
  locationRetentionDays: number;
  leaderboardEnabled: boolean;
  emergencyPhone: string;
  scoreOnTimeWeight: number;
  scoreCompletionWeight: number;
  scoreIncidentPenalty: number;
}

const DEFAULTS: CourierSettings = {
  geofenceRadius: 100,
  locationInterval: 12,
  locationRetentionDays: 60,
  leaderboardEnabled: true,
  emergencyPhone: '',
  scoreOnTimeWeight: 40,
  scoreCompletionWeight: 40,
  scoreIncidentPenalty: 10,
};

export default function CourierSettingsPage() {
  const [settings, setSettings] = useState<CourierSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('courier_admin_settings');
    if (raw) {
      try { setSettings({ ...DEFAULTS, ...JSON.parse(raw) }); } catch {}
    }
    setLoading(false);
  }, []);

  function update<K extends keyof CourierSettings>(key: K, value: CourierSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  const [savedMsg, setSavedMsg] = useState('');

  function save() {
    setSaving(true);
    localStorage.setItem('courier_admin_settings', JSON.stringify(settings));
    setTimeout(() => { setSaving(false); setSavedMsg('Tersimpan!'); setTimeout(() => setSavedMsg(''), 3000); }, 500);
  }

  if (loading) return <div className="p-6"><p className="text-muted-foreground">Memuat...</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Pengaturan Kurir</h1>

      <Card>
        <CardHeader><CardTitle>Geofence & Lokasi</CardTitle><CardDescription>Radius deteksi kurir tiba dan interval sinkronisasi</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Radius Geofence (meter)</Label>
              <Input type="number" value={settings.geofenceRadius} onChange={e => update('geofenceRadius', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Interval Lokasi (detik)</Label>
              <Input type="number" value={settings.locationInterval} onChange={e => update('locationInterval', Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Retensi Data Lokasi (hari)</Label>
            <Input type="number" value={settings.locationRetentionDays} onChange={e => update('locationRetentionDays', Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Skor Performa</CardTitle><CardDescription>Bobot formula skor komposit kurir (0-100)</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Bobot Tepat Waktu</Label>
              <Input type="number" value={settings.scoreOnTimeWeight} onChange={e => update('scoreOnTimeWeight', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Bobot Penyelesaian</Label>
              <Input type="number" value={settings.scoreCompletionWeight} onChange={e => update('scoreCompletionWeight', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Penalti Insiden</Label>
              <Input type="number" value={settings.scoreIncidentPenalty} onChange={e => update('scoreIncidentPenalty', Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lainnya</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Leaderboard</Label><p className="text-sm text-muted-foreground">Tampilkan peringkat antar kurir</p></div>
            <button
              onClick={() => update('leaderboardEnabled', !settings.leaderboardEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.leaderboardEnabled ? 'bg-amber-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.leaderboardEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <Separator />
          <div className="space-y-1">
            <Label>Nomor Darurat Admin</Label>
            <Input placeholder="62812xxxxxx" value={settings.emergencyPhone} onChange={e => update('emergencyPhone', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button>
        {savedMsg && <span className="text-sm text-emerald-600 font-medium">{savedMsg}</span>}
      </div>
    </div>
  );
}
