// Deterministic unit tests for extension/qwen.js line-merge handling.
// Run: node tests/qwen-translate.cjs
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'qwen.js'), 'utf8');

function worker(fetchImpl) {
  const sandbox = {
    fetch: (...args) => fetchImpl(...args),
    AbortSignal: { timeout: () => ({}) },
    console,
  };
  vm.createContext(sandbox);
  for (const f of ['providers.js', 'api.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'extension', f), 'utf8'), sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

const resp = (status, obj) => ({ status, ok: status >= 200 && status < 300, json: async () => obj });
const ok = content => ({ choices: [{ finish_reason: 'stop', message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 20 } });

// The exact failing tweet shape: body plus a short em-dash signature line.
const TWEET = 'BDKEEP0END Hello, we are deeply sorry for any inconvenience caused. Our team is standing by.\n— DCENT WALLETS team';

(async () => {
  let passed = 0;
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); passed++; };

  // 1. Single-text protocol keeps the signature line and preserves the token.
  {
    const bodies = [];
    const w = worker(async (url, opts) => {
      bodies.push(JSON.parse(opts.body));
      return resp(200, ok(JSON.stringify({ translation: 'BDKEEP0END 您好，抱歉造成不便，团队随时待命。\n— DCENT WALLETS 团队' })));
    });
    const r = await w.qwenTranslate(TWEET, 'secret');
    assert(r.text === 'BDKEEP0END 您好，抱歉造成不便，团队随时待命。\n— DCENT WALLETS 团队', 'single output mismatch: ' + r.text);
    assert(bodies.length === 1, 'should finish in one attempt');
    assert(bodies[0].messages[1].content.includes('"text"'), 'attempt 0 must send {text}');
  }

  // 2. If the model still merges lines in attempt 0, keyed-lines fallback succeeds.
  {
    const bodies = [];
    const w = worker(async (url, opts) => {
      const body = JSON.parse(opts.body);
      bodies.push(body);
      if (bodies.length === 1) {
        return resp(200, ok(JSON.stringify({ translation: 'BDKEEP0END 您好，团队随时待命。— DCENT WALLETS 团队' })));
      }
      return resp(200, ok(JSON.stringify({ translations: { '0': 'BDKEEP0END 您好，团队随时待命。', '1': '— DCENT WALLETS 团队' } })));
    });
    const r = await w.qwenTranslate(TWEET, 'secret');
    assert(bodies.length === 2, 'expected two attempts, got ' + bodies.length);
    assert(bodies[1].messages[1].content.includes('"lines"'), 'attempt 1 must send keyed {lines}');
    assert(r.text.split('\n').length === 2, 'structural newline must survive: ' + JSON.stringify(r.text));
    assert(r.text.includes('BDKEEP0END') && r.text.includes('DCENT WALLETS 团队'), 'fallback content: ' + r.text);
  }

  // 3. Both attempts malformed -> recoverable error (renders inline retry, not a global pause).
  {
    const w = worker(async () => resp(200, ok('{"weird":true}')));
    let err;
    try { await w.qwenTranslate(TWEET, 'secret'); } catch (e) { err = e; }
    assert(err && err.recoverable === true, 'expected recoverable error');
  }

  // 4. Token dropped in both attempts -> recoverable error.
  {
    const w = worker(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.messages[0].content.includes('same line breaks')) {
        return resp(200, ok(JSON.stringify({ translation: '您好，团队随时待命。\n— DCENT WALLETS 团队' })));
      }
      return resp(200, ok(JSON.stringify({ translations: { '0': '您好，团队随时待命。', '1': '— DCENT WALLETS 团队' } })));
    });
    let err;
    try { await w.qwenTranslate(TWEET, 'secret'); } catch (e) { err = e; }
    assert(err && err.recoverable === true, 'dropped token must fail recoverably');
  }

  // 5. HTTP 403 is fatal so the worker pauses rather than retrying the key.
  {
    const w = worker(async () => resp(403, {}));
    let err;
    try { await w.qwenTranslate(TWEET, 'secret'); } catch (e) { err = e; }
    assert(err && err.fatal === true, '403 must be fatal');
  }

  // 6. HTTP 429 is retryable with backoff hint.
  {
    const w = worker(async () => resp(429, {}));
    let err;
    try { await w.qwenTranslate(TWEET, 'secret'); } catch (e) { err = e; }
    assert(err && err.fatal === true && err.status === 429, '429 must pause rather than keep spending user credits');
  }

  // 7. Blank-line paragraphs survive the single-text protocol.
  {
    const longPost = 'Line one.\n\nLine three.\nBDKEEP3END';
    const w = worker(async () => resp(200, ok(JSON.stringify({ translation: '第一行。\n\n第三行。\nBDKEEP3END' }))));
    const r = await w.qwenTranslate(longPost, 'secret');
    assert(r.text === '第一行。\n\n第三行。\nBDKEEP3END', 'blank lines: ' + JSON.stringify(r.text));
  }

  // 8. Plain-text last resort: structured attempts fail, raw Chinese text succeeds.
  {
    const bodies = [];
    const w = worker(async (url, opts) => {
      const body = JSON.parse(opts.body);
      bodies.push(body);
      if (bodies.length <= 2) return resp(200, ok('{"weird":true}'));
      return resp(200, ok('BDKEEP0END 您好，抱歉造成不便，团队随时待命。\n— DCENT WALLETS 团队'));
    });
    const r = await w.qwenTranslate(TWEET, 'secret');
    assert(bodies.length === 3, 'expected three attempts, got ' + bodies.length);
    assert(bodies[2].response_format === undefined, 'plain attempt must not request JSON');
    assert(r.text === 'BDKEEP0END 您好，抱歉造成不便，团队随时待命。\n— DCENT WALLETS 团队', 'plain output: ' + r.text);
  }

  // 9. Plain last resort strips code fences, labels and wrapping quotes.
  {
    const variants = [
      '```\nBDKEEP0END 您好，团队待命。\n— DCENT WALLETS 团队\n```',
      '译文：BDKEEP0END 您好，团队待命。\n— DCENT WALLETS 团队',
      '“BDKEEP0END 您好，团队待命。\n— DCENT WALLETS 团队”',
    ];
    for (const variant of variants) {
      const w = worker(async (url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.response_format) return resp(200, ok('{"weird":true}'));
        return resp(200, ok(variant));
      });
      const r = await w.qwenTranslate(TWEET, 'secret');
      assert(r.text.startsWith('BDKEEP0END'), 'plain cleanup must keep token first: ' + r.text);
      assert(!r.text.includes('```') && !r.text.includes('译文：'), 'shell must be stripped: ' + r.text);
      assert(r.text.split('\n').length === 2, 'lines preserved: ' + JSON.stringify(r.text));
      passed++;
    }
  }

  console.log(`qwen-translate: ${passed} assertions passed`);
})().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
