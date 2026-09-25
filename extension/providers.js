// Presets are editable. Use a normal inference API key, not a chat subscription.
const API_PROVIDERS = [
  { id: 'qwen', name: '通义千问 · 阿里云百炼（北京）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-flash', docs: 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope', thinking: 'qwen' },
  { id: 'qwen-intl', name: '通义千问 · 阿里云百炼（新加坡）', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-flash', docs: 'https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope', thinking: 'qwen' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', docs: 'https://api-docs.deepseek.com/' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', docs: 'https://developers.openai.com/api/docs/models/gpt-4.1-mini' },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', docs: 'https://ai.google.dev/gemini-api/docs/openai' },
  { id: 'claude', name: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-haiku-4-5', protocol: 'anthropic', docs: 'https://platform.claude.com/docs/en/api/messages/create' },
  { id: 'moonshot', name: '月之暗面 · Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.5', docs: 'https://platform.moonshot.cn/docs', thinking: 'disabled' },
  { id: 'zhipu', name: '智谱 · GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.7-flash', docs: 'https://docs.bigmodel.cn/', thinking: 'disabled' },
  { id: 'doubao', name: '豆包 · 火山方舟', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '', docs: 'https://www.volcengine.com/docs/82379', hint: '填写方舟控制台中的模型 ID 或推理接入点 ID。', thinking: 'disabled' },
  { id: 'siliconflow', name: '硅基流动 · SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3.2', docs: 'https://docs.siliconflow.cn/docs/userguide/quickstart' },
  { id: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2.5', docs: 'https://platform.minimax.io/docs/api-reference/text-openai-api', hint: '国际站使用当前地址；中国站请按控制台改为 https://api.minimaxi.com/v1。' },
  { id: 'baidu', name: '百度智能云 · 千帆', baseUrl: 'https://qianfan.baidubce.com/v2', model: '', docs: 'https://cloud.baidu.com/doc/qianfan-api/index.html', hint: '填写千帆控制台可用的模型 ID 和 API Key（不是旧版 AK / SK）。' },
  { id: 'hunyuan', name: '腾讯混元', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', model: 'hunyuan-turbos-latest', docs: 'https://cloud.tencent.com/document/product/1729/111007' },
  { id: 'grok', name: 'xAI · Grok', baseUrl: 'https://api.x.ai/v1', model: '', docs: 'https://docs.x.ai/docs/api-reference', hint: '填写 xAI 控制台当前可用的文本模型 ID。' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '', docs: 'https://openrouter.ai/docs/quickstart', hint: '填写完整模型 ID，例如 openai/gpt-4.1-mini。费用和数据路由由 OpenRouter 处理。' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: '', docs: 'https://console.groq.com/docs/openai', hint: '从 Groq 控制台复制当前可用的模型 ID。' },
  { id: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', docs: 'https://docs.mistral.ai/api/' },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.ai/v1', model: '', docs: 'https://docs.together.ai/docs/openai-api-compatibility', hint: '从 Together 控制台复制完整模型 ID。' },
  { id: 'fireworks', name: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1', model: '', docs: 'https://docs.fireworks.ai/api-reference/introduction', hint: '填写完整模型路径 accounts/.../models/...。' },
  { id: 'azure', name: 'Azure OpenAI', baseUrl: '', model: '', docs: 'https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/switching-endpoints', hint: 'Base URL 填 https://你的资源.openai.azure.com/openai/v1；模型填部署名称。使用 API Key。' },
  { id: 'ollama', name: 'Ollama · 本机 API', baseUrl: 'http://localhost:11434/v1', model: '', optionalKey: true, docs: 'https://docs.ollama.com/api/openai-compatibility', hint: '先运行本机服务并下载支持中文的模型，填写模型名称。本机服务通常无需密钥。' },
  { id: 'lmstudio', name: 'LM Studio · 本机 API', baseUrl: 'http://localhost:1234/v1', model: '', optionalKey: true, docs: 'https://lmstudio.ai/docs/developer/openai-compat', hint: '在 LM Studio 中启动本地服务器并填写已加载的模型 ID。' },
  { id: 'custom', name: '自定义 · OpenAI 兼容接口', baseUrl: '', model: '', docs: '', hint: '支持 Chat Completions 协议。请确认服务商可信；密钥与待译正文会直接发送到此地址。' },
  { id: 'custom-anthropic', name: '自定义 · Anthropic 兼容接口', baseUrl: '', model: '', protocol: 'anthropic', docs: '', hint: '支持 Messages 协议，Base URL 通常以 /v1 结尾。' }
];

function apiConfig(input) {
  const preset = API_PROVIDERS.find(item => item.id === input?.id);
  if (!preset) throw new Error('请选择 API 服务商。');
  let url;
  try { url = new URL(String(input.baseUrl || '').trim()); } catch { throw new Error('请填写完整的 API Base URL。'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('远程 API 必须使用 HTTPS；HTTP 仅供本机服务使用。');
  if (url.username || url.password || url.search || url.hash) throw new Error('Base URL 不能包含账号、密钥、查询参数或片段。');
  const model = String(input.model || '').trim();
  if (!model || model.length > 200 || /[\x00-\x20]/.test(model)) throw new Error('请填写服务商提供的模型 ID，不能包含空格。');
  const baseUrl = url.href.replace(/\/+$/, '').replace(/\/(chat\/completions|messages)$/, '');
  return { id: preset.id, baseUrl, model, protocol: preset.protocol || 'openai', stream: input.stream !== false, jsonMode: input.jsonMode === true };
}

function apiOrigin(config) { return new URL(config.baseUrl).origin + '/*'; }
