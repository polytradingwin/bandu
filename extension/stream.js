// Fetch SSE with incremental UTF-8 decoding (network chunks are not event boundaries).
async function readEvents(response, receive) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const {value, done} = await reader.read();
      pending += decoder.decode(value, {stream: !done});
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end).trim();
        pending = pending.slice(end + 1);
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          if (data) receive(JSON.parse(data));
        }
      }
      if (done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function partialTranslation(raw) {
  const start = raw.match(/^\s*\{\s*"translation"\s*:\s*"/);
  if (!start) return '';
  let text = '';
  for (let i = start[0].length; i < raw.length; i++) {
    if (raw[i] === '"') break;
    if (raw[i] !== '\\') { text += raw[i]; continue; }
    const length = raw[i + 1] === 'u' ? 6 : 2;
    if (i + length > raw.length) break;
    try { text += JSON.parse('"' + raw.slice(i, i + length) + '"'); } catch { break; }
    i += length - 1;
  }
  return text.replace(/[\uD800-\uDBFF]$/, '');
}

async function readQwenStream(response, progress) {
  let raw = '', finish = null, usage;
  await readEvents(response, data => {
    if (data.error) throw new Error('翻译流返回错误');
    if (data.usage) usage = data.usage;
    const choice = data.choices?.[0];
    if (choice?.delta?.content) {
      raw += choice.delta.content;
      progress(partialTranslation(raw));
    }
    if (choice?.finish_reason) finish = choice.finish_reason;
  });
  if (!finish) throw Object.assign(new Error('翻译连接中断，请重试。'), {retryable:true});
  return {choices:[{finish_reason:finish,message:{content:raw}}],usage};
}
