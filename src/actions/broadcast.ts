'use server';

import { db } from '@/lib/db';
import { broadcastCampaign, broadcastTemplate, pelangganChatbot, pesanChat } from '@/lib/schema';
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
  try {
    const [campaign] = await db
      .select()
      .from(broadcastCampaign)
      .where(eq(broadcastCampaign.id, id))
      .limit(1);

    if (!campaign) return { success: false, message: 'Campaign tidak ditemukan' };

    await db
      .update(broadcastCampaign)
      .set({ status: 'sending' })
      .where(eq(broadcastCampaign.id, id));

    const targetTags = JSON.parse(campaign.target_tags || '[]');
    let pelangganList;

    if (targetTags.length === 0) {
      pelangganList = await db
        .select()
        .from(pelangganChatbot)
        .where(eq(pelangganChatbot.status_handle, 'AI_Bot'))
        .limit(200);
    } else {
      pelangganList = await db
        .select()
        .from(pelangganChatbot)
        .limit(200);

      pelangganList = pelangganList.filter((p: any) => {
        const tags = JSON.parse(p.tags || '[]');
        return targetTags.some((t: string) => tags.includes(t));
      });
    }

    let sentCount = 0;
    for (const p of pelangganList) {
      try {
        const res = await fetch(
          `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE_NAME}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EVOLUTION_API_KEY || '',
            },
            body: JSON.stringify({ number: p.no_wa_pelanggan, text: campaign.pesan }),
          }
        );

        let id_external: string | null = null;
        if (res.ok) {
          const data = await res.json();
          id_external = data?.key?.id ?? data?.messageId ?? null;
        }

        await db.insert(pesanChat).values({
          no_wa_pelanggan: p.no_wa_pelanggan,
          direction: 'out',
          sumber: 'sistem',
          teks: campaign.pesan,
          id_external,
          status_kirim: res.ok ? 'sent' : 'failed',
        });

        if (res.ok) sentCount++;
      } catch {
        // skip failed sends
      }
    }

    await db
      .update(broadcastCampaign)
      .set({
        status: 'sent',
        sent_count: sentCount,
        total_count: pelangganList.length,
        sent_at: sql`(datetime('now', 'utc'))`,
      })
      .where(eq(broadcastCampaign.id, id));

    revalidatePath('/broadcast');
    return { success: true, message: `Pesan terkirim ke ${sentCount}/${pelangganList.length} pelanggan` };
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
