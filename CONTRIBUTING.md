# Contributing

Keep changes focused, preserve the original webpage, and do not add analytics, hosted billing, shared API keys, or automatic provider fallback. Test with `node --test tests/api.test.cjs`, `node tests/qwen-translate.cjs`, `node tests/stream.cjs`, and `node tests/engbetter-connection.cjs`. Build with `python tools/package.py`. Never commit real keys or user data.
