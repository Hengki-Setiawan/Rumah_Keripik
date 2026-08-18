import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { skillDrafts } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { adminAuthErrorResponse, requireAdminRole } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('chat:manage');
    const drafts = await db.select().from(skillDrafts).orderBy(desc(skillDrafts.createdAt));
    return NextResponse.json({ ok: true, drafts });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[ADMIN_SKILL_DRAFTS]', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminRole('chat:manage');
    const body = await req.json();
    const { sourceType, sourceChatSessionId, sourceConversationExcerpt, draftMarkdown, proposedName, proposedDescription } = body;

    const id = `SKILL-DRAFT-${Date.now()}`;
    await db.insert(skillDrafts).values({
      id,
      sourceType: sourceType || 'admin_correction',
      sourceChatSessionId: sourceChatSessionId || null,
      sourceConversationExcerpt: sourceConversationExcerpt || null,
      draftMarkdown: draftMarkdown || '# Instructions\n\n1. Be helpful.',
      proposedName: proposedName || 'Draft Skill Baru',
      proposedDescription: proposedDescription || 'Deskripsi pemicu skill baru.',
      status: 'pending_review',
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[ADMIN_SKILL_DRAFTS]', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminRole('chat:manage');
    const body = await req.json();
    const { id, action, rejectionReason } = body;

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'Parameters invalid' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db
      .update(skillDrafts)
      .set({
        status: newStatus,
        reviewedAt: new Date().toISOString(),
        rejectionReason: rejectionReason || null,
      })
      .where(eq(skillDrafts.id, id));

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[ADMIN_SKILL_DRAFTS]', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
