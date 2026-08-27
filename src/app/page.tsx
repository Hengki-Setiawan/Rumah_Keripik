import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams?: Promise<{ verify?: string }> }) {
  const headerList = await headers();
  const host = headerList.get('host') || '';

  // 1. Jika diakses dari domain Admin (rumah-keripik-admin.pages.dev atau admin.*)
  if (host.includes('admin') || process.env.APP_PROFILE === 'admin') {
    redirect('/dashboard');
  }

  // 2. Jika diakses dari domain Toko Publik (rumah-keripik.pages.dev)
  // Langsung tampilkan UI Toko & Pemesanan tanpa perlu /pesan
  const { ChatShell } = await import('@/features/chat/ChatShell');
  const params = searchParams ? await searchParams : {};
  return <ChatShell verify={params.verify} />;
}
