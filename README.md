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
- 标准订单与定制需求统一进入线索队列
- 销售工作台支持筛选、评分、SLA、工程评审、培育和机会转化
- 演示线索与跟进状态在浏览器本地持久化
- 客户端与管理端分离：客户网站 `/`，销售运营管理端 `/admin`
- 管理端覆盖经营概览、线索中心、客户档案、订单管理和跟进任务
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

## GitHub Actions 自动部署

推送或合并代码到 `main` 后，[deploy-main.yml](.github/workflows/deploy-main.yml)
会依次执行代码检查、测试、Docker 镜像构建和蓝绿部署。生产访问地址：

- 客户端：<https://www.atlasfish.work/joynext/>
- 管理端：<https://www.atlasfish.work/joynext/admin>

在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 中配置：

| Secret | 值 |
| --- | --- |
| `DEPLOY_HOST` | `122.51.190.67` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_PASSWORD` | 私有服务器当前 SSH 登录密码 |

镜像发布到 GitHub Container Registry，认证使用工作流自带的
`GITHUB_TOKEN`，无需额外配置 Registry 密码。服务器端部署会复用
`atlasfish_proxy` Docker 网络，并在现有 Nginx HTTPS 虚拟主机中自动加入
`/joynext/` 路由。应用容器和静态资源采用 blue/green 槽位切换；新版本健康
检查或 Nginx 配置检查失败时，不会替换当前可用版本。
