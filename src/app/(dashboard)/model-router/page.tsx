import { getModelRouterSettings } from '@/actions/ai-ops';
import { ModelRouterClient } from '@/components/dashboard/ModelRouterClient';
import { ModelRouterHealthPanel } from '@/components/dashboard/ModelRouterHealthPanel';

export const dynamic = 'force-dynamic';

export default async function ModelRouterPage() {
  const settings = await getModelRouterSettings();
  return <div className="space-y-6"><ModelRouterHealthPanel /><ModelRouterClient providerConfigs={settings.providerConfigs} taskConfigs={settings.taskConfigs} /></div>;
}
