import { NextResponse } from 'next/server';
import { requireAdminRole, isUnauthorizedAdminError, isForbiddenAdminPermissionError } from '@/lib/admin-actor';
import {
  getBanditConfig,
  getBanditState,
  armExpectedReward,
  armRewardStd,
  setBanditConfig,
} from '@/lib/ai/bandit';

export async function GET() {
  try {
    await requireAdminRole('audit:read');
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Auth error' }, { status: 401 });
  }

  const [config, state] = await Promise.all([getBanditConfig(), getBanditState()]);

  const arms = Object.entries(state).flatMap(([task, providers]) =>
    Object.entries(providers).map(([provider, stats]) => ({
      task,
      provider,
      pulls: stats.pulls,
      expectedReward: Number(armExpectedReward(stats).toFixed(3)),
      rewardStd: Number(armRewardStd(stats).toFixed(3)),
      successRate: stats.pulls > 0 ? Number((stats.successCount / stats.pulls).toFixed(3)) : 0,
      latencyEmaMs: Math.round(stats.latencyEmaMs),
      alpha: Number(stats.alpha.toFixed(2)),
      beta: Number(stats.beta.toFixed(2)),
    })),
  );

  return NextResponse.json({ ok: true, data: { config, arms } });
}

export async function POST(request: Request) {
  try {
    await requireAdminRole('chat:manage');
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Auth error' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // {"action":"reset"} — bersihkan semua posterior
  if (body.action === 'reset') {
    const { resetBanditState } = await import('@/lib/ai/bandit');
    await resetBanditState();
    return NextResponse.json({ ok: true, data: { reset: true } });
  }

  // {"config": { enabled?, epsilon?, weights? }}
  if (body.config) {
    const config = await setBanditConfig(body.config);
    return NextResponse.json({ ok: true, data: { config } });
  }

  return NextResponse.json({ ok: false, error: 'Aksi tidak dikenali. Gunakan {action:"reset"} atau {config:{...}}' }, { status: 400 });
}