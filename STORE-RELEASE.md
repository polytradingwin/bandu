# 伴读 1.0.0 商店发布材料

上传 `dist/bandu-1.0.0-store.zip`，manifest.json 在 ZIP 根目录。

名称：伴读 · 网页双语对照

简介：免费、开源的网页双语阅读扩展。保留英文与分段，支持自备 OpenAI、Claude、Gemini、DeepSeek、千问等 API；API 费用由服务商收取。

详细说明：

伴读帮助你在英文网页上对照阅读中文。X / Twitter 推文及长文采用上下对照，普通文章宽屏左右、窄屏上下对照。保留英文、段落、链接与互动控件，按网站开启或关闭。

伴读完全免费、MIT 开源，无需注册伴读账号。使用前必须配置自己的 API Key 和模型；服务商可能按用量收费，伴读不提供公共额度。支持千问、DeepSeek、OpenAI、Gemini、Claude、Kimi、GLM、豆包、硅基流动等服务商及自定义兼容接口。支持用户自行部署的 Ollama / LM Studio API。

密钥保存在本机扩展私有存储。正文直接发往你选择的 API，不经过伴读服务器。其他网站与 API 地址按需授权。可选连接独立服务 EngBetter，主动收藏选中的英文。

不支持 PDF、图片文字和浏览器内部页面。AI 翻译可能有误，请结合原文。源码：https://github.com/polytradingwin/bandu

官网：https://bandume.com
隐私政策：https://bandume.com/privacy.html
客服：gobacktome123@gmail.com

## 权限与审核说明

storage 保存设置；activeTab 读取用户操作的当前网页；scripting 注入双语与收藏界面。X / Twitter 权限用于默认翻译；EngBetter 用于可选连接。宽泛的 optional_host_permissions 仅按用户明确选择逐个申请网页或 API 来源，不在安装时授予所有站点权限。

认证数据：用户自带的第三方 API Key、可选 EngBetter 连接凭证，仅保存在本机。网站内容：送译正文发往用户选择的 API；主动收藏的正文与 URL 发往 EngBetter。使用目的仅限上述核心功能，不用于广告、出售、信贷或其他无关用途。数据披露表需与这些实际行为一致，不能勾选完全不处理网站内容。

审核路径：安装扩展 → API 设置 → 输入审核者自己的有效 API Key、模型 → 测试并启用 → 打开英文网页 → 开启双语。无需伴读登录或付费。如果审核流程要求测试凭据，只能在开发者控制台私密审核说明中提供独立限额凭据，不能放入扩展或公开仓库。

若旧版本仍在审核，应在开发者控制台按当前状态先撤回旧提交，再上传 1.0.0 并提交审核。商店审核通过前不能声称应用商店已经更新。
