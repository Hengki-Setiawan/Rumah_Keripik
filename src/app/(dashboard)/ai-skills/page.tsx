import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AiSkillsPage() {
  redirect('/ai-workspace?tab=skills');
}
