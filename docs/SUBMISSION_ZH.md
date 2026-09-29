# 作业提交｜Intent-to-RFQ Quote Explorer

**邮件主题：** Rave 作业提交｜Intent-to-RFQ Quote Explorer

Rave 团队您好：

这是我的 Intent-to-RFQ Quote Explorer 作业。工具接收简化的 Swap Intent，将其标准化后向 Bebop RFQ API 请求报价，并在只读界面中展示价格及返回的交易执行字段。

- **GitHub 仓库：** https://github.com/Hahn-G/rave-intent-rfq-explorer
- **README 与运行说明：** https://github.com/Hahn-G/rave-intent-rfq-explorer#readme
- **在线演示：** https://rave-intent-rfq-explorer.vercel.app/
- **截图——真实 API 的三档金额比较：** https://github.com/Hahn-G/rave-intent-rfq-explorer/blob/main/docs/screenshots/07-live-size-comparison.png
- **更多截图与演示步骤：** https://github.com/Hahn-G/rave-intent-rfq-explorer/blob/main/docs/DEMO.md
- **AI 使用说明：** https://github.com/Hahn-G/rave-intent-rfq-explorer/blob/main/AI_USAGE.md

界面支持 Ethereum、Base 两条链上的同链、固定输入金额交换，并为各链提供少量 WETH、USDC、USDT 代币。输入包含 `fromChain`、`toChain`、`fromToken`、`toToken`、`amountIn`、`userAddress`、`receiverAddress`；无效金额、地址、代币及不支持的路由都会给出明确错误。

LI.FI Intent 表达的是用户期望的交换结果，而不规定完整执行路径。本项目只实现简化的“意图到报价”环节，不创建 LI.FI 订单，也不处理结算。`LiFiIntentAdapter` 解析链和代币地址，将人类可读金额精确换算成代币最小单位，并校验、规范化用户与接收地址；`BebopClient` 将这些字段映射到相应链的 `/pmm/{chain}/v3/quote` 请求。另外，界面会调用 LI.FI 开放的 `/chains/supported` 端点展示链支持情况。

报价页面展示卖出/买入数量、有效价格、过期倒计时、授权目标、结算地址、交易目标、交易 value 和 calldata 是否存在，并保留不同合约地址的区别。三档金额比较会分别请求 RFQ，展示输出数量与有效单价相对最小档的基点差；过期、限流和请求失败都有明确标识，不会编造缺失报价。

线上 Live 模式在未提供 API Key 时调用 Bebop 的公共演示报价。Bebop [认证文档](https://docs.bebop.xyz/core-concepts/authentication)明确说明：未认证 RFQ 报价价格较差、限流严格，**不适合生产使用**。独立的本地 Mock 模式才是合成数据，不包含可执行交易数据。截图记录的是真实公共演示 API 响应，但其中报价已过期。工具不会连接钱包、授权、签名、发送或结算交易。

验证包括 47 个使用模拟 API 响应的通过测试、TypeScript 检查、生产构建，以及 Ethereum 和 Base 真实 Bebop 报价的浏览器检查。仓库提供 Docker 配置，但开发环境未安装 Docker，因此未验证容器启动。我选择了 Web 应用方向，审阅了演示，并推动三档金额比较和公共演示报价说明的完善。OpenAI Codex 辅助了接口调研、实现、测试、文档及验证工作；具体内容见 [AI 使用说明](https://github.com/Hahn-G/rave-intent-rfq-explorer/blob/main/AI_USAGE.md)。

感谢审阅！

Hahn-G
