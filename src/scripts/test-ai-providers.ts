import { config } from 'dotenv';

// Load environment BEFORE importing any database or API wrappers
config({ path: '.env.local' });
config({ path: '.env' });

async function testProvider(name: string, testFn: () => Promise<{ text: string; provider: string; model: string }>) {
  console.log(`\nTesting AI Provider [${name}]...`);
  const start = Date.now();
  try {
    const res = await testFn();
    const duration = Date.now() - start;
    console.log(`✅ [${name}] Succeeded in ${duration}ms!`);
    console.log(`   - Model: ${res.model}`);
    console.log(`   - Output: "${res.text.trim().replace(/\n/g, ' ')}"`);
    return { ok: true, name, latency: duration };
  } catch (error: any) {
    const duration = Date.now() - start;
    console.log(`❌ [${name}] Failed after ${duration}ms!`);
    console.log(`   - Error: ${error.message || String(error)}`);
    return { ok: false, name, error: error.message || String(error) };
  }
}

async function main() {
  console.log("=== AI PROVIDERS DIAGNOSTIC TEST ===");

  // Dynamically import libraries so environment variables are already loaded
  const { generateGeminiText } = await import('../lib/gemini');
  const { callGroqLLM } = await import('../lib/groq');
  const { defaultProviderConfigs } = await import('../lib/ai/model-router');
  const { callOpenAICompatibleProvider } = await import('../lib/ai/openai-compatible');

  const results = [];

  // 1. Gemini
  if (process.env.GEMINI_API_KEY) {
    results.push(await testProvider('Gemini 2.0 Flash', async () => {
      return generateGeminiText(
        [{ role: 'user', content: 'Say "Gemini OK"' }],
        15,
        0,
        'Jawab singkat.',
        'gemini-2.5-flash'
      );
    }));
  } else {
    console.log('\n⚠️ [Gemini] Skipped: GEMINI_API_KEY is not configured in .env.local');
  }

  // 2. Cerebras
  if (process.env.CEREBRAS_API_KEY) {
    const cerebrasConfig = defaultProviderConfigs.find(p => p.id === 'cerebras') || {
      id: 'cerebras',
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKeyEnv: 'CEREBRAS_API_KEY',
      defaultModel: 'qwen-3-32b',
      enabled: true,
      supportsToolCalling: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      maxOutputTokensDefault: 260,
      priority: 2
    };

    results.push(await testProvider('Cerebras Llama/Qwen', async () => {
      const input = {
        task: 'faq_answer' as const,
        systemPrompt: 'Jawab singkat.',
        messages: [{ role: 'user' as const, content: 'Say "Cerebras OK"' }],
      };
      return callOpenAICompatibleProvider(cerebrasConfig, input, 15, 0);
    }));
  } else {
    console.log('\n⚠️ [Cerebras] Skipped: CEREBRAS_API_KEY is not configured in .env.local');
  }

  // 3. Groq
  if (process.env.GROQ_API_KEY) {
    results.push(await testProvider('Groq 8B', async () => {
      const res = await callGroqLLM(
        [{ role: 'user', content: 'Say "Groq OK"' }],
        15,
        0,
        'Jawab singkat.'
      );
      return { text: res.text, provider: res.provider, model: res.model || 'groq-default' };
    }));
  } else {
    console.log('\n⚠️ [Groq] Skipped: GROQ_API_KEY is not configured in .env.local');
  }

  console.log("\n====================================");
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    console.log(`❌ Diagnostic failed: ${failed.length} AI providers returned errors.`);
    process.exit(1);
  } else {
    console.log("✅ All configured AI providers are working perfectly!");
  }
}

main().catch(error => {
  console.error("Diagnostic execution error:", error);
  process.exit(1);
});
