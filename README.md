# 伴读 Bandu

免费、开源的网页双语阅读扩展。英文留在原处，中文紧随其后。

**伴读不收费、不提供公共 API 额度。使用者自行配置 API Key；模型调用费用由所选服务商收取。无需伴读账号或后台服务器。**

- X / Twitter 动态推文与长文：中文显示在英文下方，保留原文、链接和分段。
- 普通网页：宽屏左右对照，窄屏上下对照；按网站开启或关闭。
- 只翻译靠近视口的正文，串行请求、页面内存缓存；不收集浏览历史。
- 可选连接独立服务 EngBetter，主动收藏所选英文。不连接也能翻译。

[官网与安装说明](https://bandume.com) · [源码](https://github.com/polytradingwin/bandu) · [版本下载](https://github.com/polytradingwin/bandu/releases)

## 安装

Chrome 应用商店：[伴读](https://chromewebstore.google.com/detail/ojkjhponlgoeagionaepmkjnkifnoiho)。商店版本由审核和发布进度决定；免费自备 API 版为 **1.0.0**。如果商店仍显示旧会员版，请从 GitHub Releases 安装最新版。GitHub 手动安装版 1.0.1 固定扩展 ID，支持在不同电脑上连接 EngBetter。

手动安装（Chrome / Edge，Windows / macOS）：

1. 下载本仓库或 Releases 的手动安装 ZIP，解压到固定目录。
2. 打开 `chrome://extensions` 或 `edge://extensions`，开启开发者模式。
3. 点击“加载已解压的扩展程序”，选择含 `manifest.json` 的 `extension` 文件夹。
4. 在 API 设置中选择服务商，填写 API Key、接口地址和模型 ID，勾选费用与数据说明，点击“测试连接并保存启用”。
5. 回到 X 刷新网页；普通网站点击伴读图标，开启双语并授权当前网站。

更新本地文件后，在扩展管理页点击重新加载，再刷新网页。不要删除已加载的文件夹。

## 收藏到自己的 EngBetter

1. 点击伴读图标，再点“连接到 EngBetter”。
2. 登录你自己的 EngBetter 账号，点击“允许连接”。
3. 在英文网页选中一句英文，点击“收藏到 EngBetter［我记的日常］”。
4. 显示“已收藏”后，打开 EngBetter 的“我记的日常”，可选择“只看收藏文”并开始练习。

API Key 用于网页翻译；EngBetter 连接用于确定收藏归属，二者独立。每个人的句子只保存在自己的 EngBetter 账号下。收藏本身先保存句子，进入练习时再准备译文与音频，适用 EngBetter 自身的额度。

GitHub 手动版的公开 `manifest.key` 仅用于固定扩展 ID，不是 API Key 或私钥。不要同时安装同 ID 的商店版和手动版；选择一种安装方式即可。

## 支持的 API

千问（北京 / 新加坡）、DeepSeek、OpenAI、Google Gemini、Anthropic Claude、Kimi、智谱 GLM、豆包 / 火山方舟、硅基流动、MiniMax、百度千帆、腾讯混元、Grok、OpenRouter、Groq、Mistral、Together AI、Fireworks AI、Azure OpenAI、Ollama、LM Studio，以及自定义 OpenAI / Anthropic 兼容接口。

所有选项均可修改 Base URL 与模型。地域、模型权限、API 余额、网络可达性由用户账户决定；预设不表示每种模型或服务商均经过真实账户测试。详见 [API 使用说明](PROVIDERS.md)。

聊天订阅通常不等于 API 额度。测试、自动重试及译文格式修复也可能产生用量。远程接口必须使用 HTTPS，本机 API 可使用 localhost HTTP。Ollama / LM Studio 需要自行启动模型服务，通常不需要密钥。

## 隐私

密钥保存在扩展来源的 IndexedDB，不写入网页、不使用浏览器同步、不上传伴读。翻译正文直接发送至你选择的 API 地址。不是加密保险箱：有权访问浏览器配置文件的本机软件可能读取这些数据。删除配置或卸载扩展可清除本地密钥。

网站权限与 API 权限分开申请，授权 API 不会自动开启该服务商网站的双语翻译。详见 [隐私说明](PRIVACY.md)。

## 开发

扩展使用原生 JavaScript / Manifest V3，无 npm 运行时依赖，无远程执行代码。Chrome 最低版本见 manifest（138）。

```sh
node --test tests/api.test.cjs
node tests/qwen-translate.cjs
node tests/stream.cjs
python tools/package.py
python tools/build-site.py
```

`extension/` 是完整可安装扩展；`site/` 是官网静态文件；`tools/` 提供打包和站点生成。开源版不包含旧会员后台、支付代码、用户数据库、密钥、内部部署记录或浏览器配置文件。

当前不支持 PDF、图片文字、浏览器内部页面或扩展商店；未发布 Safari、iPad 或 Android 正式版。AI 翻译可能出错，请保留原文判断。

## 许可证

[MIT](LICENSE)。欢迎提交问题和改进。第三方 API 与 EngBetter 适用各自条款；商标不随 MIT 自动授权。
