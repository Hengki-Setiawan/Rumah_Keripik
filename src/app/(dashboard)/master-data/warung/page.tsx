import { redirect } from 'next/navigation';

export default function WarungPage() {
  redirect('/master-data/pelanggan?tab=warung');
}
