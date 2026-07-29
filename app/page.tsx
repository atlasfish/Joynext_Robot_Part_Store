"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { productCatalog, type CatalogProduct } from "@/lib/product-catalog";

type View = "home" | "standard" | "custom";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const withBasePath = (path: string) => `${basePath}${path}`;

type Product = Omit<CatalogProduct, "image"> & { image: string };

type DiscoveryBrief = {
  scene: "AMR / AGV" | "人形机器人" | "协作机械臂" | "服务机器人";
  goal: "导航与避障" | "姿态与平衡" | "视觉与三维感知" | "集中计算与实时控制";
  stage: "概念设计" | "Demo / 样机" | "样机验证" | "小批量验证";
};

type StandardCustomer = {
  company: string;
  companyType: string;
  contact: string;
  contactDetail: string;
  country: string;
  city: string;
  address: string;
  postalCode: string;
};

type LeadStatus = "新线索" | "工程评审" | "销售跟进" | "培育中" | "已转机会" | "已关闭";

type LeadRecord = {
  id: string;
  createdAt: string;
  source: "标准订单" | "定制需求";
  company: string;
  companyType: string;
  contact: string;
  contactDetail: string;
  country: string;
  city: string;
  score: number;
  status: LeadStatus;
  route: string;
  priority: "高" | "中" | "低";
  product: string;
  model: string;
  productImage: string;
  quantity: string;
  scene: string;
  stage: string;
  target: string;
  need: string;
  address: string;
  nextAction: string;
  estimatedPrice?: string;
};

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  products?: Array<{
    id: string;
    name: string;
    model: string;
    kind: string;
    image: string;
    description: string;
    status: string;
    verified: string[];
  }>;
  boundary?: string;
};

type AssistantPrompt = {
  id: number;
  text: string;
};

const products: Product[] = productCatalog.map((product) => ({
  ...product,
  image: withBasePath(product.image),
}));
const demoUnitPrices: Record<string, number> = {};

const discoveryGoals: DiscoveryBrief["goal"][] = [
  "导航与避障",
  "姿态与平衡",
  "视觉与三维感知",
  "集中计算与实时控制",
];

const discoveryScenes: DiscoveryBrief["scene"][] = ["AMR / AGV", "人形机器人", "协作机械臂", "服务机器人"];

function recommendProducts(brief: DiscoveryBrief) {
  const goalBoost: Record<DiscoveryBrief["goal"], Partial<Record<Product["id"], number>>> = {
    "导航与避障": { "depth-48": 10, fisheye: 7, "imu-mcu": 3, "controller-h1": 1 },
    "姿态与平衡": { "imu-mcu": 10, "imu-no-mcu": 8, "controller-h1": 4 },
    "视觉与三维感知": { "depth-48": 10, "depth-100": 8, fisheye: 7, "controller-m1": 2 },
    "集中计算与实时控制": { "controller-h1": 10, "controller-m1": 8, "imu-mcu": 2 },
  };
  return products
    .map((product) => {
      const fit = product.fit;
      const score = 45
        + (fit.scenes.includes(brief.scene) ? 18 : 0)
        + (fit.goals.includes(brief.goal) ? 22 : 0)
        + (goalBoost[brief.goal][product.id] ?? 0)
        + (brief.stage === "小批量验证" && !product.engineeringReview ? 4 : 0);
      return { product, score: Math.min(98, score), reason: fit.reason };
    })
    .sort((a, b) => b.score - a.score);
}

const scenarios = [
  { icon: "◫", name: "AMR / AGV", note: "导航、定位与多传感器融合", image: withBasePath("/scenes/amr-warehouse.jpeg") },
  { icon: "⌁", name: "人形机器人", note: "感知、规划与硬实时伺服控制", image: withBasePath("/scenes/humanoid.png") },
  { icon: "⌖", name: "机械臂", note: "高精度定位、视觉与末端感知", image: withBasePath("/products/depth-camera.webp") },
];

const seedLeads: LeadRecord[] = [
  {
    id: "L-20260729-0059", createdAt: "今天 09:18", source: "定制需求", company: "RoboMotion GmbH", companyType: "机器人整机厂商",
    contact: "Anna Weber", contactDetail: "info@robomotion.de", country: "德国", city: "慕尼黑", score: 92, status: "新线索",
    route: "销售 + 工程", priority: "高", product: "机器人域控制器", model: "nRB-H1", productImage: withBasePath("/products/domain-controller.png"),
    quantity: "50–100 套 / 年", scene: "协作机械臂", stage: "样机验证", target: "3 个月内", address: "Munich, Germany",
    need: "精密装配机械臂，需要高重复定位精度、紧凑结构和与现有产线集成。", nextAction: "安排系统工程师确认实时控制、安装空间和负载边界。",
  },
  {
    id: "L-20260729-0058", createdAt: "今天 09:42", source: "标准订单", company: "Alpha Automation", companyType: "系统集成商",
    contact: "James Cole", contactDetail: "purchasing@alphaauto.com", country: "美国", city: "底特律", score: 78, status: "销售跟进",
    route: "销售", priority: "高", product: "高可靠 IMU 模组", model: "IMU-MCU-01", productImage: withBasePath("/products/imu-module.webp"),
    quantity: "24 件", scene: "AMR / AGV", stage: "小批量验证", target: "1 个月内", address: "Detroit, USA",
    need: "采购标准 IMU 模组用于仓储 AMR 小批量验证。", nextAction: "确认批量交期并发送正式报价。",
  },
  {
    id: "L-20260729-0057", createdAt: "今天 10:05", source: "定制需求", company: "SmartFab Solutions", companyType: "系统集成商",
    contact: "Olivia Brown", contactDetail: "hello@smartfab.co.uk", country: "英国", city: "曼彻斯特", score: 64, status: "工程评审",
    route: "工程", priority: "中", product: "机器人域控制器", model: "nRB-H1", productImage: withBasePath("/products/domain-controller.png"),
    quantity: "20–50 套 / 年", scene: "协作机械臂", stage: "概念设计", target: "6 个月内", address: "Manchester, UK",
    need: "希望整合视觉感知、运动控制和安全通信，功耗与散热条件待确认。", nextAction: "补充整机功耗、散热和机械安装资料。",
  },
  {
    id: "L-20260729-0056", createdAt: "今天 10:33", source: "标准订单", company: "NexGen Robotics", companyType: "机器人整机厂商",
    contact: "Liam Martin", contactDetail: "rfq@nexgenrobotics.ca", country: "加拿大", city: "多伦多", score: 81, status: "新线索",
    route: "销售", priority: "高", product: "双目深度相机", model: "DPC-48-XM-A1", productImage: withBasePath("/products/depth-camera.webp"),
    quantity: "36 件", scene: "服务机器人", stage: "样机验证", target: "1 个月内", address: "Toronto, Canada",
    need: "室内服务机器人需要深度、RGB 与 IMU 融合感知。", nextAction: "确认库存、USB-C 接口与批量交付计划。",
  },
  {
    id: "L-20260729-0055", createdAt: "今天 11:02", source: "定制需求", company: "MechPro Systems", companyType: "创新团队",
    contact: "Arjun Rao", contactDetail: "buy@mechpro.in", country: "印度", city: "班加罗尔", score: 58, status: "培育中",
    route: "培育", priority: "中", product: "车规级鱼眼相机", model: "FSC-210", productImage: withBasePath("/products/fisheye-camera.webp"),
    quantity: "5–10 套 / 年", scene: "AMR / AGV", stage: "概念设计", target: "待确认", address: "Bengaluru, India",
    need: "早期 AMR 项目，需要评估超广角视觉 SLAM 的可行性。", nextAction: "发送产品资料并在两周后自动回访。",
  },
  {
    id: "L-20260729-0054", createdAt: "今天 11:27", source: "标准订单", company: "Nordic Automate", companyType: "高校 / 研究机构",
    contact: "Erik Lund", contactDetail: "contact@nordicautomate.se", country: "瑞典", city: "斯德哥尔摩", score: 45, status: "培育中",
    route: "培育", priority: "低", product: "高可靠 IMU 模组", model: "IMU-MCU-01", productImage: withBasePath("/products/imu-module.webp"),
    quantity: "2 件", scene: "人形机器人", stage: "概念设计", target: "待确认", address: "Stockholm, Sweden",
    need: "实验室姿态控制研究样品。", nextAction: "自动发送样品政策与开发资料。",
  },
];

function estimateCustomPrice(scene: string, stage: string, priority: string, need: string) {
  const sceneBase: Record<string, number> = {
    "人形机器人": 160000,
    "AMR / AGV": 90000,
    "协作机械臂": 120000,
    "服务机器人": 70000,
    "其他": 60000,
  };
  const stageFactor: Record<string, number> = {
    "概念设计": 1.25,
    "Demo / 样机": 1.15,
    "样机验证": 1,
    "小批量验证": 1.2,
    "量产导入": 1.4,
  };
  const complexityKeywords = ["定制", "安全", "认证", "散热", "功耗", "实时", "EtherCAT", "多传感器", "结构", "算法"];
  const complexityHits = complexityKeywords.filter((keyword) => need.includes(keyword)).length;
  const priorityFactor = priority === "紧急样机" ? 1.18 : priority === "量产项目" ? 1.28 : 1;
  const complexityFactor = 1 + Math.min(complexityHits, 4) * 0.08;
  const midpoint = (sceneBase[scene] ?? 60000) * (stageFactor[stage] ?? 1.1) * priorityFactor * complexityFactor;
  const roundToTenThousand = (value: number) => Math.max(30000, Math.round(value / 10000) * 10000);
  const low = roundToTenThousand(midpoint * 0.72);
  const high = roundToTenThousand(midpoint * 1.38);
  const format = (value: number) => `¥${value / 10000}万`;
  const reasons = [
    `${scene}方案与样机适配`,
    `${stage}阶段的工程投入`,
    priority === "紧急样机" ? "加急样机资源协调" : priority === "量产项目" ? "量产导入与验证准备" : "常规交付节奏",
  ];
  if (complexityHits) reasons.push(`${complexityHits} 项复杂技术约束`);
  return { low, high, label: `${format(low)} – ${format(high)}`, reasons };
}

function Logo({ inverse = false, onClick }: { inverse?: boolean; onClick?: () => void }) {
  return (
    <button className="brand" onClick={onClick ?? (() => window.scrollTo({ top: 0, behavior: "smooth" }))} aria-label="返回首页">
      <img
        className="brand-logo"
        src={inverse ? withBasePath("/assets/brand/joynext-logo-light.png") : withBasePath("/assets/brand/joynext-logo-dark.png")}
        alt="JOYNEXT 均联智行"
      />
    </button>
  );
}

function AiAssistantDrawer({
  open,
  onClose,
  brief,
  selected,
  view,
  promptRequest,
  onSelectProduct,
}: {
  open: boolean;
  onClose: () => void;
  brief: DiscoveryBrief;
  selected: Product;
  view: View;
  promptRequest: AssistantPrompt | null;
  onSelectProduct: (product: Product) => void;
}) {
  const [input, setInput] = useState("");
  const [dismissedPromptId, setDismissedPromptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([{
    role: "assistant",
    content: "你好，我是 JOYNEXT AI 选型助理。你可以描述机器人类型、任务、工作距离、接口、环境和项目阶段，我会基于已确认的产品资料推荐候选产品或组合方案。",
  }]);

  const composerValue = promptRequest && dismissedPromptId !== promptRequest.id ? promptRequest.text : input;

  async function sendMessage(question?: string) {
    const content = (question ?? composerValue).trim();
    if (!content || loading) return;
    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setDismissedPromptId(promptRequest?.id ?? null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch(withBasePath("/api/assistant"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          context: {
            scene: brief.scene,
            goal: brief.goal,
            stage: brief.stage,
            view,
            selectedProduct: `${selected.model} · ${selected.name}`,
          },
        }),
      });
      const data = await response.json() as {
        answer?: string;
        error?: string;
        products?: AssistantMessage["products"];
        boundary?: string;
      };
      if (!response.ok || !data.answer) throw new Error(data.error || "AI 服务暂时不可用。");
      setMessages((current) => [...current, {
        role: "assistant",
        content: data.answer!,
        products: data.products,
        boundary: data.boundary,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI 服务连接失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  const quickPrompts = [
    "仓储 AMR 需要 0.3–4 米避障和 USB 接口，推荐什么？",
    "对比三款 DPC 深度相机的工作距离和接口",
    "nRB-H1 能接入哪些传感器？哪些参数仍需工程确认？",
    "给人形机器人提供一套感知、姿态与集中控制组合方案",
  ];

  return (
    <div className={open ? "ai-assistant-layer open" : "ai-assistant-layer"} aria-hidden={!open}>
      <button className="ai-assistant-backdrop" aria-label="关闭 AI 助理" onClick={onClose} />
      <aside className="ai-assistant-drawer" aria-label="JOYNEXT AI 选型助理">
        <header>
          <div><span>AI</span><p><small>REAL PRODUCT COPILOT</small><b>JOYNEXT AI 选型助理</b></p></div>
          <button onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="assistant-context">
          <span><b>场景</b>{brief.scene}</span>
          <span><b>目标</b>{brief.goal}</span>
          <span><b>阶段</b>{brief.stage}</span>
        </div>
        <div className="assistant-messages" aria-live="polite">
          {messages.map((message, index) => (
            <article className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}>
              <span>{message.role === "assistant" ? "AI" : "你"}</span>
              <div>
                <p>{message.content}</p>
                {message.products?.length ? (
                  <div className="assistant-product-results">
                    {message.products.map((result) => {
                      const product = products.find((item) => item.id === result.id);
                      return (
                        <button key={result.id} onClick={() => product && onSelectProduct(product)}>
                          <img src={withBasePath(result.image)} alt="" />
                          <span><small>{result.model} · {result.status}</small><b>{result.name}</b><em>{result.verified.slice(0, 2).join(" · ")}</em></span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {message.boundary && <small className="assistant-boundary">ⓘ {message.boundary}</small>}
              </div>
            </article>
          ))}
          {loading && <article className="assistant-message assistant thinking"><span>AI</span><div><p>正在检索产品资料并整理方案<span className="thinking-dots">…</span></p></div></article>}
        </div>
        {messages.length === 1 && (
          <div className="assistant-quick-prompts">
            <span>可以这样问</span>
            {quickPrompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)}>{prompt}<b>→</b></button>)}
          </div>
        )}
        {error && <div className="assistant-error">{error}<button onClick={() => setError("")}>×</button></div>}
        <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
          <textarea value={composerValue} onChange={(event) => { setDismissedPromptId(promptRequest?.id ?? null); setInput(event.target.value); }} placeholder="描述机器人任务、距离、接口、环境或直接输入产品型号…" maxLength={4000} />
          <div><span>资料内回答 · 不确定项转人工</span><button disabled={loading || !composerValue.trim()} type="submit">发送 ↑</button></div>
        </form>
      </aside>
    </div>
  );
}

function Header({
  onNavigate,
  onNavigateSection,
  onOpenAssistant,
}: {
  onNavigate: (view: View) => void;
  onNavigateSection: (sectionId: string) => void;
  onOpenAssistant: () => void;
}) {
  return (
    <header className="site-header">
      <Logo onClick={() => onNavigate("home")} />
      <nav aria-label="主导航">
        <button onClick={() => onNavigateSection("products")}>产品中心</button>
        <button onClick={() => onNavigateSection("scenarios")}>机器人场景</button>
        <button onClick={() => onNavigateSection("workflow")}>选型流程</button>
        <button onClick={() => onNavigateSection("support")}>技术支持</button>
        <a href={withBasePath("/admin")}>管理端</a>
      </nav>
      <div className="header-actions">
        <button className="text-button">中 / EN</button>
        <button className="text-button ops-entry" onClick={() => window.location.assign(withBasePath("/admin"))}>管理端</button>
        <button className="ai-header-button" onClick={onOpenAssistant}><span>AI</span> 智能选型</button>
        <button className="outline-button compact" onClick={() => onNavigate("custom")}>联系销售</button>
      </div>
    </header>
  );
}

function Progress({ step, custom = false }: { step: number; custom?: boolean }) {
  const labels = custom
    ? ["需求描述", "附件与联系人", "提交完成"]
    : ["选择标准件", "确认配置", "下单完成"];
  return (
    <div className="progress" aria-label="流程进度">
      {labels.map((label, index) => (
        <div className={index + 1 <= step ? "progress-step active" : "progress-step"} key={label}>
          <span>{index + 1 < step ? "✓" : index + 1}</span>
          <b>{label}</b>
        </div>
      ))}
    </div>
  );
}

function AiJourneyRibbon({
  view,
  brief,
  selected,
  onOpenAssistant,
}: {
  view: View;
  brief: DiscoveryBrief;
  selected: Product;
  onOpenAssistant: () => void;
}) {
  const activeStep = view === "home" ? 1 : view === "standard" ? 2 : 3;
  const message = view === "home"
    ? `正在围绕“${brief.scene} · ${brief.goal}”持续理解需求`
    : view === "standard"
      ? `已带入场景上下文，正在校验 ${selected.model} 的配置适配性`
      : `已继承前序选型上下文，正在补全工程评估信息`;
  return (
    <section className="ai-journey-ribbon" aria-label="AI 协同选型进度">
      <div className="ai-journey-status"><span>AI</span><p><b>选型 Copilot 持续在线</b><small>{message}</small></p></div>
      <div className="ai-journey-steps">
        {["理解场景", "推荐与校验", "形成可跟进需求"].map((item, index) => (
          <span className={index + 1 <= activeStep ? "active" : ""} key={item}><i>{index + 1 < activeStep ? "✓" : index + 1}</i>{item}</span>
        ))}
      </div>
      <button className="ai-ribbon-action" onClick={onOpenAssistant}>向 AI 描述需求 →</button>
    </section>
  );
}

function AiDiscoveryWorkspace({
  brief,
  onBriefChange,
  onNavigate,
  onSelect,
  onAskAi,
}: {
  brief: DiscoveryBrief;
  onBriefChange: (brief: DiscoveryBrief) => void;
  onNavigate: (view: View) => void;
  onSelect: (product: Product) => void;
  onAskAi: (prompt: string) => void;
}) {
  const recommendations = useMemo(() => recommendProducts(brief), [brief]);
  const primary = recommendations[0];

  const startConfiguration = (product: Product) => {
    onSelect(product);
    onNavigate("standard");
  };

  return (
    <section className="ai-discovery-workspace" id="ai-discovery">
      <div className="ai-discovery-heading">
        <div><span className="ai-orb compact">AI</span><p><small>CONTEXTUAL PRODUCT COPILOT</small><b>先说场景，AI 和你一起缩小选型范围</b></p></div>
        <span className="ai-live-state"><i /> 推荐随选择实时更新</span>
      </div>
      <div className="ai-discovery-grid">
        <div className="ai-brief-builder">
          <label>
            <span>1 · 机器人场景</span>
            <div className="choice-chips">
              {discoveryScenes.map((scene) => (
                <button className={brief.scene === scene ? "active" : ""} type="button" key={scene} onClick={() => onBriefChange({ ...brief, scene })}>{scene}</button>
              ))}
            </div>
          </label>
          <label>
            <span>2 · 当前最想解决的问题</span>
            <div className="choice-chips goal-chips">
              {discoveryGoals.map((goal) => (
                <button className={brief.goal === goal ? "active" : ""} type="button" key={goal} onClick={() => onBriefChange({ ...brief, goal })}>{goal}</button>
              ))}
            </div>
          </label>
          <label className="ai-stage-field">
            <span>3 · 项目阶段</span>
            <select value={brief.stage} onChange={(event) => onBriefChange({ ...brief, stage: event.target.value as DiscoveryBrief["stage"] })}>
              <option>概念设计</option><option>Demo / 样机</option><option>样机验证</option><option>小批量验证</option>
            </select>
            <small>阶段会影响标准件优先级、工程介入方式和交期提示。</small>
          </label>
        </div>
        <div className="ai-recommendation-result" aria-live="polite">
          <div className="recommendation-topline"><span>首选建议 · {primary.score}% 场景匹配</span><b>基于已确认产品资料</b></div>
          <div className="recommended-product">
            <img src={primary.product.image} alt="" />
            <div><small>{primary.product.model}</small><h3>{primary.product.name}</h3><p>{primary.reason}。</p></div>
          </div>
          <div className="ai-reasoning">
            <span>为什么推荐</span>
            <p>你的目标是“{brief.goal}”，处于{brief.stage}阶段。AI 优先考虑场景覆盖、现有接口能力与当前可交付状态。</p>
          </div>
          <div className="recommendation-actions">
            <button className="primary-button" onClick={() => startConfiguration(primary.product)}>带着上下文继续配置 →</button>
            <button className="outline-button" onClick={() => onAskAi(`请结合我的${brief.scene}场景、${brief.goal}目标和${brief.stage}阶段，解释为什么推荐 ${primary.product.model}，并给出候选组合方案和需要确认的问题。`)}>让真实 AI 深入分析</button>
          </div>
          <div className="alternative-products">
            <span>也可比较</span>
            {recommendations.slice(1, 3).map(({ product, score }) => (
              <button key={product.id} onClick={() => startConfiguration(product)}><b>{product.model}</b><small>{score}% 匹配</small></button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Home({
  onNavigate,
  onSelect,
  brief,
  onBriefChange,
  onAskAi,
}: {
  onNavigate: (v: View) => void;
  onSelect: (p: Product) => void;
  brief: DiscoveryBrief;
  onBriefChange: (brief: DiscoveryBrief) => void;
  onAskAi: (prompt: string) => void;
}) {
  const [query, setQuery] = useState("");
  const recommendations = useMemo(() => recommendProducts(brief), [brief]);
  const recommendedId = recommendations[0].product.id;
  const visible = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter((p) => `${p.name}${p.model}${p.kind}${p.description}`.toLowerCase().includes(q));
  }, [query]);

  function startSearch(event: FormEvent) {
    event.preventDefault();
    const product = visible[0] ?? products[0];
    onSelect(product);
    onNavigate("standard");
  }

  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span /> JOYNEXT 机器人部件选型中心</div>
            <h1>从机器人场景出发，<br /><em>更快选对核心部件</em></h1>
            <p>核对已确认参数、按规则完成选型；标准件直接下单，复杂定制需求由销售与工程师联合接入。</p>
            <form className="search-box" onSubmit={startSearch}>
              <label>
                <span className="search-icon">⌕</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索产品、型号或参数，例如：EtherCAT 深度相机" />
              </label>
              <button type="submit" className="primary-button">搜索产品</button>
            </form>
            <div className="hot-searches">
              <span>热门：</span>
              {["nRB-H1", "鱼眼相机", "深度相机", "IMU"].map((item) => (
                <button key={item} onClick={() => setQuery(item)}>{item}</button>
              ))}
              <button className="ask-ai-hot" onClick={() => onAskAi(query.trim() ? `请根据这个需求帮我搜索产品并给出方案：${query}` : "我还不确定具体型号，请通过几个关键问题帮我完成机器人元器件选型。")}>✦ 不确定型号？问 AI</button>
            </div>
          </div>
          <div className="hero-visual">
            <img src={withBasePath("/scenes/amr-warehouse.jpeg")} alt="仓储 AMR 机器人场景" />
            <div className="hero-overlay">
              <span className="live-dot" /> 场景方案已上线
              <strong>AMR 多传感器感知套件</strong>
              <button onClick={() => onNavigate("standard")}>查看推荐配置 →</button>
            </div>
            <div className="floating-stat stat-one"><b>{products.length}</b><span>项资料产品</span></div>
            <div className="floating-stat stat-two"><b>2</b><span>条成交路径</span></div>
          </div>
        </div>
      </section>

      <main>
        <AiDiscoveryWorkspace brief={brief} onBriefChange={onBriefChange} onNavigate={onNavigate} onSelect={onSelect} onAskAi={onAskAi} />

        <section className="path-section" id="workflow">
          <div className="section-heading center">
            <span>START HERE</span>
            <h2>你现在要解决哪类需求？</h2>
            <p>系统根据需求复杂度自动进入标准选型或工程定制流程。</p>
          </div>
          <div className="path-grid">
            <article className="path-card standard" id="standard-order">
              <div className="path-topline"><span>路径 A</span><b>标准件 · 可直接下单</b></div>
              <div className="path-icon">✓</div>
              <div>
                <h3>参数明确，快速完成配置</h3>
                <p>适用于接口、量程、尺寸和使用环境已确认的产品。</p>
                <ul>
                  <li>查看已确认参数与来源</li>
                  <li>同类产品快速比较</li>
                  <li>规则化配置并生成订单</li>
                </ul>
              </div>
              <button className="primary-button" onClick={() => onNavigate("standard")}>开始标准选型 <span>→</span></button>
            </article>
            <article className="path-card custom">
              <div className="path-topline"><span>路径 B</span><b>定制件 · 销售在线接入</b></div>
              <div className="path-icon">✦</div>
              <div>
                <h3>需求复杂，联合工程师评估</h3>
                <p>适用于结构、接口、环境或交付要求需要联合定义的项目。</p>
                <ul>
                  <li>提交结构化需求单</li>
                  <li>销售部门即时接入</li>
                  <li>约定报价与工期单生成时间</li>
                </ul>
              </div>
              <button className="dark-button" onClick={() => onNavigate("custom")}>提交定制需求 <span>→</span></button>
            </article>
          </div>
        </section>

        <section className="scenario-section" id="scenarios">
          <div className="section-heading">
            <span>ROBOT SCENARIOS</span>
            <h2>按机器人场景进入产品</h2>
            <p>从应用任务出发，减少跨品类搜索成本。</p>
          </div>
          <div className="scenario-grid">
            {scenarios.map((scenario) => (
              <button className="scenario-card" key={scenario.name} onClick={() => {
                const scene = scenario.name === "机械臂" ? "协作机械臂" : scenario.name as DiscoveryBrief["scene"];
                const nextBrief = { ...brief, scene };
                onBriefChange(nextBrief);
                onSelect(recommendProducts(nextBrief)[0].product);
                onNavigate("standard");
              }}>
                <img src={scenario.image} alt="" />
                <div><span>{scenario.icon}</span><h3>{scenario.name}</h3><p>{scenario.note}</p><b>AI 已准备场景建议 →</b></div>
              </button>
            ))}
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-heading split">
            <div><span>VERIFIED PRODUCTS</span><h2>已确认参数产品</h2><p>参数来自你提供的产品资料；工程状态产品会明确提示复核。</p></div>
            <button className="outline-button" onClick={() => onNavigate("standard")}>查看全部产品 →</button>
          </div>
          <div className="product-grid">
            {visible.map((product) => (
              <article className={product.id === recommendedId ? "product-card ai-recommended" : "product-card"} key={product.id}>
                <div className="product-image"><span>{product.kind}</span>{product.id === recommendedId && <b className="ai-match-badge">AI 首选 · {recommendations[0].score}%</b>}<img src={product.image} alt={product.name} /></div>
                <div className="product-body">
                  <small>{product.model}</small>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="spec-chips">{product.verified.slice(0, 2).map((s) => <span key={s}>✓ {s}</span>)}</div>
                  <div className="product-foot"><strong>{product.price}</strong><span><button onClick={() => onAskAi(`请解释 ${product.model} ${product.name} 的能力、适用场景、与相近产品的差异，以及哪些信息仍需工程师确认。`)}>问 AI</button><button onClick={() => { onSelect(product); onNavigate("standard"); }}>查看配置 →</button></span></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ai-strip" id="support">
          <div><span className="ai-orb">AI</span><div><small>贯穿式 AI 协同</small><h2>每一步都保留上下文，不再重复提问</h2><p>场景、目标和项目阶段会持续带入产品推荐、参数解释、配置校验、需求补全和销售摘要；系统级风险仍由工程师确认。</p></div></div>
          <div className="ai-capability-list"><span>场景导购</span><span>配置校验</span><span>需求补全</span><span>线索摘要</span></div>
        </section>
      </main>
    </>
  );
}

function ProductList({
  selected,
  onSelect,
  recommendedId,
}: {
  selected: Product;
  onSelect: (p: Product) => void;
  recommendedId: string;
}) {
  return (
    <div className="selection-grid">
      {products.map((product) => (
        <button className={product.id === selected.id ? "select-card selected" : "select-card"} onClick={() => onSelect(product)} key={product.id}>
          <div className="select-image"><img src={product.image} alt="" /><span>{product.kind}</span>{product.id === recommendedId && <b className="ai-select-match">AI 首选</b>}</div>
          <div><small>{product.model}</small><h3>{product.name}</h3><p>{product.description}</p></div>
          <div className="select-bottom"><strong>{product.price}</strong><span>{product.lead}</span></div>
        </button>
      ))}
    </div>
  );
}

function StandardFlow({
  selected,
  onSelect,
  onHome,
  onCustom,
  onComplete,
  onLeadCreated,
  onViewOperations,
  brief,
  onBriefChange,
  onAskAi,
}: {
  selected: Product;
  onSelect: (p: Product) => void;
  onHome: () => void;
  onCustom: () => void;
  onComplete: () => void;
  onLeadCreated: (lead: LeadRecord) => void;
  onViewOperations: () => void;
  brief: DiscoveryBrief;
  onBriefChange: (brief: DiscoveryBrief) => void;
  onAskAi: (prompt: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [qty, setQty] = useState(1);
  const [productConfigurations, setProductConfigurations] = useState<Record<string, Record<string, string>>>({});
  const [orderId, setOrderId] = useState("");
  const [customer, setCustomer] = useState<StandardCustomer>({
    company: "",
    companyType: "机器人整机厂商",
    contact: "",
    contactDetail: "",
    country: "中国",
    city: "",
    address: "",
    postalCode: "",
  });
  const updateCustomer = (key: keyof StandardCustomer, value: string) =>
    setCustomer((current) => ({ ...current, [key]: value }));
  const configuration = productConfigurations[selected.id]
    ?? Object.fromEntries(selected.configuration.map((item) => [item.key, item.options[0]]));
  const setConfigurationValue = (key: string, value: string) =>
    setProductConfigurations((current) => ({
      ...current,
      [selected.id]: { ...configuration, [key]: value },
    }));
  const engineering = selected.engineeringReview;
  const primaryInterface = configuration.interface ?? configuration.realtime ?? configuration.network ?? "按所选方案";
  const total = (demoUnitPrices[selected.id] ?? 0) * qty;
  const customerComplete = [customer.company, customer.contact, customer.contactDetail, customer.country, customer.city, customer.address]
    .every((value) => value.trim().length > 0);
  const customerLocation = `${customer.country} · ${customer.city}`;
  const recommendations = useMemo(() => recommendProducts(brief), [brief]);
  const recommended = recommendations[0];
  const selectedMatch = recommendations.find((item) => item.product.id === selected.id) ?? recommendations[0];
  const configurationSignals = [
    {
      label: "场景适配",
      status: `${selectedMatch.score}%`,
      tone: selectedMatch.score >= 85 ? "good" : "attention",
      detail: `${selected.model} 与“${brief.scene} · ${brief.goal}”的资料匹配度`,
    },
    {
      label: "配置风险",
      status: engineering ? "需工程确认" : primaryInterface.includes("需确认") || primaryInterface.includes("EtherCAT") ? "需核对接口" : "资料内可配置",
      tone: engineering || primaryInterface.includes("需确认") || primaryInterface.includes("EtherCAT") ? "attention" : "good",
      detail: engineering ? "最终接口、安装、环境与系统边界需要联合评审" : `${primaryInterface} 已纳入采购意向摘要`,
    },
    {
      label: "商务动作",
      status: qty > 10 ? "销售介入" : "可自助提交",
      tone: qty > 10 ? "attention" : "good",
      detail: qty > 10 ? "批量需求将自动确认阶梯价格、库存和排期" : "补全客户与地址后即可进入订单队列",
    },
  ];

  function submitStandardOrder() {
    if (!customerComplete || engineering || orderId) return;
    const id = `JN-20260729-${Date.now().toString().slice(-4)}`;
    const score = Math.min(95, 68 + (qty > 10 ? 12 : qty > 3 ? 7 : 3) + (customer.companyType === "机器人整机厂商" ? 8 : 5));
    const priority: LeadRecord["priority"] = score >= 75 ? "高" : score >= 55 ? "中" : "低";
    const lead: LeadRecord = {
      id,
      createdAt: "刚刚",
      source: "标准订单",
      company: customer.company.trim(),
      companyType: customer.companyType,
      contact: customer.contact.trim(),
      contactDetail: customer.contactDetail.trim(),
      country: customer.country.trim(),
      city: customer.city.trim(),
      score,
      status: "新线索",
      route: qty > 10 ? "销售高优先级" : "销售",
      priority,
      product: selected.name,
      model: selected.model,
      productImage: selected.image,
      quantity: `${qty} 件`,
      scene: selected.kind,
      stage: qty > 10 ? "小批量验证" : "样品 / Demo",
      target: selected.lead,
      need: `客户选择 ${Object.entries(configuration).map(([key, value]) => `${key}=${value}`).join("；")}，提交 ${qty} 件采购意向，需要确认正式价格、库存和交期。`,
      address: `${customer.country} ${customer.city} ${customer.address}${customer.postalCode ? `，${customer.postalCode}` : ""}`,
      nextAction: qty > 10 ? "销售确认批量库存、阶梯价格和交付排期。" : "销售确认订单、正式价格和发货安排。",
      estimatedPrice: total ? `¥${total.toLocaleString()}` : "工程确认后报价",
    };
    setOrderId(id);
    onLeadCreated(lead);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="flow-shell">
      <div className="flow-bar">
        <button className="back-button" onClick={onHome}>← 返回产品中心</button>
        <Progress step={step} />
        <span className="service-badge"><i /> 销售在线</span>
      </div>
      {step === 1 && (
        <section className="flow-content">
          <div className="flow-title">
            <span>STANDARD PRODUCT PATH</span>
            <h1>选择一个标准产品</h1>
            <p>所有展示参数均标注状态；工程样件在下单前必须完成技术确认。</p>
          </div>
          <div className="ai-selection-guide">
            <div className="ai-guide-copy"><span>AI</span><p><small>已继承首页场景</small><b>{brief.scene} · {brief.goal}</b><em>{brief.stage}</em></p></div>
            <div className="ai-guide-reason"><span>当前首选</span><b>{recommended.product.model} · {recommended.product.name}</b><p>{recommended.reason}。</p></div>
            <div className="ai-guide-refine">
              <span>快速调整目标</span>
              <select value={brief.goal} onChange={(event) => onBriefChange({ ...brief, goal: event.target.value as DiscoveryBrief["goal"] })}>
                {discoveryGoals.map((goal) => <option key={goal}>{goal}</option>)}
              </select>
            </div>
          </div>
          <ProductList selected={selected} onSelect={onSelect} recommendedId={recommended.product.id} />
          <div className="sticky-actions">
            <div><span>当前选择</span><strong>{selected.model} · {selected.name}</strong></div>
            <button className="primary-button" onClick={() => setStep(2)}>确认并配置 →</button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="config-layout">
          <div className="config-main">
            <button className="back-link" onClick={() => setStep(1)}>← 更换产品</button>
            <div className="config-product">
              <img src={selected.image} alt={selected.name} />
              <div><span className="verified-pill">✓ 资料已核对</span><small>{selected.model}</small><h1>{selected.name}</h1><p>{selected.description}</p></div>
            </div>
            <div className="panel">
              <div className="panel-heading"><h2>已确认参数</h2><span>来源：产品资料 2026-07-29</span></div>
              <div className="verified-table">
                {selected.verified.map((item, index) => <div key={item}><span>{["性能 / 规格", "电气 / 范围", "环境 / 接口", "扩展能力"][index] ?? "参数"}</span><strong>{item}</strong><b>✓ 已确认</b></div>)}
              </div>
            </div>
            <div className="panel">
              <div className="panel-heading"><h2>配置选项</h2><span>带 * 为必选</span></div>
              <div className="config-fields">
                {selected.configuration.map((item) => (
                  <label key={item.key}>
                    <span>{item.label}</span>
                    <select value={configuration[item.key] ?? item.options[0]} onChange={(event) => setConfigurationValue(item.key, event.target.value)}>
                      {item.options.map((option) => <option key={option}>{option}</option>)}
                    </select>
                    {item.note && <small className="field-note">{item.note}</small>}
                  </label>
                ))}
                <label><span>数量 *</span><div className="quantity"><button type="button" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><input value={qty} readOnly /><button type="button" onClick={() => setQty(qty + 1)}>＋</button></div></label>
              </div>
            </div>
            <div className="ai-configuration-companion" aria-live="polite">
              <div className="ai-companion-heading"><span>AI</span><p><small>CONTEXT-AWARE CHECK</small><b>配置变化已实时纳入评估</b></p><button type="button" onClick={() => onAskAi(`请评估我为${brief.scene}选择的 ${selected.model} 配置：${Object.entries(configuration).map(([key, value]) => `${key}=${value}`).join("；")}。说明匹配点、风险和仍需确认的参数。`)}>让 AI 评估当前配置 →</button></div>
              <div className="ai-signal-grid">
                {configurationSignals.map((signal) => (
                  <div className={signal.tone} key={signal.label}><span>{signal.label}</span><strong>{signal.status}</strong><p>{signal.detail}</p></div>
                ))}
              </div>
              <p className="ai-handoff-note"><b>下一步建议：</b>{engineering ? "转入定制需求，AI 会保留当前产品、场景和风险点，工程师无需从头询问。" : customerComplete ? "信息已完整，可以提交；AI 将自动生成客户标签与销售跟进摘要。" : "继续补全公司与收货信息，缺失项不会被猜测或自动填写。"}</p>
            </div>
            <div className="panel customer-panel">
              <div className="panel-heading">
                <div><h2>公司与收货信息</h2><p>用于识别客户主体、区域分群、订单履约和长期服务跟进。</p></div>
                <span>带 * 为必填</span>
              </div>
              <div className="config-fields">
                <label>
                  <span>公司名称 *</span>
                  <input autoComplete="organization" value={customer.company} onChange={(e) => updateCustomer("company", e.target.value)} placeholder="公司完整名称" />
                </label>
                <label>
                  <span>客户类型 *</span>
                  <select value={customer.companyType} onChange={(e) => updateCustomer("companyType", e.target.value)}>
                    <option>机器人整机厂商</option>
                    <option>系统集成商</option>
                    <option>高校 / 研究机构</option>
                    <option>创新团队</option>
                    <option>经销商 / 渠道伙伴</option>
                    <option>其他</option>
                  </select>
                </label>
                <label>
                  <span>联系人 *</span>
                  <input autoComplete="name" value={customer.contact} onChange={(e) => updateCustomer("contact", e.target.value)} placeholder="姓名" />
                </label>
                <label>
                  <span>手机 / 邮箱 *</span>
                  <input autoComplete="email" value={customer.contactDetail} onChange={(e) => updateCustomer("contactDetail", e.target.value)} placeholder="便于订单确认与后续联系" />
                </label>
                <label>
                  <span>国家 / 地区 *</span>
                  <input autoComplete="country-name" value={customer.country} onChange={(e) => updateCustomer("country", e.target.value)} placeholder="例如：中国、德国" />
                </label>
                <label>
                  <span>省 / 州 / 城市 *</span>
                  <input autoComplete="address-level2" value={customer.city} onChange={(e) => updateCustomer("city", e.target.value)} placeholder="例如：上海市嘉定区" />
                </label>
                <label className="full-field">
                  <span>详细地址 *</span>
                  <input autoComplete="street-address" value={customer.address} onChange={(e) => updateCustomer("address", e.target.value)} placeholder="街道、门牌号、楼宇及房间号" />
                </label>
                <label>
                  <span>邮政编码</span>
                  <input autoComplete="postal-code" value={customer.postalCode} onChange={(e) => updateCustomer("postalCode", e.target.value)} placeholder="选填" />
                </label>
              </div>
              <div className="tracking-note"><span>CRM</span><p><b>客户档案标签将自动生成</b>：{customer.companyType} · {customer.country || "待填写地区"} · 标准件客户，便于销售按客户类型和区域筛选、合并历史订单并持续跟进。</p></div>
            </div>
            <div className={engineering ? "engineer-warning" : "ai-explanation"}>
              <span>{engineering ? "!" : "AI"}</span>
              <div>
                <h3>{engineering ? "需要工程师确认" : "AI 配置解释"}</h3>
                <p>{engineering
                  ? "nRB-H1 当前处于初步工程状态，散热、功耗、机械安装和 EtherCAT 组合需按整机方案复核。"
                  : `${primaryInterface} 已按产品资料纳入配置。${qty > 10 ? "数量超过 10 件，系统将自动提醒销售确认批量价格、库存和交期。" : "当前数量可提交采购意向，正式价格与交期仍需确认。"}`}</p>
                {engineering && <button onClick={onCustom}>转为定制需求，与工程师联合评估 →</button>}
              </div>
            </div>
          </div>
          <aside className="order-summary">
            <span className="summary-label">配置摘要</span>
            <img src={selected.image} alt="" />
            <small>{selected.model}</small>
            <h2>{selected.name}</h2>
            <dl>
              {selected.configuration.slice(0, 3).map((item) => <div key={item.key}><dt>{item.label.replace(" *", "")}</dt><dd>{configuration[item.key]}</dd></div>)}
              <div><dt>数量</dt><dd>{qty} 件</dd></div><div><dt>交期</dt><dd>{selected.lead}</dd></div>
            </dl>
            <div className="price-row"><span>预估金额</span><strong>{total ? `¥${total.toLocaleString()}` : "工程确认后报价"}</strong></div>
            <p className="small-note">{customerComplete ? `客户：${customer.company} · ${customerLocation}` : "请完整填写公司、联系人和收货地址后提交。"}价格与交期为原型演示信息，最终以正式订单或报价单为准。</p>
            <button className="primary-button full" disabled={engineering || !customerComplete} onClick={submitStandardOrder}>提交采购意向 →</button>
            {engineering && <button className="outline-button full" onClick={onCustom}>提交询价需求</button>}
          </aside>
        </section>
      )}
      {step === 3 && (
        <section className="confirmation">
          <div className="success-mark">✓</div>
          <span>ORDER CREATED</span>
          <h1>标准件订单已生成</h1>
          <p>订单号 <b>{orderId}</b>，已完成评分并进入销售线索队列。</p>
          <div className="confirmation-card">
            <div><small>产品</small><strong>{selected.model} · {selected.name}</strong></div>
            <div><small>数量</small><strong>{qty} 件</strong></div>
            <div><small>关键配置</small><strong>{primaryInterface}</strong></div>
            <div><small>预计发货</small><strong>{selected.lead}</strong></div>
          </div>
          <div className="customer-profile-card">
            <div className="customer-profile-heading"><span>客户档案与销售跟进摘要</span><b>已进入标准件客户队列</b></div>
            <div className="customer-profile-grid">
              <div><small>公司主体</small><strong>{customer.company}</strong><span>{customer.companyType}</span></div>
              <div><small>联系人</small><strong>{customer.contact}</strong><span>{customer.contactDetail}</span></div>
              <div><small>客户区域</small><strong>{customerLocation}</strong><span>{customer.postalCode ? `邮编 ${customer.postalCode}` : "未填写邮编"}</span></div>
              <div><small>收货地址</small><strong>{customer.address}</strong><span>用于订单履约与区域服务分配</span></div>
            </div>
            <p>系统将以公司主体和联系方式匹配历史询盘与订单，并按“{customer.companyType} / {customer.country} / 标准件客户”标签支持销售筛选和长期追踪。</p>
          </div>
          <div className="sales-timeline"><div className="done"><span>✓</span><b>订单提交</b></div><i /><div className="active"><span>2</span><b>销售确认</b></div><i /><div><span>3</span><b>备货发出</b></div></div>
          <div className="confirmation-actions">
            <button className="outline-button" onClick={onComplete}>返回首页</button>
            <button className="primary-button" onClick={onViewOperations}>查看销售跟进状态 →</button>
          </div>
        </section>
      )}
    </main>
  );
}

function CustomFlow({
  onHome,
  onComplete,
  onLeadCreated,
  onViewOperations,
  brief,
  onAskAi,
}: {
  onHome: () => void;
  onComplete: () => void;
  onLeadCreated: (lead: LeadRecord) => void;
  onViewOperations: () => void;
  brief: DiscoveryBrief;
  onAskAi: (prompt: string) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [priority, setPriority] = useState("常规");
  const [createdLead, setCreatedLead] = useState<LeadRecord | null>(null);
  const [form, setForm] = useState({
    project: "", company: "", contact: "", phone: "", country: "中国", scene: brief.scene,
    volume: "", stage: brief.stage === "概念设计" ? "概念设计" : brief.stage, target: "3 个月内", need: "",
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const priceEstimate = estimateCustomPrice(form.scene, form.stage, priority, form.need);
  const requirementChecks = [
    { label: "任务目标", done: form.need.trim().length >= 18 },
    { label: "接口 / 平台", done: /接口|EtherCAT|CAN|USB|RS485|平台|控制器/i.test(form.need) },
    { label: "环境 / 空间", done: /环境|温度|防护|安装|尺寸|空间|户外|室内/i.test(form.need) },
    { label: "数量 / 时间", done: Boolean(form.volume.trim()) && form.target !== "待确认" },
  ];
  const requirementCompleteness = Math.round(requirementChecks.filter((item) => item.done).length / requirementChecks.length * 100);
  const requirementFragments = form.scene === "AMR / AGV"
    ? ["补充导航速度、避障距离和视场要求", "说明已有控制器及传感器接口", "补充仓库光照、粉尘和温度范围"]
    : form.scene === "人形机器人"
      ? ["补充控制周期、关节数量和算力需求", "说明整机功耗、散热与安装空间", "补充姿态精度、动态范围和安全约束"]
      : ["补充任务节拍、精度和工作距离", "说明已有平台、通信接口和安装方式", "补充环境、防护等级与认证要求"];

  const addRequirementFragment = (fragment: string) => {
    setForm((current) => ({
      ...current,
      need: `${current.need}${current.need.trim() ? "；" : ""}${fragment}：`,
    }));
  };

  if (submitted) {
    return (
      <main className="flow-shell">
        <div className="flow-bar"><button className="back-button" onClick={onHome}>← 返回产品中心</button><Progress step={3} custom /><span className="service-badge"><i /> 已分配销售</span></div>
        <section className="confirmation custom-confirmation">
          <div className="success-mark">✓</div><span>CUSTOM REQUEST RECEIVED</span><h1>定制需求已提交</h1>
          <p>需求单号 <b>{createdLead?.id}</b>，系统评分 <b>{createdLead?.score} / 100</b>，已分流至{createdLead?.route}队列。</p>
          <div className="lead-summary">
            <div><small>负责人</small><strong>机器人业务销售组</strong><span>预计 2 小时内首次联系</span></div>
            <div><small>技术协同</small><strong>域控制器与感知团队</strong><span>工程师已收到结构化摘要</span></div>
            <div><small>约定单据</small><strong>报价单 + 初步工期单</strong><span>2 个工作日内生成</span></div>
          </div>
          <div className="summary-document">
            <div><span>AI 结构化摘要</span><b>已发送给销售与技术人员</b></div>
            <p>{form.company || "客户"}计划在{form.scene}场景中推进“{form.project || "未命名项目"}”，预计需求量 {form.volume || "待确认"}。核心需求：{form.need || "待销售进一步澄清"}。</p>
          </div>
          <div className="custom-price-estimate">
            <div className="price-estimate-heading">
              <div><span>PRELIMINARY ESTIMATE</span><h2>初步方案价格区间</h2></div>
              <strong>{priceEstimate.label}</strong>
            </div>
            <p>当前区间按定制方案的初步工程评估、适配开发和样机准备估算，参考因素包括：</p>
            <div className="estimate-factors">{priceEstimate.reasons.map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
            <div className="estimate-disclaimer"><b>仅供参考，不构成正式报价</b><span>实际价格会受到最终配置、技术边界、样品数量、开发投入、测试认证和交付周期影响，具体价格可与 JOYNEXT 销售进一步沟通确认。</span></div>
          </div>
          <div className="confirmation-actions">
            <button className="outline-button" onClick={onComplete}>完成并返回首页</button>
            <button className="primary-button" onClick={onViewOperations}>进入线索工作台 →</button>
          </div>
        </section>
      </main>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const score = Math.min(
      96,
      48 + (form.volume.trim() ? 15 : 0) + (form.need.trim().length >= 40 ? 15 : 8)
      + (form.stage === "量产导入" ? 12 : form.stage === "样机验证" ? 9 : 4)
      + (priority === "量产项目" ? 10 : priority === "紧急样机" ? 7 : 3),
    );
    const route = score >= 70 || priority !== "常规" ? "销售 + 工程" : score >= 40 ? "普通销售" : "培育";
    const status: LeadStatus = route.includes("工程") ? "工程评审" : route === "培育" ? "培育中" : "新线索";
    const eventSequence = Math.trunc(event.timeStamp).toString().slice(-4).padStart(4, "0");
    const id = `CR-20260729-${eventSequence}`;
    const lead: LeadRecord = {
      id,
      createdAt: "刚刚",
      source: "定制需求",
      company: form.company.trim(),
      companyType: "待销售确认",
      contact: form.contact.trim(),
      contactDetail: form.phone.trim(),
      country: form.country,
      city: "待补充",
      score,
      status,
      route,
      priority: score >= 70 ? "高" : score >= 40 ? "中" : "低",
      product: `${form.scene}定制方案`,
      model: "待工程匹配",
      productImage: withBasePath("/products/domain-controller.png"),
      quantity: form.volume || "待确认",
      scene: form.scene,
      stage: form.stage,
      target: form.target,
      need: `${form.project}：${form.need}`,
      address: `${form.country}（详细地址待补充）`,
      nextAction: route.includes("工程") ? "销售首联并安排工程师完成接口、环境和系统边界评审。" : "销售联系客户，补充预算、数量和目标时间。",
      estimatedPrice: priceEstimate.label,
    };
    setCreatedLead(lead);
    onLeadCreated(lead);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="flow-shell">
      <div className="flow-bar"><button className="back-button" onClick={onHome}>← 返回产品中心</button><Progress step={2} custom /><span className="service-badge"><i /> 销售在线</span></div>
      <section className="custom-layout">
        <div className="custom-main">
          <div className="flow-title"><span>CUSTOM SOLUTION PATH</span><h1>提交定制需求</h1><p>已带入“{brief.scene} · {brief.goal}”上下文。用业务语言描述任务即可，AI 会边填写边补全工程评估所需信息。</p></div>
          <form className="custom-form" onSubmit={submit}>
            <div className="form-section">
              <div className="form-section-title"><span>01</span><div><h2>项目与场景</h2><p>帮助我们判断对应的销售与工程团队。</p></div></div>
              <div className="form-grid">
                <label><span>项目名称 *</span><input required value={form.project} onChange={(e) => update("project", e.target.value)} placeholder="例如：仓储 AMR 视觉升级" /></label>
                <label><span>机器人场景 *</span><select value={form.scene} onChange={(e) => update("scene", e.target.value)}><option>人形机器人</option><option>AMR / AGV</option><option>协作机械臂</option><option>服务机器人</option><option>其他</option></select></label>
                <label className="full-field"><span>需求描述 *</span><textarea required value={form.need} onChange={(e) => update("need", e.target.value)} placeholder="请描述任务目标、已有平台、关键指标、接口、安装空间、环境约束和期望交付时间…" /></label>
              </div>
              <div className="ai-requirement-coach" aria-live="polite">
                <div className="requirement-score"><span>AI</span><p><small>需求可评估度</small><strong>{requirementCompleteness}%</strong></p><i><b style={{ width: `${requirementCompleteness}%` }} /></i></div>
                <div className="requirement-checks">
                  {requirementChecks.map((item) => <span className={item.done ? "done" : ""} key={item.label}>{item.done ? "✓" : "+"} {item.label}</span>)}
                </div>
                <div className="requirement-prompts">
                  <small>点击补充建议，直接续写到需求描述</small>
                  <div>{requirementFragments.map((fragment) => <button type="button" key={fragment} onClick={() => addRequirementFragment(fragment)}>{fragment}</button>)}</div>
                </div>
                <p><b>AI 当前理解：</b>{form.need.trim() ? `${form.scene}项目，重点围绕${brief.goal}；已识别 ${requirementChecks.filter((item) => item.done).map((item) => item.label).join("、") || "基础场景"}，未填写内容会保留为待销售澄清。` : "先描述任务目标，AI 会实时标出工程评估仍缺少的信息，不会猜测关键参数。"}</p>
              </div>
            </div>
            <div className="form-section">
              <div className="form-section-title"><span>02</span><div><h2>商务与联系信息</h2><p>用于生成报价、工期评估和后续沟通。</p></div></div>
              <div className="form-grid">
                <label><span>公司名称 *</span><input required value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="公司全称" /></label>
                <label><span>预计年用量</span><input value={form.volume} onChange={(e) => update("volume", e.target.value)} placeholder="例如：100–500 套 / 年" /></label>
                <label><span>联系人 *</span><input required value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder="姓名" /></label>
                <label><span>手机 / 邮箱 *</span><input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="便于销售联系" /></label>
                <label><span>国家 / 地区 *</span><input required value={form.country} onChange={(e) => update("country", e.target.value)} placeholder="例如：中国、德国" /></label>
                <label><span>项目阶段 *</span><select value={form.stage} onChange={(e) => update("stage", e.target.value)}><option>概念设计</option><option>Demo / 样机</option><option>样机验证</option><option>小批量验证</option><option>量产导入</option></select></label>
                <label><span>目标时间 *</span><select value={form.target} onChange={(e) => update("target", e.target.value)}><option>1 个月内</option><option>3 个月内</option><option>6 个月内</option><option>12 个月内</option><option>待确认</option></select></label>
              </div>
            </div>
            <div className="form-section">
              <div className="form-section-title"><span>03</span><div><h2>优先级与附件</h2><p>附件将在下一版接入真实上传；本版演示结构与状态。</p></div></div>
              <div className="priority-row">
                {["常规", "紧急样机", "量产项目"].map((item) => <button type="button" className={priority === item ? "priority active" : "priority"} key={item} onClick={() => setPriority(item)}><span>{item === "常规" ? "○" : item === "紧急样机" ? "⚡" : "▦"}</span><b>{item}</b><small>{item === "常规" ? "2 个工作日内给出初步单据" : item === "紧急样机" ? "销售优先联系并确认资源" : "进入项目评审与量产导入"}</small></button>)}
              </div>
              <div className="upload-box"><span>⇧</span><div><b>拖放需求文档、图纸或 BOM</b><small>支持 PDF、PPT、STEP、Excel · 原型演示</small></div><button type="button">选择文件</button></div>
            </div>
            <label className="consent"><input required type="checkbox" /> 我确认以上信息可用于本次商务与技术评估。</label>
            <div className="form-submit"><div><span className="live-dot" />销售部门在线</div><button className="primary-button" type="submit">提交需求并生成跟进单 →</button></div>
          </form>
        </div>
        <aside className="custom-aside">
          <div className="live-estimate-card aside-estimate" aria-live="polite">
            <div className="live-estimate-main">
              <div className="live-estimate-label"><span>AI</span><p><small>LIVE ESTIMATE</small><b>动态需求估价</b></p></div>
              <strong>{priceEstimate.label}</strong>
              <p>根据当前场景、项目阶段、优先级和需求复杂度实时更新。</p>
            </div>
            <div className="live-estimate-detail">
              <div>{priceEstimate.reasons.map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
              <p><b>仅供参考，不构成正式报价。</b>具体价格受最终配置、开发投入、测试认证、数量和交期影响，可与 JOYNEXT 销售进一步沟通。</p>
            </div>
          </div>
          <button className="aside-ai-review" type="button" onClick={() => onAskAi(form.need.trim()
            ? `请根据以下定制需求给出候选产品组合、缺失信息和工程风险：场景=${form.scene}；阶段=${form.stage}；需求=${form.need}`
            : `请围绕${form.scene}和${brief.goal}目标，通过关键问题帮我补全一份可供工程师评估的需求描述。`)}>
            <span>AI</span><p><b>{form.need.trim() ? "让 AI 评审当前需求" : "让 AI 帮我补全需求"}</b><small>调用真实产品知识库与业务边界</small></p><em>→</em>
          </button>
          <div className="sales-card"><span className="live-dot" /><small>AI + SALES ONLINE</small><h3>上下文会随需求一起交接</h3><p>场景、目标、推荐产品、风险点和估价依据会形成同一份摘要，销售与工程师不再重复询问。</p><div className="avatar-row"><i>AI</i><i>销</i><i>技</i><span>智能整理 + 人工确认</span></div></div>
          <div className="next-card"><h3>接下来会发生什么</h3>{[["1", "需求入队", "即时生成结构化摘要"], ["2", "销售首联", "预计 2 小时内"], ["3", "工程评估", "确认接口、风险与边界"], ["4", "单据生成", "2 个工作日内给出报价与工期"]].map(([n, h, p]) => <div key={n}><span>{n}</span><p><b>{h}</b><small>{p}</small></p></div>)}</div>
          <div className="trust-card"><h3>资料边界</h3><p>AI 只整理和解释已提供资料。系统兼容、安全、法规与最终设计结论必须由工程师确认。</p></div>
        </aside>
      </section>
    </main>
  );
}

function scoreLevel(score: number) {
  return score >= 70 ? "high" : score >= 40 ? "medium" : "low";
}

// Compatibility fallback for development sessions that had the previous embedded view open.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OperationsDashboard({
  leads,
  onUpdate,
  onHome,
}: {
  leads: LeadRecord[];
  onUpdate: (id: string, changes: Partial<LeadRecord>) => void;
  onHome: () => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "全部">("全部");
  const [selectedId, setSelectedId] = useState(leads[0]?.id ?? "");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "全部" || lead.status === statusFilter;
      const matchesQuery = !keyword || `${lead.company}${lead.contactDetail}${lead.product}${lead.country}${lead.id}`.toLowerCase().includes(keyword);
      return matchesStatus && matchesQuery;
    });
  }, [leads, query, statusFilter]);
  const selected = leads.find((lead) => lead.id === selectedId) ?? filtered[0] ?? leads[0];
  const highPotential = leads.filter((lead) => lead.score >= 70 && lead.status !== "已关闭").length;
  const engineering = leads.filter((lead) => lead.status === "工程评审").length;
  const active = leads.filter((lead) => !["已关闭", "已转机会"].includes(lead.status)).length;
  const statusTabs: Array<LeadStatus | "全部"> = ["全部", "新线索", "工程评审", "销售跟进", "培育中", "已转机会", "已关闭"];

  function applyStatus(status: LeadStatus, route: string, nextAction: string) {
    if (!selected) return;
    onUpdate(selected.id, { status, route, nextAction });
  }

  return (
    <main className="operations-shell">
      <section className="ops-hero">
        <div>
          <button className="ops-back" onClick={onHome}>← 返回客户网站</button>
          <span>OPERATIONS · LEAD ROUTING</span>
          <h1>线索评分与业务路由</h1>
          <p>标准订单与定制需求在这里统一评分、分流和持续跟进。</p>
        </div>
        <div className="ops-sync"><span className="live-dot" />业务数据已同步<b>刚刚更新</b></div>
      </section>

      <section className="ops-metrics" aria-label="线索指标">
        <div><span>新进入线索</span><strong>{leads.filter((lead) => lead.createdAt === "刚刚").length || 2}</strong><small>来自在线订单与需求表单</small></div>
        <div><span>工程评审</span><strong>{engineering}</strong><small>需要技术边界确认</small></div>
        <div><span>高潜客户</span><strong>{highPotential}</strong><small>评分 ≥ 70</small></div>
        <div><span>活跃跟进</span><strong>{active}</strong><small>目标 SLA：2 小时</small></div>
      </section>

      <section className="ops-workspace">
        <div className="lead-board">
          <div className="lead-tabs">
            {statusTabs.map((status) => (
              <button className={statusFilter === status ? "active" : ""} key={status} onClick={() => setStatusFilter(status)}>
                {status}<span>{status === "全部" ? leads.length : leads.filter((lead) => lead.status === status).length}</span>
              </button>
            ))}
          </div>
          <div className="lead-tools">
            <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、邮箱、产品或线索编号…" /></label>
            <span>{filtered.length} 条结果</span>
          </div>
          <div className="lead-table-head">
            <span>客户 / 来源</span><span>评分</span><span>产品</span><span>区域</span><span>阶段</span><span>路由</span>
          </div>
          <div className="lead-list">
            {filtered.map((lead) => (
              <button className={selected?.id === lead.id ? "lead-row selected" : "lead-row"} key={lead.id} onClick={() => setSelectedId(lead.id)}>
                <span className="lead-company"><b>{lead.company}</b><small>{lead.contactDetail}</small><em>{lead.createdAt} · {lead.source}</em></span>
                <span className={`lead-score ${scoreLevel(lead.score)}`}><b>{lead.score}</b><small>{lead.priority}潜</small></span>
                <span><b>{lead.product}</b><small>{lead.model}</small></span>
                <span><b>{lead.country}</b><small>{lead.city}</small></span>
                <span><i className={`status-badge status-${lead.status}`}>{lead.status}</i><small>{lead.stage}</small></span>
                <span><i className="route-badge">{lead.route}</i><small>{lead.target}</small></span>
              </button>
            ))}
            {!filtered.length && <div className="lead-empty">没有符合当前筛选条件的线索。</div>}
          </div>
        </div>

        {selected && (
          <aside className="lead-detail">
            <div className="lead-detail-top">
              <div><span>{selected.id}</span><h2>{selected.company}</h2><p>{selected.contact} · {selected.contactDetail}</p></div>
              <div className={`detail-score ${scoreLevel(selected.score)}`}><strong>{selected.score}</strong><span>线索评分</span></div>
            </div>
            <div className="lead-tags"><span>{selected.priority}优先级</span><span>{selected.source}</span><span>{selected.country}</span><span>{selected.companyType}</span></div>
            <div className="sla-card">
              <div><span>SLA / 首次响应</span><b>{selected.status === "新线索" ? "剩余 1h 48m" : "处理中"}</b></div>
              <i><span style={{ width: selected.status === "新线索" ? "38%" : "68%" }} /></i>
              <small>高潜线索 2 小时内响应；普通线索 1 个工作日内响应。</small>
            </div>
            <section className="detail-section">
              <div className="detail-section-title"><h3>客户需求</h3><span>{selected.scene} · {selected.stage}</span></div>
              <p>{selected.need}</p>
              <dl>
                <div><dt>需求数量</dt><dd>{selected.quantity}</dd></div>
                <div><dt>目标时间</dt><dd>{selected.target}</dd></div>
                <div><dt>价格参考</dt><dd>{selected.estimatedPrice ?? "待销售确认"}</dd></div>
                <div><dt>客户地址</dt><dd>{selected.address}</dd></div>
              </dl>
            </section>
            <section className="selected-product">
              <img src={selected.productImage} alt="" />
              <div><small>已选择 / 推荐产品</small><strong>{selected.product}</strong><span>{selected.model}</span></div>
            </section>
            <section className="ai-lead-summary">
              <div><span>AI</span><h3>结构化摘要与推荐动作</h3></div>
              <p>{selected.company}处于“{selected.stage}”阶段，线索评分 {selected.score}。当前需求与{selected.product}方向匹配，建议由{selected.route}处理。</p>
              <b>推荐动作：{selected.nextAction}</b>
            </section>
            <div className="route-actions">
              <button onClick={() => applyStatus("销售跟进", "销售", "销售确认预算、数量、价格和商务时间表。")}>分配给销售</button>
              <button onClick={() => applyStatus("工程评审", "工程", "工程师确认接口、环境、安装和系统兼容边界。")}>分配给工程</button>
              <button onClick={() => applyStatus("培育中", "培育", "发送资料并设置两周后的自动回访。")}>进入培育</button>
              <button className="primary" onClick={() => applyStatus("已转机会", "销售机会", "建立销售机会，准备正式报价与项目计划。")}>创建销售机会</button>
            </div>
            <button className="close-lead" onClick={() => applyStatus("已关闭", "已关闭", "线索已关闭，保留客户历史记录用于后续分析。")}>关闭线索</button>
          </aside>
        )}
      </section>

      <section className="routing-rules">
        <div><span>70+</span><p><b>高分线索</b><small>自动进入销售或工程高优先级队列</small></p></div>
        <div><span>⚙</span><p><b>工程评审</b><small>复杂配置、工程状态和兼容问题必须复核</small></p></div>
        <div><span>SLA</span><p><b>响应时效</b><small>高潜 2 小时，普通线索 1 个工作日</small></p></div>
        <div><span>↻</span><p><b>长期培育</b><small>低分或早期客户进入自动回访序列</small></p></div>
      </section>
    </main>
  );
}

function Footer() {
  return (
    <footer>
      <Logo inverse />
      <p>JOYNEXT Robotics Components · 从场景到选型，从需求到成交。</p>
      <div><a href="#products">产品</a><a href="#scenarios">场景</a><a href="#support">支持</a><span>© 2026 JOYNEXT Prototype</span></div>
    </footer>
  );
}

function FloatingOrderButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="floating-order-button" onClick={onClick} aria-label="前往标准件订购位置">
      <span>▣</span>
      <span><small>STANDARD ORDER</small><b>立即订购</b></span>
      <i>→</i>
    </button>
  );
}

export default function HomePage() {
  const [view, setView] = useState<View>("home");
  const [selected, setSelected] = useState(products.find((product) => product.id === "depth-48") ?? products[0]);
  const [brief, setBrief] = useState<DiscoveryBrief>({
    scene: "AMR / AGV",
    goal: "导航与避障",
    stage: "Demo / 样机",
  });
  const [leads, setLeads] = useState<LeadRecord[]>(seedLeads);
  const [leadStoreReady, setLeadStoreReady] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState<AssistantPrompt | null>(null);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("joynext-demo-leads");
        if (saved) {
          const parsed = JSON.parse(saved) as LeadRecord[];
          if (Array.isArray(parsed) && parsed.length) setLeads(parsed);
        }
      } catch {
        // Keep the built-in demo queue if local storage is unavailable or invalid.
      } finally {
        setLeadStoreReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!leadStoreReady) return;
    window.localStorage.setItem("joynext-demo-leads", JSON.stringify(leads));
  }, [leadStoreReady, leads]);

  const navigate = (next: View) => {
    setView(next);
    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateToSection = (sectionId: string) => {
    setView("home");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const section = document.getElementById(sectionId);
        if (!section) return;
        window.history.replaceState(null, "", `#${sectionId}`);
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const addLead = (lead: LeadRecord) => {
    setLeads((current) => [lead, ...current.filter((item) => item.id !== lead.id)]);
  };

  const openAssistant = (prompt = "") => {
    if (prompt) setAssistantPrompt({ id: Date.now(), text: prompt });
    setAssistantOpen(true);
  };

  const selectFromAssistant = (product: Product) => {
    setSelected(product);
    setAssistantOpen(false);
    navigate("standard");
  };

  return (
    <div>
      <Header onNavigate={navigate} onNavigateSection={navigateToSection} onOpenAssistant={() => openAssistant()} />
      <AiJourneyRibbon view={view} brief={brief} selected={selected} onOpenAssistant={() => openAssistant()} />
      {view === "home" && <Home onNavigate={navigate} onSelect={setSelected} brief={brief} onBriefChange={setBrief} onAskAi={openAssistant} />}
      {view === "standard" && <StandardFlow selected={selected} onSelect={setSelected} onHome={() => navigate("home")} onCustom={() => navigate("custom")} onComplete={() => navigate("home")} onLeadCreated={addLead} onViewOperations={() => window.location.assign(withBasePath("/admin"))} brief={brief} onBriefChange={setBrief} onAskAi={openAssistant} />}
      {view === "custom" && <CustomFlow onHome={() => navigate("home")} onComplete={() => navigate("home")} onLeadCreated={addLead} onViewOperations={() => window.location.assign(withBasePath("/admin"))} brief={brief} onAskAi={openAssistant} />}
      {view === "home" && <Footer />}
      {view === "home" && <FloatingOrderButton onClick={() => navigateToSection("standard-order")} />}
      <AiAssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} brief={brief} selected={selected} view={view} promptRequest={assistantPrompt} onSelectProduct={selectFromAssistant} />
    </div>
  );
}
