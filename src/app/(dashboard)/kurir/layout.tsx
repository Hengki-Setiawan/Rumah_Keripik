'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BarChart3, CalendarCheck, Map as MapIcon, MapPinned, ReceiptText, Route as RouteIcon, Truck, Users, Wrench } from 'lucide-react';

const tabs = [
  { href: '/kurir', label: 'Roster', icon: Users },
  { href: '/kurir/assign', label: 'Assign', icon: Truck },
  { href: '/kurir/live', label: 'Live Map', icon: MapIcon },
  { href: '/kurir/rute', label: 'Rute', icon: RouteIcon },
  { href: '/kurir/dispatch', label: 'Dispatch', icon: RouteIcon },
  { href: '/kurir/payroll', label: 'Payroll', icon: ReceiptText },
  { href: '/kurir/absensi', label: 'Absensi', icon: CalendarCheck },
  { href: '/kurir/kendaraan', label: 'Kendaraan', icon: Wrench },
  { href: '/kurir/performa', label: 'Performa', icon: Activity },
  { href: '/kurir/analitik', label: 'Analitik', icon: BarChart3 },
  { href: '/kurir/zona', label: 'Zona', icon: MapPinned },
  { href: '/kurir/riwayat', label: 'Riwayat', icon: MapIcon },
];

export default function KurirLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 max-w-7xl mx-auto flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = pathname === t.href || (t.href !== '/kurir' && pathname.startsWith(t.href));
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="px-6 max-w-7xl mx-auto py-6">{children}</div>
    </div>
  );
}