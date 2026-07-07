export type AIProvider = 'deterministic' | 'groq' | 'gemini' | 'cerebras' | 'qwen';

export type AITask =
  | 'intent_detection'
  | 'structured_chat_response'
  | 'faq_answer'
  | 'memory_extraction'
  | 'admin_summary'
  | 'product_recommendation'
  | 'conversation_summary'
  | 'image_or_payment_receipt_analysis';

export type AIProviderConfig = {
  id: string;
  name: AIProvider;
  enabled: boolean;
  baseUrl?: string;
  apiKeyEnv: string;
  defaultModel: string;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  maxOutputTokensDefault: number;
  priority: number;
};

export type AIModelTaskConfig = {
  task: AITask;
  primaryProviderId: string;
  fallbackProviderIds: string[];
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
};

export type GenerateTextInput = {
  task: AITask;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  chatSessionId?: string;
};

export type GenerateTextResult = {
  text: string;
  provider: AIProvider | string;
  model: string;
  tokensUsed?: number;
};
