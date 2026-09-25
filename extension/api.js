async function apiCompletion(config, key, system, userContent, jsonMode, progress) {
  const preset = API_PROVIDERS.find(item => item.id === config.id);
  const anthropic = config.protocol === 'anthropic';
  const streaming = Boolean(progress) && config.stream !== false && !anthropic;
  const headers = { 'Content-Type': 'application/json' };
  let body;
  if (anthropic) {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
    body = { model: config.model, max_tokens: 8192, system, messages: [{ role: 'user', content: userContent }] };
  } else {
    if (key) headers.Authorization = `Bearer ${key}`;
    body = { model: config.model, messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }] };
    if (streaming) body.stream = true;
    // Most providers accept JSON instructions without supporting response_format.
    if (jsonMode && config.jsonMode) body.response_format = { type: 'json_object' };
    if (preset?.thinking === 'qwen') body.enable_thinking = false;
    if (preset?.thinking === 'disabled') body.thinking = { type: 'disabled' };
    if (config.id === 'minimax') body.reasoning_split = true;
  }
  let response;
  try {
    response = await fetch(config.baseUrl + (anthropic ? '/messages' : '/chat/completions'), {
      method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
      credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'
    });
  } catch { throw Object.assign(new Error('连接 API 失败或超时。请检查地址、网络及服务权限。'), { retryable: true }); }
  const status = response.status;
  if (!response.ok) {
    // Never expose upstream bodies: some proxies echo request headers and keys.
    const messages = {401:'API Key 无效或已过期。',403:'API 无权访问此模型，请检查密钥、地域和权限。',402:'API 余额不足，请前往服务商控制台处理。',404:'API 地址或模型不存在，请检查 Base URL 和模型 ID。',429:'API 请求达到限额，请稍后重试或检查账户额度。'};
    throw Object.assign(new Error(messages[status] || `API 请求失败（HTTP ${status}），请检查模型和接口配置。`), {
      status, fatal: status < 500, retryable: status >= 500, retryAfterMs: status === 429 ? 15000 : 0
    });
  }
  try {
    if (streaming && response.headers.get('content-type')?.includes('text/event-stream')) return await readQwenStream(response, progress);
    const data = await response.json();
    if (data.error) throw new Error('upstream error');
    if (!anthropic) return data;
    return { choices: [{ finish_reason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
      message: { content: (data.content || []).filter(item => item.type === 'text').map(item => item.text).join('') } }],
      usage: { prompt_tokens: data.usage?.input_tokens || 0, completion_tokens: data.usage?.output_tokens || 0 } };
  } catch { throw Object.assign(new Error('API 返回格式不兼容或连接中断，请检查设置后重试。'), { recoverable: true }); }
}
