import { generateTextWithRouter } from '@/lib/ai/model-router';
import { runChatTool } from '@/lib/ai/tool-registry';
import { toolSchemaRegistry } from '@/lib/ai/tool-schemas';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { getChatCart } from '@/lib/ai/tools/cart';
import { recommendProducts } from '@/lib/ai/tools/products';
import { searchKnowledgeBase } from '@/lib/knowledge/retrieval';
import { loadAllSkillMetadata, loadFullSkill } from '@/lib/ai/skill-loader';
import type { CustomerContextDto, ChatComponent } from '@/lib/chat-v3/types';
import { AGENT_LOOP_SYSTEM_PROMPT } from '@/lib/ai/prompts/agent-loop';
import type { AIChatIntent } from '@/lib/chat-v3/types';

type ScratchpadEntry =
  | { type: 'observation'; tool: string; result: string }
  | { type: 'validation_error'; tool: string; detail: string }
  | { type: 'tool_error'; tool: string; message: string }
  | { type: 'reasoning'; content: string };

export type AgentLoopResult = {
  reply: string;
  intent: AIChatIntent;
  components: ChatComponent[];
  scratchpad: ScratchpadEntry[];
  iterationsUsed: number;
  stoppedReason: 'goal_complete' | 'needs_confirmation' | 'max_iterations' | 'provider_exhausted';
};

type AgentLoopInput = {
  chatSessionId: string;
  userMessage: string;
  maxIterations?: number;
};

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const { chatSessionId, userMessage, maxIterations = 4 } = input;

  const [history, customerContext, cart] = await Promise.all([
    getCustomerContextForChat(chatSessionId),
    getCustomerContextForChat(chatSessionId),
    getChatCart(chatSessionId),
  ]);

  const knowledgeChunks = await searchKnowledgeBase({ query: userMessage, topK: 3 }).catch(() => []);
  const availableSkills = loadAllSkillMetadata();
  const matchedSkill = availableSkills.find((s) =>
    userMessage.toLowerCase().includes(s.name.split('-')[0]) ||
    s.description.toLowerCase().split(' ').some((w) => w.length > 4 && userMessage.toLowerCase().includes(w))
  );
  const activeSkillFull = matchedSkill ? loadFullSkill(matchedSkill.filePath) : null;

  let scratchpad: ScratchpadEntry[] = [];
  const previousToolCalls: Array<{ tool: string; args: string }> = [];

  const AGENTIC_TOOLS = [
    'search_products', 'searchProducts',
    'recommend_products', 'recommendProducts',
    'add_to_cart', 'addToCart',
    'update_cart_item', 'updateCartItem',
    'get_cart', 'getCart',
    'get_payment_methods', 'getPaymentMethods',
    'check_customer_session', 'get_customer_profile', 'get_customer_addresses',
    'find_or_create_customer', 'findOrCreateCustomer',
    'save_customer_address', 'saveCustomerAddress',
    'save_location', 'saveLocation',
    'select_payment_method', 'selectPaymentMethod',
    'get_order_status',
    'search_knowledge_base',
    'request_admin_handoff', 'requestAdminHandoff',
  ].join(', ');

  let selectPaymentMethodCalled = false;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const scratchpadText = scratchpad.length > 0
      ? scratchpad.map((entry, i) => {
          switch (entry.type) {
            case 'reasoning': return `[Langkah ${i + 1}] Pikiran: ${entry.content}`;
            case 'observation': return `[Langkah ${i + 1}] Hasil ${entry.tool}: ${entry.result}`;
            case 'validation_error': return `[Langkah ${i + 1}] Error validasi ${entry.tool}: ${entry.detail}`;
            case 'tool_error': return `[Langkah ${i + 1}] Error ${entry.tool}: ${entry.message}`;
          }
        }).join('\n')
      : 'Belum ada langkah sebelumnya.';

    const contextPrompt = [
      AGENT_LOOP_SYSTEM_PROMPT,
      `Iterasi ke-${iteration + 1} dari maksimal ${maxIterations}.`,
      `Cart aktif: ${cart.itemCount} item, total Rp${cart.total.toLocaleString('id-ID')}.`,
      customerContext.customer ? `Customer dikenal: ${customerContext.customer.name || customerContext.customer.id}.` : 'Customer belum identified.',
      customerContext.defaultAddress ? `Alamat default: ${customerContext.defaultAddress.addressSummary}.` : 'Alamat default belum tersedia.',
      availableSkills.length > 0 ? `SKILLS TERSEDIA (Layer 1 Metadata):\n${availableSkills.map((s) => `- ${s.name}: ${s.description}`).join('\n')}` : '',
      activeSkillFull ? `\n[ACTIVE SKILL INSTRUCTIONS - ${activeSkillFull.name}]\n${activeSkillFull.instructions}` : '',
      knowledgeChunks.length > 0 ? `Knowledge base relevan:\n${knowledgeChunks.map((chunk, i) => `[${i + 1}] ${chunk.judul}: ${chunk.teks.slice(0, 200)}`).join('\n')}` : '',
      `\nRIWAYAT LANGKAH DI GILIRAN INI:\n${scratchpadText}`,
      `\nPESAN PELANGGAN:\n${userMessage}`,
      `\nTOOL YANG TERSEDIA:\n${AGENTIC_TOOLS}`,
      '\nKeluarkan dalam format JSON: {"reasoning": "...", "decision": "call_tool" | "goal_complete" | "needs_confirmation", "toolName": "...", "toolArgs": {}, "replyDraft": "..."}',
    ].filter(Boolean).join('\n\n');

    let llmOutput: { reasoning?: string; decision?: string; toolName?: string; toolArgs?: Record<string, unknown>; replyDraft?: string } = {};

    try {
      const result = await generateTextWithRouter({
        task: 'agentic_reasoning',
        chatSessionId,
        systemPrompt: contextPrompt,
        messages: [{ role: 'user', content: `Iterasi ${iteration + 1}: lanjutkan proses berdasarkan riwayat di atas.` }],
        maxTokens: 400,
        temperature: 0.15,
      });

      try {
        llmOutput = JSON.parse(result.text);
      } catch {
        const match = result.text.match(/\{[\s\S]*\}/);
        if (match) {
          try { llmOutput = JSON.parse(match[0]); } catch { llmOutput = {}; }
        }
      }
    } catch {
      return {
        reply: 'Maaf kak, asisten sedang sibuk. Coba ulangi pesan kakak ya.',
        intent: 'small_talk',
        components: defaultQuickReplies(),
        scratchpad,
        iterationsUsed: iteration + 1,
        stoppedReason: 'provider_exhausted',
      };
    }

    const decision = llmOutput.decision || 'goal_complete';
    const reasoning = llmOutput.reasoning || '';
    const toolName = llmOutput.toolName || '';
    const toolArgs = llmOutput.toolArgs || {};

    scratchpad.push({ type: 'reasoning', content: reasoning });

    if (decision === 'goal_complete') {
      const reply = llmOutput.replyDraft || 'Siap kak, ada yang bisa dibantu lagi?';
      return {
        reply,
        intent: inferIntent(reply, scratchpad),
        components: defaultQuickReplies(),
        scratchpad,
        iterationsUsed: iteration + 1,
        stoppedReason: 'goal_complete',
      };
    }

    if (decision === 'needs_confirmation') {
      return {
        reply: llmOutput.replyDraft || 'Siap kak, berikut ringkasan pesanan kakak. Silakan konfirmasi ya.',
        intent: 'confirm_order',
        components: [
          { type: 'cart_summary', cartId: cart.id },
          ...(customerContext.defaultAddress
            ? [{ type: 'address_confirm' as const, addressId: customerContext.defaultAddress.id, address: customerContext.defaultAddress, actions: ['use_saved_address', 'edit_address', 'send_new_location'] }]
            : []),
          { type: 'quick_replies', options: [
            { id: 'confirm-yes', label: '✅ Konfirmasi Pesanan', value: 'konfirmasi', action: 'send_message' },
            { id: 'confirm-edit', label: '✏️ Edit Pesanan', value: 'edit pesanan', action: 'send_message' },
          ]},
        ],
        scratchpad,
        iterationsUsed: iteration + 1,
        stoppedReason: 'needs_confirmation',
      };
    }

    if (decision === 'call_tool' && toolName) {
      if (toolName === 'create_order_from_cart' || toolName === 'createOrderFromCart') {
        return {
          reply: llmOutput.replyDraft || 'Siap kak, aku siapkan ringkasan pesanan dulu ya.',
          intent: 'confirm_order',
          components: [{ type: 'cart_summary', cartId: cart.id }],
          scratchpad,
          iterationsUsed: iteration + 1,
          stoppedReason: 'needs_confirmation',
        };
      }

      if ((toolName === 'select_payment_method' || toolName === 'selectPaymentMethod') && selectPaymentMethodCalled) {
        scratchpad.push({ type: 'tool_error', tool: toolName, message: 'Metode pembayaran sudah dipilih sebelumnya. Jangan panggil ulang.' });
        continue;
      }

      const currentCall = JSON.stringify({ tool: toolName, args: toolArgs });
      const isDuplicate = previousToolCalls.some(
        (prev) => prev.tool === toolName && prev.args === JSON.stringify(toolArgs)
      );
      if (isDuplicate) {
        scratchpad.push({ type: 'tool_error', tool: toolName, message: 'Tool ini sudah dipanggil dengan argumen yang sama. Jangan ulangi.' });
        continue;
      }
      previousToolCalls.push({ tool: toolName, args: JSON.stringify(toolArgs) });

      const schema = toolSchemaRegistry[toolName];
      if (!schema) {
        scratchpad.push({ type: 'validation_error', tool: toolName, detail: `Tool ${toolName} tidak dikenal sistem.` });
        continue;
      }

      const parseResult = schema.safeParse(toolArgs);
      if (!parseResult.success) {
        const errorDetail = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        scratchpad.push({ type: 'validation_error', tool: toolName, detail: errorDetail });
        continue;
      }

      try {
        const result = await runChatTool(chatSessionId, toolName, parseResult.data);
        const summary = typeof result === 'object' && result !== null
          ? JSON.stringify(result).slice(0, 300)
          : String(result).slice(0, 300);
        scratchpad.push({ type: 'observation', tool: toolName, result: summary });

        if (toolName === 'addToCart' || toolName === 'add_to_cart') {
          const updatedCart = await getChatCart(chatSessionId);
          if (updatedCart) {
            cart.itemCount = updatedCart.itemCount;
            cart.total = updatedCart.total;
          }
        }

        if (toolName === 'select_payment_method' || toolName === 'selectPaymentMethod') {
          selectPaymentMethodCalled = true;
        }
      } catch (error) {
        scratchpad.push({
          type: 'tool_error',
          tool: toolName,
          message: error instanceof Error ? error.message : 'Kesalahan tidak diketahui',
        });
      }
    }
  }

  return {
    reply: 'Aku sudah memproses sebisa aku. Silakan lanjutkan di atas atau ketik ulang pesanan kakak.',
    intent: 'small_talk',
    components: defaultQuickReplies(),
    scratchpad,
    iterationsUsed: maxIterations,
    stoppedReason: 'max_iterations',
  };
}

function inferIntent(reply: string, scratchpad: ScratchpadEntry[]): AIChatIntent {
  const lower = reply.toLowerCase();
  if (/pesan|order|checkout|konfirmasi/i.test(lower)) return 'confirm_order';
  if (/rekomendasi|produk|keripik|pilih/i.test(lower)) return 'recommend_products';
  if (/bayar|pembayaran|qris|transfer|cod/i.test(lower)) return 'show_payment';
  if (/keranjang|cart/i.test(lower)) return 'show_cart';
  if (/alamat|kirim|pengiriman/i.test(lower)) return 'request_location';
  if (/admin|bantuan/i.test(lower)) return 'handoff_to_admin';
  return 'small_talk';
}

function defaultQuickReplies(): ChatComponent[] {
  return [{ type: 'quick_replies', options: [
    { id: 'rekomendasi', label: 'Rekomendasi Produk', value: 'rekomendasi produk', action: 'send_message' },
    { id: 'keranjang', label: 'Lihat Keranjang', value: 'lihat keranjang', action: 'send_message' },
    { id: 'bayar', label: 'Cara Bayar', value: 'cara bayar', action: 'send_message' },
  ] }];
}
