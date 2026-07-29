# JOYNEXT Robot Part Store

面向机器人部件销售与技术选型的交互原型。首版覆盖两条最小业务路径：

1. 标准件：搜索或按机器人场景进入产品，核对参数，完成规则化配置并提交订单。
2. 定制件：提交结构化需求，进入销售与工程师联合评估，约定报价单与工期单。

## 已实现

- 产品搜索、机器人场景入口与产品卡片
- 已确认参数展示、产品配置和 AI 参数解释
- 需要工程师确认时自动转入定制流程
- 标准件下单确认
- 定制需求表单、线索评分与销售/技术分流
- 销售与技术人员结构化摘要
- 桌面端和移动端响应式界面

产品图片和演示参数来自项目提供的 `Joynext robotics product intro 20260729.pptx`。工程状态、价格与交期仅用于原型演示，最终信息应由 JOYNEXT 销售或工程师确认。

完整产品说明见：[产品业务流程与功能说明](docs/product-business-flow-and-functional-spec.md)。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm ci
npm run dev
```

生产构建：

```bash
npm run build
```

## 技术栈

- React 19
- Next.js 16
- Vinext / Vite
- TypeScript
- Cloudflare Workers compatible output

## 在线原型

[打开已部署的 JOYNEXT 机器人部件选型原型](https://joynext-robotics-configurator.sunset-sun-1233.chatgpt.site)
