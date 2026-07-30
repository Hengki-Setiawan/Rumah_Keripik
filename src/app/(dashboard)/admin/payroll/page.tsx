'use client';

import { useEffect, useState, useCallback } from 'react';
import { DollarSign, Calendar, Download, TrendingUp, Users, CheckCircle, Clock, FileText } from 'lucide-react';
import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

interface PayrollEntry {
  courierId: number;
  courierName: string;
  totalDeliveries: number;
  totalDistance: number;
  totalHours: number;
  basePay: number;
  bonus: number;
  penalty: number;
  totalPay: number;
  paid: boolean;
  paidAt: string | null;
}

const pdfStyles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: '#c55a2b' },
  subheader: { fontSize: 10, color: '#666', marginBottom: 20 },
  table: { width: '100%' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 6 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#333', paddingVertical: 6, fontWeight: 'bold', backgroundColor: '#faf6ef' },
  col1: { width: '25%' },
  col2: { width: '12%', textAlign: 'center' },
  col3: { width: '10%', textAlign: 'center' },
  col4: { width: '18%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  col6: { width: '10%', textAlign: 'right' },
  col7: { width: '10%', textAlign: 'right' },
  totalRow: { flexDirection: 'row', borderTopWidth: 2, borderTopColor: '#333', paddingVertical: 8, fontWeight: 'bold', marginTop: 4 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 8, color: '#999', textAlign: 'center' },
});

function PayrollPDF({ entries, period, totals }: { entries: PayrollEntry[]; period: string; totals: any }) {
  const periodLabel = period.split('-')[1] + '/' + period.split('-')[0];
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>Rumah Keripik — Laporan Payroll</Text>
        <Text style={pdfStyles.subheader}>Periode: {periodLabel} | Generated: {new Date().toLocaleDateString('id-ID')}</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.col1}>Kurir</Text>
            <Text style={pdfStyles.col2}>Delivery</Text>
            <Text style={pdfStyles.col3}>Jam</Text>
            <Text style={pdfStyles.col4}>Gaji Pokok</Text>
            <Text style={pdfStyles.col5}>Bonus</Text>
            <Text style={pdfStyles.col6}>Penalty</Text>
            <Text style={pdfStyles.col7}>Total</Text>
          </View>
          {entries.map((e) => (
            <View key={e.courierId} style={pdfStyles.row}>
              <Text style={pdfStyles.col1}>{e.courierName}</Text>
              <Text style={pdfStyles.col2}>{e.totalDeliveries}</Text>
              <Text style={pdfStyles.col3}>{e.totalHours.toFixed(1)}</Text>
              <Text style={pdfStyles.col4}>Rp {e.basePay.toLocaleString('id-ID')}</Text>
              <Text style={pdfStyles.col5}>Rp {e.bonus.toLocaleString('id-ID')}</Text>
              <Text style={pdfStyles.col6}>Rp {e.penalty.toLocaleString('id-ID')}</Text>
              <Text style={pdfStyles.col7}>Rp {e.totalPay.toLocaleString('id-ID')}</Text>
            </View>
          ))}
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.col1}>TOTAL ({entries.length} kurir)</Text>
            <Text style={pdfStyles.col2}>{totals.deliveries}</Text>
            <Text style={pdfStyles.col3}>{totals.hours.toFixed(1)}</Text>
            <Text style={pdfStyles.col4}>Rp {totals.basePay.toLocaleString('id-ID')}</Text>
            <Text style={pdfStyles.col5}>Rp {totals.bonus.toLocaleString('id-ID')}</Text>
            <Text style={pdfStyles.col6}>Rp {totals.penalty.toLocaleString('id-ID')}</Text>
            <Text style={pdfStyles.col7}>Rp {totals.totalPay.toLocaleString('id-ID')}</Text>
          </View>
        </View>
        <Text style={pdfStyles.footer}>Rumah Keripik — Laporan ini digenerate otomatis. Data berdasarkan shift & delivery terverifikasi.</Text>
      </Page>
    </Document>
  );
}

export default function PayrollPage() {
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/payroll/calculate?period=${period}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setEntries(d.data || []); })
      .finally(() => setLoading(false));
  }, [period]);

  const totals = entries.reduce(
    (acc, e) => ({
      deliveries: acc.deliveries + e.totalDeliveries,
      hours: acc.hours + e.totalHours,
      basePay: acc.basePay + e.basePay,
      bonus: acc.bonus + e.bonus,
      penalty: acc.penalty + e.penalty,
      totalPay: acc.totalPay + e.totalPay,
      paid: acc.paid + (e.paid ? 1 : 0),
    }),
    { deliveries: 0, hours: 0, basePay: 0, bonus: 0, penalty: 0, totalPay: 0, paid: 0 }
  );

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await pdf(<PayrollPDF entries={entries} period={period} totals={totals} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${period}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export gagal:', err);
    }
    setExporting(false);
  }, [entries, period, totals]);

  const handleExportCSV = useCallback(() => {
    const header = 'Kurir,Delivery,Jam,Gaji Pokok,Bonus,Penalty,Total,Status\n';
    const rows = entries.map((e) =>
      `"${e.courierName}",${e.totalDeliveries},${e.totalHours.toFixed(1)},${e.basePay},${e.bonus},${e.penalty},${e.totalPay},${e.paid ? 'Lunas' : 'Belum'}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries, period]);

  if (loading) return <div className="p-6 text-gray-500">Memuat data payroll...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign /> Payroll</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-1 text-sm bg-amber-500 text-white px-3 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            <FileText size={14} /> {exporting ? 'Mengenerate...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <SummaryCard icon={<Users />} label="Kurir" value={entries.length} color="blue" />
        <SummaryCard icon={<CheckCircle />} label="Delivery" value={totals.deliveries} color="emerald" />
        <SummaryCard icon={<Clock />} label="Jam Kerja" value={`${totals.hours}h`} color="purple" />
        <SummaryCard icon={<TrendingUp />} label="Bonus" value={`Rp ${totals.bonus.toLocaleString('id-ID')}`} color="amber" />
        <SummaryCard icon={<DollarSign />} label="Total Bayar" value={`Rp ${totals.totalPay.toLocaleString('id-ID')}`} color="green" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">Kurir</th>
              <th className="text-center p-3">Delivery</th>
              <th className="text-center p-3">Jam</th>
              <th className="text-center p-3">Gaji Pokok</th>
              <th className="text-center p-3">Bonus</th>
              <th className="text-center p-3">Penalty</th>
              <th className="text-center p-3">Total</th>
              <th className="text-center p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.courierId} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{e.courierName}</td>
                <td className="p-3 text-center">{e.totalDeliveries}</td>
                <td className="p-3 text-center">{e.totalHours.toFixed(1)}</td>
                <td className="p-3 text-center">Rp {e.basePay.toLocaleString('id-ID')}</td>
                <td className="p-3 text-center text-emerald-600">Rp {e.bonus.toLocaleString('id-ID')}</td>
                <td className="p-3 text-center text-red-500">{e.penalty > 0 ? `Rp ${e.penalty.toLocaleString('id-ID')}` : '-'}</td>
                <td className="p-3 text-center font-semibold">Rp {e.totalPay.toLocaleString('id-ID')}</td>
                <td className="p-3 text-center">
                  {e.paid
                    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Lunas</span>
                    : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Belum</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', purple: 'text-purple-500', amber: 'text-amber-500', green: 'text-green-500' };
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <div className={`${colors[color] || 'text-gray-500'} mb-1`}>{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
