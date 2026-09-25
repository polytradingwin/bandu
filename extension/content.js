(() => {
  if (globalThis.__banduLoaded?.alive?.()) return;
  document.dispatchEvent(new Event('bandu:dispose'));
  let disposed = false;
  globalThis.__banduLoaded = { alive: () => !disposed && Boolean(chrome.runtime.id) };
  document.documentElement.dataset.banduLifecycle = '1';
  const isX = /(^|\.)(x\.com|twitter\.com)$/.test(location.hostname);
  const isGuide = location.protocol === 'chrome-extension:';
  const siteKey = `site:${location.hostname}`;
  const records = new Map();
  const cache = new Map();
  const progressCallbacks = new Map();
  let enabled = false;
  let layout = 'auto';
  let provider = 'api';
  let providerRevision;
  let cloudPaused = false;
  let retryCloud = false;
  let translator;
  let initializing = false;
  let running = false;
  let revision = 0;
  let scanTimer;
  let panel;
  let panelText;
  let panelButton;
  let observer;
  let intersection;

  function dispose() {
    disposed = true; enabled = false; revision++;
    progressCallbacks.clear();
    observer?.disconnect(); intersection?.disconnect();
    clearTimeout(scanTimer); scanTimer = null;
    translator?.destroy();
    hideNotice();
    for (const [element, record] of records) removeRecord(element, record);
    css.remove();
    document.removeEventListener('bandu:dispose', dispose);
  }
  document.addEventListener('bandu:dispose', dispose);

  const css = document.createElement('style');
  css.textContent = `
    .bd-pair { display:block; margin:0 0 1em; min-width:0; }
    .bd-pair > :first-child { min-width:0; }
    .bd-pair.bd-columns { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:28px; align-items:start; }
    .bd-pair.bd-columns > :first-child { margin-top:0 !important; }
    .bd-translation { display:block; box-sizing:border-box; margin:8px 0 14px; padding:8px 0 8px 12px; border-left:2px solid #73a78b; color:inherit; font:400 15px/1.8 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif; text-align:left; white-space:pre-wrap; overflow-wrap:anywhere; }
    .bd-pair.bd-columns > .bd-translation { margin-top:0; }
    @media(max-width:1050px) { .bd-pair.bd-columns { display:block; } }
  `;
  document.documentElement.append(css);

  function notice(message, action) {
    if (!enabled) return;
    if (!panel) {
      panel = document.createElement('div');
      panel.setAttribute('data-bd-ui', '');
      panel.setAttribute('data-bd-owned', '1');
      panel.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;max-width:calc(100vw - 36px);';
      const shadow = panel.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>
        :host{all:initial} .box{box-sizing:border-box;width:300px;max-width:calc(100vw - 36px);padding:16px;background:#f7faf7;color:#233d2d;border:1px solid #c6d7c8;border-radius:10px;box-shadow:0 5px 25px #0002;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif}
        strong{font-size:15px}p{margin:7px 0 12px}button{font:inherit;border:0;border-radius:6px;background:#236846;color:#fff;padding:7px 12px;cursor:pointer}button:focus-visible{outline:3px solid #cc952e;outline-offset:3px}button[hidden]{display:none}
        @media(prefers-color-scheme:dark){.box{background:#1e2d24;color:#e1ede3;border-color:#536c58}}
        </style><div class="box"><strong>伴读 · 双语翻译</strong><p role="status" aria-live="polite"></p><button hidden></button></div>`;
      panelText = shadow.querySelector('p');
      panelButton = shadow.querySelector('button');
      document.body.append(panel);
    }
    panelText.textContent = message;
    panelButton.hidden = !action;
    panelButton.textContent = action || '';
    panelButton.onclick = () => initialize(true);
  }

  function hideNotice() { panel?.remove(); panel = null; }

  async function initialize(fromClick = false) {
    if (!enabled || initializing || translator) return;
    if (provider === 'api') {
      translator = { destroy() {}, translate: async (text, progress) => {
        while (enabled && provider === 'api') {
          const requestId = crypto.randomUUID();
          if (progress) progressCallbacks.set(requestId, progress);
          let result;
          try { result = await chrome.runtime.sendMessage({ type: 'bd:translate', text, retry: retryCloud, requestId }); }
          finally { progressCallbacks.delete(requestId); }
          if (result.busy) {
            notice(`正在排队翻译${result.waitMs ? `，约 ${Math.ceil(result.waitMs / 1000)} 秒后继续` : ''}…`);
            // Respect the worker's precise rate-limit deadline instead of rounding
            // each 2.1s request interval up to three one-second polls.
            const waitMs = Number.isFinite(result.waitMs) && result.waitMs > 0 ? result.waitMs : 250;
            await new Promise(resolve => setTimeout(resolve, waitMs)); continue;
          }
          retryCloud = false;
          if (!result.ok) {
            const error = new Error(result.error);
            error.recoverable = result.recoverable === true;
            error.retryable = result.retryable === true;
            error.status = result.status;
            throw error;
          }
          hideNotice();
          return result.text;
        }
        throw new Error('翻译已取消');
      } };
      hideNotice(); scan(); drain(); return;
    }
    notice('请先设置自己的 API，伴读免费且无需注册。', '设置 API');
    panelButton.onclick = () => chrome.runtime.sendMessage({ type: 'bd:open-settings' });
  }

  function sourceText(element) {
    if (!isX && !tableCell(element)) return element.innerText.trim();
    // X uses inline-block spans inside links. innerText adds artificial breaks.
    function read(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      if (node.matches('.bd-translation,[data-bd-ui]')) return '';
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || node.hidden) return '';
      if (node.tagName === 'BR') return '\n';
      if (node.tagName === 'IMG') return node.getAttribute('alt') || '';
      return [...node.childNodes].map(read).join('');
    }
    return read(element).trim();
  }

  async function translateProtected(text, engine, progress) {
    const literals = [];
    let prefix = 'BDKEEP';
    while (text.includes(prefix)) prefix += 'X';
    const protectedText = text.replace(/https?:\/\/[^\s<>]+|@[A-Za-z0-9_]+|\b(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?:\/[^\s<>]*)?/g, value => {
      const token = `${prefix}${literals.length}END`;
      literals.push({ token, value });
      return token;
    });
    let result = '';
    let remaining = protectedText;
    // Bound individual API requests even when X expands a very long post.
    while (remaining) {
      let end = remaining.length;
      let separator = '';
      if (end > 6000) {
        const boundary = [...remaining.slice(0, 6000).matchAll(/\s+/g)].pop();
        end = boundary ? boundary.index : 6000;
        separator = boundary ? boundary[0] : '';
      }
      const part = remaining.slice(0, end);
      result += provider === 'api' ? await engine.translate(part, partial => {
        let preview = result + partial;
        // Never expose an unfinished placeholder or URL in a streamed preview.
        const marker = preview.lastIndexOf(prefix);
        if (marker >= 0 && !/^\d+END/.test(preview.slice(marker + prefix.length))) preview = preview.slice(0, marker);
        for (let size = prefix.length - 1; size > 0; size--) {
          if (preview.endsWith(prefix.slice(0, size))) { preview = preview.slice(0, -size); break; }
        }
        for (const {token, value} of literals) preview = preview.split(token).join(value);
        progress?.(preview);
      }) : await translatePreservingBreaks(part, engine);
      result += separator;
      remaining = remaining.slice(end + separator.length);
    }
    for (const { token, value } of literals) {
      if (result.split(token).length !== 2) throw Object.assign(new Error('译文未完整保留链接或用户名，请重试。'), { recoverable: true });
      result = result.replace(token, () => value);
    }
    return result;
  }

  function eligible(element) {
    if (isGuide && !element.closest('.reading')) return false;
    if (element.closest('[data-bd-ui],.bd-translation,nav,header,footer,pre,code,button,textarea,input,select,[contenteditable]:not([contenteditable="false"]),[translate="no"]')) return false;
    if (!element.getClientRects().length) return false;
    const lang = element.getAttribute('lang');
    // X mislabels English city lists as Indonesian (in); use the text below on X.
    if (!isX && lang && !lang.toLowerCase().startsWith('en')) return false;
    const text = sourceText(element);
    if (!isX && tableCell(element) && (
      /^(?:[\d.,]+\s*[万亿kmb]?\s*tokens?)$/i.test(text) ||
      /^(?=.*\d)[a-z0-9]+(?:[-_.][a-z0-9]+)+$/i.test(text) ||
      /^(?:cursor|qwen|gpt|gemini|claude|grok|deepseek|llama)\b.*\d/i.test(text)
    )) return false;
    const letters = (text.match(/[a-z]/gi) || []).length;
    const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
    return text.length >= 2 && letters >= 2 && letters > chinese * 2;
  }

  function setColumns(record) {
    if (record.wrapper) record.wrapper.classList.toggle('bd-columns', layout === 'auto' && record.wrapper.getBoundingClientRect().width >= 680);
  }

  function optionLabel(element) {
    return element.tagName === 'LABEL' && ['radio', 'checkbox'].includes(element.control?.type);
  }

  function tableCell(element) {
    return element.matches('th,td,[role="columnheader"],[role="rowheader"],[role="cell"],[role="gridcell"]');
  }

  function tableLabel(text) {
    const labels = {item:'项目',tokens:'词元数',usage:'用量',type:'类型',subtotal:'小计',cost:'费用',qty:'数量',total:'合计',
      'cursor models':'Cursor 模型','other models':'其他模型',auto:'自动',paid:'已支付',void:'已作废',view:'查看'};
    return Object.hasOwn(labels, text.trim().toLowerCase().replace(/:$/, '')) ? labels[text.trim().toLowerCase().replace(/:$/, '')] : null;
  }

  function removeRecord(element, record) {
    clearTimeout(record.retryTimer);
    intersection?.unobserve(element);
    record.translation?.remove();
    if (record.wrapper?.isConnected) {
      if (element.parentElement === record.wrapper) record.wrapper.replaceWith(element);
      else record.wrapper.remove();
    }
    records.delete(element);
  }

  function scan() {
    if (!enabled) return;
    // Pre-lifecycle scripts can leave UI behind even after a new script starts.
    document.querySelectorAll('[data-bd-ui]:not([data-bd-owned]),.bd-translation:not([data-bd-owned])').forEach(node => node.remove());
    for (const [element, record] of records) {
      if (!element.isConnected || sourceText(element) !== record.text || !eligible(element) || (record.translation && !record.translation.isConnected)) removeRecord(element, record);
    }
    const selector = isX ? '[data-testid="tweetText"]' : 'article p,main p,[role="main"] p,.entry-content p,.post-content p';
    let candidates = [...document.querySelectorAll(selector)];
    if (isX) {
      // X Articles use a rich-text reader, not the ordinary tweetText container.
      candidates.push(...document.querySelectorAll('[data-testid="twitter-article-title"],[data-testid="twitterArticleTitle"],[data-testid="articleTitle"]'));
      for (const body of document.querySelectorAll('[data-testid="twitterArticleRichTextView"],[data-testid="longformRichTextComponent"],[data-testid="articleRichContent"]')) {
        const blocks = [...body.querySelectorAll('[data-block="true"],.longform-unstyled,.longform-header-one,.longform-header-two,.longform-header-three,.longform-blockquote,.longform-unordered-list-item,.longform-ordered-list-item,p,h1,h2,h3,h4,h5,h6,li,blockquote')]
          .filter(node => !node.closest('.bd-translation,[data-bd-ui]'));
        // Prefer a paragraph's outer block to its nested spans; embedded tweets
        // retain their own tweetText record instead of translating a media block.
        candidates.push(...blocks.filter(node => !node.matches('.longform-atomic') && !node.querySelector('[data-testid="tweetText"]')));
      }
      candidates = [...new Set(candidates)].filter(node => !candidates.some(parent => parent !== node && parent.contains(node)));
    }
    if (!isX && !candidates.length) candidates = [...document.querySelectorAll('p')];
    if (!isX) {
      const labels = [...document.querySelectorAll('label')].filter(optionLabel);
      // A label can contain a paragraph; translate that option only once.
      candidates = candidates.filter(element => !labels.some(label => label.contains(element) || element.contains(label)));
      candidates.push(...labels);
      const cells = [...document.querySelectorAll('th,td,[role="columnheader"],[role="rowheader"],[role="cell"],[role="gridcell"]')]
        .filter(element => !element.querySelector('table,[role="table"],[role="grid"]'));
      candidates.push(...document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      // A cell owns its text, including any nested paragraph or heading.
      candidates = candidates.filter(element => !cells.some(cell => cell.contains(element) || element.contains(cell)));
      candidates.push(...cells);
    }
    for (const element of candidates) {
      if (records.has(element) || !eligible(element)) continue;
      const record = { text: sourceText(element), visible: false, busy: false, translation: null, wrapper: null, failed: false };
      records.set(element, record);
      const label = !isX && tableCell(element) ? tableLabel(record.text) : null;
      if (label) { renderTranslation(element, record, label); continue; }
      intersection.observe(element);
    }
    drain();
  }

  function renderTranslation(element, record, text) {
    if (record.translation) {
      record.translation.textContent = text;
      record.translation.hidden = !text;
      return;
    }
    const output = document.createElement(optionLabel(element) ? 'span' : 'div');
    output.className = 'bd-translation notranslate';
    output.setAttribute('data-bd-owned', '1');
    output.lang = 'zh-CN';
    output.setAttribute('translate', 'no');
    output.setAttribute('aria-label', '中文译文');
    output.textContent = text;
    record.translation = output;
    if (!isX && tableCell(element)) {
      output.style.cssText = 'margin:4px 0 0;padding:0 0 0 8px;font-size:0.9em;line-height:1.5;text-align:inherit;';
      element.append(output);
    }
    else if (optionLabel(element)) {
      // Keep the original label/input in place so sibling selectors and clicks still work.
      output.style.cssText = 'display:inline-block;margin:4px 0 4px 12px;vertical-align:middle;';
      element.after(output);
    }
    else if (isX) element.after(output);
    else if (element.matches('h1,h2,h3,h4,h5,h6') && element.closest('a')) {
      // Keep search-result link structure intact; page selectors can transform nested divs.
      element.closest('a').after(output);
    }
    else {
      const wrapper = document.createElement('div');
      wrapper.className = 'bd-pair';
      element.before(wrapper);
      wrapper.append(element, output);
      record.wrapper = wrapper;
      setColumns(record);
    }
    for (const [property, value] of Object.entries({ transform:'none', rotate:'none', scale:'none', 'writing-mode':'horizontal-tb', direction:'ltr', 'unicode-bidi':'isolate' })) {
      output.style.setProperty(property, value, 'important');
    }
  }

  async function translatePreservingBreaks(text, engine) {
    const parts = text.split(/(\r?\n+)/);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].trim()) continue;
      // Translate each original line separately; keep its line/paragraph separators.
      parts[i] = (await engine.translate(parts[i])).trim().replace(/\r?\n/g, ' ');
      if (!parts[i]) throw Object.assign(new Error('翻译返回了空内容'), { recoverable: true });
    }
    return parts.join('');
  }

  async function drain() {
    if (running || !enabled || !translator || cloudPaused) return;
    running = true;
    const token = revision;
    try {
      while (enabled && translator && token === revision) {
        const next = [...records].find(([, r]) => r.visible && !r.translation && !r.ignored && !r.busy && !r.failed);
        if (!next) break;
        const [element, record] = next;
        record.busy = true;
        try {
          const text = cache.get(record.text) || await translateProtected(record.text, translator, partial => {
            if (token !== revision || !enabled || records.get(element) !== record || !element.isConnected || sourceText(element) !== record.text) return;
            if (partial || record.translation) { hideNotice(); renderTranslation(element, record, partial); }
          });
          if (token !== revision || !enabled) break;
          if (typeof text !== 'string' || !text.trim()) throw Object.assign(new Error('翻译返回了空内容'), { recoverable: true });
          cache.set(record.text, text);
          if (cache.size > 300) cache.delete(cache.keys().next().value);
          if (element.isConnected && records.get(element) === record && sourceText(element) === record.text) {
            if (!/[\u3400-\u9fff]/.test(text) || text.normalize('NFKC').replace(/\s+/g, '').toLowerCase() === record.text.normalize('NFKC').replace(/\s+/g, '').toLowerCase()) { record.ignored = true; if (record.translation) renderTranslation(element, record, ''); }
            else renderTranslation(element, record, text);
          }
        } catch (error) {
          if (token !== revision) break;
          // An expanded/replaced tweet owns a new record; its old request cannot pause it.
          if (records.get(element) !== record || !element.isConnected || sourceText(element) !== record.text) continue;
          record.translation?.remove(); record.translation = null;
          if (record.wrapper?.isConnected) record.wrapper.replaceWith(element);
          record.wrapper = null;
          record.failed = true;
          if (/Extension context invalidated/i.test(error.message)) {
            cloudPaused = true;
            observer?.disconnect();
            intersection?.disconnect();
            clearTimeout(scanTimer);

            notice('伴读已更新，此页面仍在使用旧版本。刷新页面后即可恢复翻译。', '刷新页面');
            panelButton.onclick = () => location.reload();
            break;
          }
          // Transient upstream/rate-limit failures recover themselves; spread retries
          // across the server's stale-job (45s) and per-minute rate windows.
          const retryDelays = [5000, 10000, 20000, 30000];
          if (error.retryable && (record.attempts || 0) < retryDelays.length) {
            record.attempts = (record.attempts || 0) + 1;
            record.retryTimer = setTimeout(() => {
              if (records.get(element) !== record || !enabled) return;
              record.failed = false; drain();
            }, retryDelays[record.attempts - 1]);
            continue;
          }
          const quotaExhausted = [401, 402, 403, 404, 428, 429].includes(error.status);
          if (quotaExhausted) {
            renderTranslation(element, record, error.message || 'API 配置或账户额度需要检查。');
            const member = document.createElement('button');
            member.textContent = '打开 API 设置';
            member.onclick = () => chrome.runtime.sendMessage({ type: 'bd:open-settings' });
            record.translation.append(' ', member);
            console.warn('[伴读] API 翻译被拒绝：', error);
            continue;
          }
          if (error.recoverable) {
            renderTranslation(element, record, '这条内容暂未翻译完成。');
            record.translation.title = error.message || '';
            console.warn('[伴读] 该内容翻译失败，可悬停查看原因：', error);
            const retry = document.createElement('button');
            retry.textContent = '重试翻译';
            retry.onclick = () => { removeRecord(element, record); scan(); };
            record.translation.append(' ', retry);
            continue;
          }
          if (provider === 'api') cloudPaused = true;
          notice(`翻译未完成：${error.message} 点击重试。`, '重试翻译');
          panelButton.onclick = () => {
            for (const r of records.values()) r.failed = false;
            cloudPaused = false; retryCloud = true;
            hideNotice();
            drain();
          };
          if (cloudPaused) break;
        } finally { record.busy = false; }
      }
    } finally {
      running = false;
      if (enabled && token !== revision) drain();
    }
  }

  function scheduleScan() {
    if (scanTimer || disposed) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 180);
  }

  async function refresh() {
    if (disposed) return;
    const settings = await chrome.storage.local.get([siteKey, 'layout', 'provider', 'providerRevision']);
    if (disposed) return;
    const changed = provider !== (settings.provider || 'api') || providerRevision !== settings.providerRevision;
    provider = settings.provider || 'api';
    providerRevision = settings.providerRevision;
    layout = settings.layout || 'auto';
    const next = isGuide || (settings[siteKey] ?? isX);
    for (const record of records.values()) setColumns(record);
    if (next === enabled && !changed) return;
    enabled = next;
    revision++;
    {
      observer?.disconnect();
      intersection?.disconnect();
      clearTimeout(scanTimer); scanTimer = null;

      translator?.destroy();
      translator = null;
      for (const [element, record] of records) removeRecord(element, record);
      cache.clear();
      hideNotice();
      cloudPaused = false; retryCloud = false;
      if (!enabled) return;
    }
    intersection = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const record = records.get(entry.target);
        if (record) record.visible = entry.isIntersecting;
      }
      drain();
    }, { rootMargin: '150px' });
    observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => !m.target.closest?.('[data-bd-ui],.bd-translation'))) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan();
    initialize();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (!disposed && area === 'local' && (siteKey in changes || 'layout' in changes || 'provider' in changes || 'providerRevision' in changes)) refresh();
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (disposed) return;
    if (message.type === 'bd:partial') progressCallbacks.get(message.requestId)?.(message.text);
    if (message.type === 'bd:status') reply({ enabled, ready: Boolean(translator), translated: [...records.values()].filter((r) => r.translation).length });
    if (message.type === 'bd:refresh') { refresh(); reply({ ok: true }); }
  });
  window.addEventListener('resize', () => { for (const record of records.values()) setColumns(record); });
  refresh();
})();
