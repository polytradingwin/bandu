# API 使用说明

扩展免费；使用你自己的普通模型推理 API Key。聊天会员、Coding Plan、平台 OAuth 和云厂商 AK/SK 不一定适用于此接口。模型示例不代表永久免费或所有账号都有权限。

| 服务商 | Base URL | 模型示例 / 配置 | 官方文档 |
|---|---|---|---|
| 通义千问 · 阿里云百炼（北京） | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen3.7-flash | [文档](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope) |
| 通义千问 · 阿里云百炼（新加坡） | https://dashscope-intl.aliyuncs.com/compatible-mode/v1 | qwen-flash | [文档](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope) |
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat | [文档](https://api-docs.deepseek.com/) |
| OpenAI | https://api.openai.com/v1 | gpt-4.1-mini | [文档](https://developers.openai.com/api/docs/models/gpt-4.1-mini) |
| Google Gemini | https://generativelanguage.googleapis.com/v1beta/openai | gemini-2.5-flash | [文档](https://ai.google.dev/gemini-api/docs/openai) |
| Anthropic Claude | https://api.anthropic.com/v1 | claude-haiku-4-5 | [文档](https://platform.claude.com/docs/en/api/messages/create) |
| 月之暗面 · Kimi | https://api.moonshot.cn/v1 | kimi-k2.5 | [文档](https://platform.moonshot.cn/docs) |
| 智谱 · GLM | https://open.bigmodel.cn/api/paas/v4 | glm-4.7-flash | [文档](https://docs.bigmodel.cn/) |
| 豆包 · 火山方舟 | https://ark.cn-beijing.volces.com/api/v3 | 填写账户可用的模型 / 部署 ID | [文档](https://www.volcengine.com/docs/82379) |
| 硅基流动 · SiliconFlow | https://api.siliconflow.cn/v1 | deepseek-ai/DeepSeek-V3.2 | [文档](https://docs.siliconflow.cn/docs/userguide/quickstart) |
| MiniMax | https://api.minimax.io/v1 | MiniMax-M2.5 | [文档](https://platform.minimax.io/docs/api-reference/text-openai-api) |
| 百度智能云 · 千帆 | https://qianfan.baidubce.com/v2 | 填写账户可用的模型 / 部署 ID | [文档](https://cloud.baidu.com/doc/qianfan-api/index.html) |
| 腾讯混元 | https://api.hunyuan.cloud.tencent.com/v1 | hunyuan-turbos-latest | [文档](https://cloud.tencent.com/document/product/1729/111007) |
| xAI · Grok | https://api.x.ai/v1 | 填写账户可用的模型 / 部署 ID | [文档](https://docs.x.ai/docs/api-reference) |
| OpenRouter | https://openrouter.ai/api/v1 | 填写账户可用的模型 / 部署 ID | [文档](https://openrouter.ai/docs/quickstart) |
| Groq | https://api.groq.com/openai/v1 | 填写账户可用的模型 / 部署 ID | [文档](https://console.groq.com/docs/openai) |
| Mistral AI | https://api.mistral.ai/v1 | mistral-small-latest | [文档](https://docs.mistral.ai/api/) |
| Together AI | https://api.together.ai/v1 | 填写账户可用的模型 / 部署 ID | [文档](https://docs.together.ai/docs/openai-api-compatibility) |
| Fireworks AI | https://api.fireworks.ai/inference/v1 | 填写账户可用的模型 / 部署 ID | [文档](https://docs.fireworks.ai/api-reference/introduction) |
| Azure OpenAI | 从自己的控制台复制 | 填写账户可用的模型 / 部署 ID | [文档](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/switching-endpoints) |
| Ollama · 本机 API | http://localhost:11434/v1 | 填写账户可用的模型 / 部署 ID | [文档](https://docs.ollama.com/api/openai-compatibility) |
| LM Studio · 本机 API | http://localhost:1234/v1 | 填写账户可用的模型 / 部署 ID | [文档](https://lmstudio.ai/docs/developer/openai-compat) |
| 自定义 · OpenAI 兼容接口 | 从自己的控制台复制 | 填写账户可用的模型 / 部署 ID | 服务商提供 |
| 自定义 · Anthropic 兼容接口 | 从自己的控制台复制 | 填写账户可用的模型 / 部署 ID | 服务商提供 |

默认通过 OpenAI Chat Completions 协议，Claude / 自定义 Anthropic 使用 Messages 协议。Gemini 使用 Google 官方 OpenAI 兼容端点。Azure 使用 v1 API，模型填写部署名。百炼按密钥所属地域选择北京或新加坡，支持按控制台修改为工作空间专用域名。MiniMax 中国站请改用 https://api.minimaxi.com/v1。

所有地址与模型均可编辑。测试成功才会替换当前配置；失败保留原配置。切换服务商或地址时不会自动复用旧密钥。密钥不会回显，留空只会复用同一服务商、同一地址已保存的密钥。删除按钮清除本机配置，不会删除第三方账户。

接口兼容：默认用提示词要求 JSON，不强制发送 response_format。模型明确支持时可以开启 JSON 模式；不支持流式时取消流式选项。API 错误不会自动切换服务商、地址或模型；额度及鉴权错误暂停重试。格式不完整最多尝试 3 次，临时网络错误最多自动重试 4 次，均可能产生 API 用量。

验证范围：自动测试覆盖协议格式、流式 UTF-8、密钥隔离、失败保留配置、状态码、换行与网址保护；真实 Chrome 通过本机受控 HTTP API 验证保存、刷新、翻译和删除。千问 qwen3.7-flash 已通过 5 组真实 API 翻译（含流式、空行、网址占位符）。没有每个平台的付费测试账户，不能把预设选项等同于所有服务商、所有模型都已实测。
