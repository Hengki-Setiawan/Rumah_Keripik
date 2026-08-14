'use server';

import { db } from '@/lib/db';
import { broadcastCampaign, broadcastTemplate } from '@/lib/schema';
import { eq, desc, like, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getCampaigns() {
  try {
    return await db
      .select()
      .from(broadcastCampaign)
      .orderBy(desc(broadcastCampaign.created_at))
      .limit(50);
  } catch (error) {
    return [];
  }
}

export async function createCampaign(data: {
  nama: string;
  pesan: string;
  target_tags: string[];
}) {
  try {
    await db.insert(broadcastCampaign).values({
      nama: data.nama,
      pesan: data.pesan,
      target_tags: JSON.stringify(data.target_tags),
    });
    revalidatePath('/broadcast');
    return { success: true, message: 'Campaign berhasil dibuat' };
  } catch (error) {
    return { success: false, message: 'Gagal membuat campaign' };
  }
}

export async function sendCampaign(id: number) {
  // Broadcast WhatsApp dinonaktifkan (Fonnte hanya untuk OTP & notifikasi kurir).
  try {
    const [campaign] = await db
      .select()
      .from(broadcastCampaign)
      .where(eq(broadcastCampaign.id, id))
      .limit(1);

    if (!campaign) return { success: false, message: 'Campaign tidak ditemukan' };

    await db
      .update(broadcastCampaign)
      .set({
        status: 'sent',
        sent_count: 0,
        total_count: 0,
        sent_at: sql`(datetime('now', 'utc'))`,
      })
      .where(eq(broadcastCampaign.id, id));

    revalidatePath('/broadcast');
    return { success: false, message: 'Broadcast WhatsApp dinonaktifkan — tidak ada pesan terkirim' };
  } catch (error) {
    return { success: false, message: 'Gagal mengirim campaign' };
  }
}

export async function deleteCampaign(id: number) {
  try {
    await db.delete(broadcastCampaign).where(eq(broadcastCampaign.id, id));
    revalidatePath('/broadcast');
    return { success: true, message: 'Campaign berhasil dihapus' };
  } catch (error) {
    return { success: false, message: 'Gagal hapus campaign' };
  }
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

export async function getTemplates() {
  try {
    return await db
      .select()
      .from(broadcastTemplate)
      .orderBy(desc(broadcastTemplate.created_at))
      .limit(50);
  } catch (error) {
    return [];
  }
}

export async function createTemplate(data: { nama: string; konten: string; kategori: string }) {
  try {
    await db.insert(broadcastTemplate).values(data as any);
    revalidatePath('/broadcast');
    return { success: true, message: 'Template berhasil dibuat' };
  } catch (error) {
    return { success: false, message: 'Gagal membuat template' };
  }
}

export async function deleteTemplate(id: number) {
  try {
    await db.delete(broadcastTemplate).where(eq(broadcastTemplate.id, id));
    revalidatePath('/broadcast');
    return { success: true, message: 'Template berhasil dihapus' };
  } catch (error) {
    return { success: false, message: 'Gagal hapus template' };
  }
}
