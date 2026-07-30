"use client";

import { createContext, Dispatch, FormEvent, SetStateAction, useContext, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { localizeValue, type ClientLocale } from "@/lib/client-i18n";
import {
  createDefaultManagedProducts,
  formatPublicationState,
  parseManagedProducts,
  PRODUCT_OPERATIONS_STORAGE_KEY,
  type ManagedProduct,
} from "@/lib/product-operations";

type View = "home" | "standard" | "custom";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const withBasePath = (path: string) => `${basePath}${path}`;

type Product = Omit<ManagedProduct, "image"> & { image: string };

type ProcurementItem = {
  productId: string;
  quantity: number;
  configuration: Record<string, string>;
};

type ConfigurationTarget = {
  productId: string;
  requestId: number;
} | null;

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
  source: "标准订单" | "集采报单" | "定制需求";
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
  streaming?: boolean;
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

type LocaleContextValue = {
  locale: ClientLocale;
  setLocale: (locale: ClientLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh",
  setLocale: () => undefined,
});

const defaultProducts: Product[] = createDefaultManagedProducts()
  .filter((product) => product.publication.lifecycle !== "offline")
  .map((product) => ({
    ...product,
    image: withBasePath(product.image),
  }));

const ProductCatalogContext = createContext<Product[]>(defaultProducts);

function useProductCatalog() {
  return useContext(ProductCatalogContext);
}

function useClientCopy() {
  const { locale, setLocale } = useContext(LocaleContext);
  return {
    locale,
    setLocale,
    c: (zh: string, en: string) => locale === "en" ? en : zh,
    v: (value: string) => localizeValue(locale, value),
  };
}

const standardUnitPriceRanges: Record<string, { low: number; high: number }> = {
  fisheye: { low: 1800, high: 3200 },
  "depth-25": { low: 2800, high: 4500 },
  "depth-48": { low: 3500, high: 5800 },
  "depth-100": { low: 4800, high: 7600 },
  "imu-mcu": { low: 1500, high: 2800 },
};

function standardPriceLabel(productId: string, locale: ClientLocale, quantity = 1) {
  const range = standardUnitPriceRanges[productId];
  if (!range) return locale === "en" ? "Quoted after review" : "评估后报价";
  const low = range.low * quantity;
  const high = range.high * quantity;
  if (locale === "en") {
    return `RMB ${low.toLocaleString()}–${high.toLocaleString()}${quantity === 1 ? " / pc" : ""}`;
  }
  return `¥${low.toLocaleString()}–¥${high.toLocaleString()}${quantity === 1 ? " / 件" : ""}`;
}

function productPriceLabel(product: Product, locale: ClientLocale, quantity = 1) {
  if (standardUnitPriceRanges[product.id]) return standardPriceLabel(product.id, locale, quantity);
  if (product.price && product.price !== "价格待确认") return product.price;
  return locale === "en" ? "Quoted after review" : "评估后报价";
}

const discoveryGoals: DiscoveryBrief["goal"][] = [
  "导航与避障",
  "姿态与平衡",
  "视觉与三维感知",
  "集中计算与实时控制",
];

const discoveryScenes: DiscoveryBrief["scene"][] = ["AMR / AGV", "人形机器人", "协作机械臂", "服务机器人"];

function recommendProducts(brief: DiscoveryBrief, products: Product[]) {
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

function estimateCustomPrice(scene: string, stage: string, priority: string, need: string, locale: ClientLocale = "zh") {
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
  const format = (value: number) => locale === "en"
    ? `RMB ${(value / 1000).toLocaleString()}k`
    : `¥${value / 10000}万`;
  const reasons = locale === "en"
    ? [
      `${localizeValue(locale, scene)} solution and prototype adaptation`,
      `Engineering input for the ${localizeValue(locale, stage)} stage`,
      priority === "紧急样机" ? "Urgent prototype resource coordination" : priority === "量产项目" ? "Production-introduction and validation preparation" : "Standard delivery planning",
    ]
    : [
      `${scene}方案与样机适配`,
      `${stage}阶段的工程投入`,
      priority === "紧急样机" ? "加急样机资源协调" : priority === "量产项目" ? "量产导入与验证准备" : "常规交付节奏",
    ];
  if (complexityHits) reasons.push(locale === "en" ? `${complexityHits} complex technical constraints` : `${complexityHits} 项复杂技术约束`);
  return { low, high, label: `${format(low)} – ${format(high)}`, reasons };
}

function Logo({ inverse = false, onClick }: { inverse?: boolean; onClick?: () => void }) {
  const { c } = useClientCopy();
  return (
    <button className="brand" onClick={onClick ?? (() => window.scrollTo({ top: 0, behavior: "smooth" }))} aria-label={c("返回首页", "Back to homepage")}>
      <img
        className="brand-logo"
        src={inverse ? withBasePath("/assets/brand/joynext-logo-light.png") : withBasePath("/assets/brand/joynext-logo-dark.png")}
        alt="JOYNEXT"
      />
    </button>
  );
}

function PurchaseIcon() {
  return (
    <span className="purchase-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 4h2.2l1.6 9.1h9.7l2-6.5H6" />
        <path d="M8.5 17.5h7" />
        <circle cx="8.5" cy="19" r="1.25" />
        <circle cx="16" cy="19" r="1.25" />
      </svg>
    </span>
  );
}

function MotionEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    root.classList.add("motion-ready");
    let frame = 0;
    const updateParallax = () => {
      frame = 0;
      const scroll = Math.min(window.scrollY, 2400);
      root.style.setProperty("--parallax-slow", `${scroll * 0.055}px`);
      root.style.setProperty("--parallax-fast", `${scroll * -0.035}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateParallax);
    };
    updateParallax();
    window.addEventListener("scroll", onScroll, { passive: true });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    const observeRevealElement = (element: Element) => {
      if (element.matches("[data-reveal]")) observer.observe(element);
      element.querySelectorAll("[data-reveal]").forEach((child) => observer.observe(child));
    };
    document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) observeRevealElement(node);
      }));
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutationObserver.disconnect();
      root.classList.remove("motion-ready");
      root.style.removeProperty("--parallax-slow");
      root.style.removeProperty("--parallax-fast");
    };
  }, []);
  return null;
}

function AiAssistantDrawer({
  open,
  onClose,
  brief,
  selected,
  view,
  promptRequest,
  onSelectProduct,
  procurementItems,
  onAddProduct,
}: {
  open: boolean;
  onClose: () => void;
  brief: DiscoveryBrief;
  selected: Product;
  view: View;
  promptRequest: AssistantPrompt | null;
  onSelectProduct: (product: Product) => void;
  procurementItems: ProcurementItem[];
  onAddProduct: (product: Product) => void;
}) {
  const { locale, c, v } = useClientCopy();
  const products = useProductCatalog();
  const [input, setInput] = useState("");
  const [dismissedPromptId, setDismissedPromptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantIntro = c(
    "您好，我是 JOYNEXT 选型助理。请告诉我机器人类型、工作距离、接口、使用环境、项目阶段和预计数量，我会依据已确认资料帮您筛选产品。",
    "Hello, I’m the JOYNEXT product advisor. Tell me your robot type, working range, interface, environment, project stage and expected quantity, and I’ll shortlist products using verified information.",
  );
  const [messages, setMessages] = useState<AssistantMessage[]>([{
    role: "assistant",
    content: "",
  }]);

  const composerValue = promptRequest && dismissedPromptId !== promptRequest.id ? promptRequest.text : input;
  const latestMessageContent = messages[messages.length - 1]?.content;

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [latestMessageContent, open]);

  async function sendMessage(question?: string) {
    const content = (question ?? composerValue).trim();
    if (!content || loading) return;
    const nextMessages: AssistantMessage[] = [
      ...messages.map((message) => message.role === "assistant" && !message.content ? { ...message, content: assistantIntro } : message),
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setInput("");
    setDismissedPromptId(promptRequest?.id ?? null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch(withBasePath("/api/assistant"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-client-language": locale },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          context: {
            scene: brief.scene,
            goal: brief.goal,
            stage: brief.stage,
            view,
            selectedProduct: `${selected.model} · ${selected.name}`,
            language: locale === "en" ? "English" : "Simplified Chinese",
          },
        }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || c("AI 服务暂时不可用。", "The AI service is temporarily unavailable."));
      }

      setMessages([...nextMessages, { role: "assistant", content: "", streaming: true }]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let streamError = "";
      let products: AssistantMessage["products"];
      let boundary: string | undefined;

      const handleEvent = (block: string) => {
        const event = block.split(/\r?\n/).find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "message";
        const dataText = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!dataText) return;
        const data = JSON.parse(dataText) as {
          content?: string;
          error?: string;
          products?: AssistantMessage["products"];
          boundary?: string;
        };
        if (event === "delta" && data.content) {
          answer += data.content;
          setMessages((current) => current.map((message, index) =>
            index === current.length - 1 ? { ...message, content: answer } : message));
        } else if (event === "done") {
          products = data.products;
          boundary = data.boundary;
        } else if (event === "error") {
          streamError = data.error || c("AI 流式连接中断。", "The AI stream was interrupted.");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        blocks.forEach(handleEvent);
        if (done) break;
      }
      if (buffer.trim()) handleEvent(buffer);
      if (streamError) throw new Error(streamError);
      if (!answer.trim()) throw new Error(c("AI 服务未返回有效内容。", "The AI service returned no usable answer."));
      setMessages((current) => current.map((message, index) =>
        index === current.length - 1 ? { ...message, content: answer, products, boundary, streaming: false } : message));
    } catch (requestError) {
      setMessages((current) => current.map((message) => message.streaming ? { ...message, streaming: false } : message));
      setError(requestError instanceof Error ? requestError.message : c("AI 服务连接失败，请稍后重试。", "Could not connect to the AI service. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  const quickPrompts = locale === "en"
    ? [
      "Which product suits a warehouse AMR needing 0.3–4 m obstacle detection and USB?",
      "Compare the working range and interfaces of the three DPC depth cameras.",
      "Which sensors can nRB-H1 connect to, and what still needs engineering confirmation?",
      "Suggest a perception, attitude and central-control combination for a humanoid robot.",
    ]
    : [
      "仓储 AMR 需要 0.3–4 米避障和 USB 接口，推荐什么？",
      "对比三款 DPC 深度相机的工作距离和接口",
      "nRB-H1 能接入哪些传感器？哪些参数仍需工程确认？",
      "给人形机器人提供一套感知、姿态与集中控制组合方案",
    ];

  return (
    <div className={open ? "ai-assistant-layer open" : "ai-assistant-layer"} aria-hidden={!open}>
      <button className="ai-assistant-backdrop" aria-label={c("关闭选型助理", "Close product advisor")} onClick={onClose} />
      <aside className="ai-assistant-drawer" aria-label={c("JOYNEXT AI 选型助理", "JOYNEXT AI Product Advisor")}>
        <header>
          <div><span>AI</span><p><small>PRODUCT ADVISOR</small><b>{c("JOYNEXT AI 选型助理", "JOYNEXT AI Product Advisor")}</b></p></div>
          <button onClick={onClose} aria-label={c("关闭", "Close")}>×</button>
        </header>
        <div className="assistant-context">
          <span><b>{c("场景", "Robot")}</b>{v(brief.scene)}</span>
          <span><b>{c("目标", "Task")}</b>{v(brief.goal)}</span>
          <span><b>{c("阶段", "Stage")}</b>{v(brief.stage)}</span>
        </div>
        <div className="assistant-messages" aria-live="polite">
          {messages.map((message, index) => (
            <article className={`assistant-message ${message.role}${message.streaming ? " streaming" : ""}`} key={`${message.role}-${index}`}>
              <span>{message.role === "assistant" ? "AI" : c("您", "You")}</span>
              <div>
                {message.role === "assistant" ? (
                  <div className="assistant-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{message.content || (index === 0 ? assistantIntro : "")}</ReactMarkdown>
                  </div>
                ) : <p>{message.content}</p>}
                {message.products?.length ? (
                  <div className="assistant-product-results">
                    {message.products.map((result) => {
                      const product = products.find((item) => item.id === result.id);
                      if (!product) return null;
                      const procurementItem = procurementItems.find((item) => item.productId === product.id);
                      return (
                        <article key={result.id}>
                          <button className="assistant-product-open" onClick={() => onSelectProduct(product)}>
                            <img src={withBasePath(result.image)} alt="" />
                            <span><small>{result.model} · {v(result.status)}</small><b>{v(result.name)}</b><em>{result.verified.slice(0, 2).map(v).join(" · ")}</em></span>
                          </button>
                          <button className={procurementItem ? "assistant-product-add added" : "assistant-product-add"} onClick={() => onAddProduct(product)} aria-label={c(`将 ${product.model} 加入采购单`, `Add ${product.model} to procurement list`)}>
                            {procurementItem ? "✓" : "＋"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
                {message.boundary && <small className="assistant-boundary">ⓘ {message.boundary}</small>}
              </div>
            </article>
          ))}
          {loading && !messages.some((message) => message.streaming) && <article className="assistant-message assistant thinking"><span>AI</span><div><p>{c("正在连接产品知识库", "Connecting to the product knowledge base")}<span className="thinking-dots">…</span></p></div></article>}
          <div ref={messagesEndRef} />
        </div>
        {messages.length === 1 && (
          <div className="assistant-quick-prompts">
            <span>{c("您可以这样问", "Try asking")}</span>
            {quickPrompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)}>{prompt}<b>→</b></button>)}
          </div>
        )}
        {error && <div className="assistant-error">{error}<button onClick={() => setError("")}>×</button></div>}
        <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
          <textarea value={composerValue} onChange={(event) => { setDismissedPromptId(promptRequest?.id ?? null); setInput(event.target.value); }} placeholder={c("描述任务、距离、接口、环境、数量，或直接输入产品型号…", "Describe the task, range, interface, environment and quantity, or enter a model…")} maxLength={4000} />
          <div><span>{c("依据产品资料回答 · 未确认项转人工", "Verified product data · Unconfirmed items go to a specialist")}</span><button disabled={loading || !composerValue.trim()} type="submit">{c("发送 ↑", "Send ↑")}</button></div>
        </form>
      </aside>
    </div>
  );
}

function Header({
  onNavigate,
  onNavigateSection,
  onNavigateCategory,
  onOpenAssistant,
  procurementCount,
  onOpenProcurement,
}: {
  onNavigate: (view: View) => void;
  onNavigateSection: (sectionId: string) => void;
  onNavigateCategory: (category: string) => void;
  onOpenAssistant: () => void;
  procurementCount: number;
  onOpenProcurement: () => void;
}) {
  const { locale, setLocale, c } = useClientCopy();
  return (
    <header className="site-header">
      <Logo onClick={() => onNavigate("home")} />
      <nav aria-label={c("主导航", "Main navigation")}>
        <div className="product-nav-menu">
          <button className="product-nav-trigger" onClick={() => onNavigateCategory("全部产品")} aria-haspopup="menu">
            {c("产品", "Products")} <span aria-hidden="true" />
          </button>
          <div className="product-nav-dropdown" role="menu">
            {[
              ["全部产品", c("全部产品", "All products")],
              ["计算与控制", c("计算与控制", "Computing & control")],
              ["3D 感知", c("3D 感知", "3D perception")],
              ["环境感知", c("环境感知", "Environment sensing")],
              ["运动感知", c("运动感知", "Motion sensing")],
            ].map(([category, label]) => (
              <button role="menuitem" key={category} onClick={() => onNavigateCategory(category)}>{label}</button>
            ))}
          </div>
        </div>
        <button onClick={() => onNavigateSection("scenarios")}>{c("应用场景", "Applications")}</button>
        <button onClick={() => onNavigateSection("support")}>{c("选型支持", "Selection support")}</button>
        <button onClick={() => onNavigateSection("contact")}>{c("联系方式", "Contact")}</button>
      </nav>
      <div className="header-actions">
        <button className="header-procurement-button" onClick={onOpenProcurement} aria-label={c(`查看采购单，已有 ${procurementCount} 项`, `View procurement list, ${procurementCount} items`)}>
          <PurchaseIcon /><b>{c("采购单", "Procurement")}</b><i>{procurementCount}</i>
        </button>
        <button className="language-switch" onClick={() => setLocale(locale === "zh" ? "en" : "zh")} aria-label={c("切换为英文", "Switch to Chinese")}>
          <span className={locale === "zh" ? "active" : ""}>中</span><i /> <span className={locale === "en" ? "active" : ""}>EN</span>
        </button>
        <button className="ai-header-button" onClick={onOpenAssistant}><span>AI</span> {c("帮我选型", "Find a product")}</button>
        <button className="outline-button compact" onClick={() => onNavigate("custom")}>{c("提交需求", "Request a quote")}</button>
      </div>
    </header>
  );
}

function ProcurementDrawer({
  open,
  items,
  onClose,
  onConfigure,
  onRemove,
}: {
  open: boolean;
  items: ProcurementItem[];
  onClose: () => void;
  onConfigure: (product: Product) => void;
  onRemove: (productId: string) => void;
}) {
  const { locale, c, v } = useClientCopy();
  const products = useProductCatalog();
  const lines = items.map((item) => ({
    ...item,
    product: products.find((product) => product.id === item.productId),
  })).filter((item): item is ProcurementItem & { product: Product } => Boolean(item.product));
  const totalQuantity = lines.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className={open ? "procurement-drawer-layer open" : "procurement-drawer-layer"} aria-hidden={!open}>
      <button className="procurement-drawer-backdrop" onClick={onClose} aria-label={c("关闭采购单", "Close procurement list")} />
      <aside className="procurement-drawer" aria-label={c("实时采购单", "Live procurement list")}>
        <header>
          <div><small>PROCUREMENT LIST</small><h2>{c("采购单", "Procurement")}</h2></div>
          <button onClick={onClose} aria-label={c("关闭", "Close")}>×</button>
        </header>
        <div className="procurement-drawer-summary">
          <span>{lines.length} {c("项产品", "items")}</span>
          <span>{totalQuantity} {c("件", "pcs")}</span>
        </div>
        <div className="procurement-drawer-items">
          {lines.length ? lines.map((item) => {
            const configured = Object.keys(item.configuration).length > 0;
            return (
              <article key={item.productId}>
                <img src={item.product.image} alt="" />
                <div>
                  <small>{item.product.model}</small>
                  <strong>{v(item.product.name)}</strong>
                  <span className={configured ? "configured" : "pending"}>{configured ? c("已配置", "Configured") : c("待配置", "Configuration required")}</span>
                  <em>{item.quantity} {c("件", "pcs")} · {productPriceLabel(item.product, locale, item.quantity)}</em>
                </div>
                <button className="configure" onClick={() => onConfigure(item.product)}>{configured ? c("修改", "Edit") : c("去配置", "Configure")} →</button>
                <button className="remove" onClick={() => onRemove(item.productId)} aria-label={c("移除产品", "Remove product")}>×</button>
              </article>
            );
          }) : (
            <div className="procurement-drawer-empty"><PurchaseIcon /><b>{c("采购单还是空的", "Your procurement list is empty")}</b><p>{c("可从 AI 推荐结果点击“＋”加入。", "Use “+” on an AI recommendation to add a product.")}</p></div>
          )}
        </div>
        <footer>
          <p>{c("待配置产品需完善接口、环境和数量后提交。", "Complete interface, environment and quantity before submission.")}</p>
          <button disabled={!lines.length} onClick={() => lines[0] && onConfigure(lines[0].product)}>{c("进入采购单", "Open procurement list")} →</button>
        </footer>
      </aside>
    </div>
  );
}

function Progress({ step, custom = false }: { step: number; custom?: boolean }) {
  const { c } = useClientCopy();
  const labels = custom
    ? [c("描述需求", "Describe needs"), c("联系信息", "Contact details"), c("提交完成", "Submitted")]
    : [c("选择产品", "Select product"), c("确认配置", "Configure"), c("提交完成", "Submitted")];
  return (
    <div className="progress" aria-label={c("流程进度", "Progress")}>
      {labels.map((label, index) => (
        <div className={index + 1 <= step ? "progress-step active" : "progress-step"} key={label}>
          <span>{index + 1 < step ? "✓" : index + 1}</span>
          <b>{label}</b>
        </div>
      ))}
    </div>
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
  const { locale, c, v } = useClientCopy();
  const products = useProductCatalog();
  const recommendations = useMemo(() => recommendProducts(brief, products), [brief, products]);
  const primary = recommendations[0];

  const startConfiguration = (product: Product) => {
    onSelect(product);
    onNavigate("standard");
  };

  return (
    <section className="ai-discovery-workspace" id="ai-discovery">
      <div className="ai-discovery-heading">
        <div><span className="ai-orb compact">AI</span><p><small>GUIDED PRODUCT SELECTION</small><b>{c("按您的应用条件，筛选合适的产品", "Shortlist products for your application")}</b></p></div>
        <span className="ai-live-state"><i /> {c("选择条件后立即查看建议", "Recommendations update as you select")}</span>
      </div>
      <div className="ai-discovery-grid">
        <div className="ai-brief-builder">
          <label>
            <span>{c("1 · 机器人类型", "1 · Robot type")}</span>
            <div className="choice-chips">
              {discoveryScenes.map((scene) => (
                <button className={brief.scene === scene ? "active" : ""} type="button" key={scene} onClick={() => onBriefChange({ ...brief, scene })}>{v(scene)}</button>
              ))}
            </div>
          </label>
          <label>
            <span>{c("2 · 主要采购用途", "2 · Primary application")}</span>
            <div className="choice-chips goal-chips">
              {discoveryGoals.map((goal) => (
                <button className={brief.goal === goal ? "active" : ""} type="button" key={goal} onClick={() => onBriefChange({ ...brief, goal })}>{v(goal)}</button>
              ))}
            </div>
          </label>
          <label className="ai-stage-field">
            <span>{c("3 · 当前项目阶段", "3 · Current project stage")}</span>
            <select value={brief.stage} onChange={(event) => onBriefChange({ ...brief, stage: event.target.value as DiscoveryBrief["stage"] })}>
              {(["概念设计", "Demo / 样机", "样机验证", "小批量验证"] as DiscoveryBrief["stage"][]).map((stage) => <option value={stage} key={stage}>{v(stage)}</option>)}
            </select>
          </label>
        </div>
        <div className="ai-recommendation-result" aria-live="polite">
          <div className="recommendation-topline"><span>{c("优先考虑", "Top candidate")} · {primary.score}% {c("条件匹配", "match")}</span><b>{c("依据已确认产品资料", "Based on verified product data")}</b></div>
          <div className="recommended-product">
            <img src={primary.product.image} alt="" />
            <div><small>{primary.product.model}</small><h3>{v(primary.product.name)}</h3><p>{v(primary.reason)}{locale === "zh" ? "。" : "."}</p></div>
          </div>
          <div className="ai-reasoning">
            <span>{c("建议依据", "Why it fits")}</span>
            <p>{locale === "zh"
              ? `${brief.goal} · ${brief.stage}，综合匹配范围、接口与供货状态。`
              : `${v(brief.goal)} · ${v(brief.stage)}, matched by range, interface and availability.`}</p>
          </div>
          <div className="recommendation-actions">
            <button className="primary-button" onClick={() => startConfiguration(primary.product)}>{c("查看配置", "Configure")} →</button>
            <button className="outline-button" onClick={() => onAskAi(locale === "zh"
              ? `请结合我的${brief.scene}场景、${brief.goal}目标和${brief.stage}阶段，解释为什么推荐 ${primary.product.model}，并给出候选组合方案和需要确认的问题。`
              : `For my ${v(brief.scene)} application, ${v(brief.goal)} goal and ${v(brief.stage)} stage, explain why ${primary.product.model} is recommended, suggest alternatives and list what still needs confirmation.`)}>{c("询问选型助理", "Ask the product advisor")}</button>
          </div>
          <div className="alternative-products">
            <span>{c("其他候选", "Other candidates")}</span>
            {recommendations.slice(1, 3).map(({ product, score }) => (
              <button key={product.id} onClick={() => startConfiguration(product)}><b>{product.model}</b><small>{score}% {c("匹配", "match")}</small></button>
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
  const { locale, c, v } = useClientCopy();
  const products = useProductCatalog();
  const [query, setQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("为你推荐");
  const recommendations = useMemo(() => recommendProducts(brief, products), [brief, products]);
  const recommendedId = recommendations[0].product.id;
  const catalogFilters = ["为你推荐", "全部产品", "计算与控制", "3D 感知", "环境感知", "运动感知"];
  const visible = useMemo(() => {
    if (query.trim()) {
      const q = query.toLowerCase();
      return products.filter((product) =>
        `${product.name}${localizeValue(locale, product.name)}${product.model}${product.kind}${localizeValue(locale, product.kind)}${product.description}${localizeValue(locale, product.description)}${product.verified.join("")}${product.verified.map((item) => localizeValue(locale, item)).join("")}`.toLowerCase().includes(q),
      );
    }
    if (catalogFilter === "为你推荐") return recommendations.slice(0, 4).map(({ product }) => product);
    if (catalogFilter === "全部产品") return products;
    return products.filter((product) => product.kind === catalogFilter);
  }, [catalogFilter, locale, products, query, recommendations]);

  useEffect(() => {
    const selectCategory = (event: Event) => {
      const category = (event as CustomEvent<string>).detail;
      setCatalogFilter(category);
      setQuery("");
    };
    window.addEventListener("joynext:product-category", selectCategory);
    return () => window.removeEventListener("joynext:product-category", selectCategory);
  }, []);

  function startSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim() && visible.length) {
      setCatalogFilter("全部产品");
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      onAskAi(query.trim()
        ? locale === "zh" ? `请根据这个需求帮我搜索产品并给出方案：${query}` : `Find suitable products for this requirement and explain the shortlist: ${query}`
        : c("我还不确定具体型号，请通过几个关键问题帮我完成机器人元器件选型。", "I am not sure which model I need. Ask a few key questions and help me shortlist robot components."));
    }
  }

  const catalogFilterLabel = (filter: string) => ({
    "为你推荐": c("为您推荐", "Recommended"),
    "全部产品": c("全部产品", "All products"),
    "计算与控制": v("计算与控制"),
    "3D 感知": v("3D 感知"),
    "环境感知": v("环境感知"),
    "运动感知": v("运动感知"),
  }[filter] ?? filter);

  return (
    <>
      <section className="hero">
        <div className="hero-ambient ambient-one" data-parallax="slow" />
        <div className="hero-ambient ambient-two" data-parallax="fast" />
        <div className="hero-grid">
          <div className="hero-copy" data-reveal>
            <div className="eyebrow"><span /> ROBOTICS COMPONENTS</div>
            <h1>{c("从需求出发，", "Find the right component,")}<br /><em>{c("找到合适的产品", "starting with your application")}</em></h1>
            <p>{c(
              "按用途、距离和接口快速选型；复杂需求可转销售与工程师。",
              "Shortlist by task, range and interface. Specialists support complex needs.",
            )}</p>
            <form className="search-box" onSubmit={startSearch}>
              <label>
                <span className="search-icon">⌕</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c("搜索型号，或描述用途、距离和接口", "Search a model or describe the task, range and interface")} />
              </label>
              <button type="submit" className="primary-button">{query.trim() ? c("查看匹配", "View matches") : c("帮我选型", "Find a product")}</button>
            </form>
          </div>
          <div className="hero-product-stage" data-reveal data-parallax="slow">
            <div className="product-halo" />
            <span className="stage-kicker">nRB-H1 · ROBOT DOMAIN CONTROLLER</span>
            <img src={withBasePath("/products/domain-controller-hero.png")} alt={c("nRB-H1 机器人域控制器写实渲染图", "Photorealistic nRB-H1 robot domain controller")} />
            <div className="stage-caption">
              <span><i /> {v("初步工程状态")}</span>
              <strong>{c("脑—小脑融合计算平台", "Integrated AI computing & real-time control")}</strong>
              <button onClick={() => {
                const product = products.find((item) => item.id === "controller-h1") ?? products[0];
                onSelect(product);
                onNavigate("standard");
              }}>{c("查看产品", "View product")} <b>↗</b></button>
            </div>
            <div className="stage-spec spec-top"><b>≤ 1 ms</b><span>{c("硬实时控制周期", "Hard real-time cycle")}</span></div>
            <div className="stage-spec spec-bottom"><b>2,070 TOPS</b><span>{c("整机峰值算力", "Peak system compute")}</span></div>
          </div>
        </div>
        <button className="scroll-cue" type="button" onClick={() => document.getElementById("ai-discovery")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          <span /> {c("智能选型", "Guided selection")}
        </button>
      </section>

      <main className="customer-home">
        <div className="discovery-snap-page">
          <AiDiscoveryWorkspace brief={brief} onBriefChange={onBriefChange} onNavigate={onNavigate} onSelect={onSelect} onAskAi={onAskAi} />
        </div>

        <section className="scenario-section" id="scenarios">
          <div className="section-heading split" data-reveal>
            <div><span>SHOP BY APPLICATION</span><h2>{c("按应用场景分类", "Browse by application")}</h2></div>
            <p>{c("选择接近您的机器人类型，我们会优先展示适合该任务、工作距离和系统条件的产品。", "Choose the robot type closest to your project to see products suited to its task, working range and system constraints.")}</p>
          </div>
          <div className="scenario-grid">
            {scenarios.map((scenario, index) => (
              <button className="scenario-card" data-reveal style={{ "--reveal-delay": `${index * 90}ms` } as React.CSSProperties} key={scenario.name} onClick={() => {
                const scene = scenario.name === "机械臂" ? "协作机械臂" : scenario.name as DiscoveryBrief["scene"];
                const nextBrief = { ...brief, scene };
                onBriefChange(nextBrief);
                onSelect(recommendProducts(nextBrief, products)[0].product);
                onNavigate("standard");
              }}>
                <img src={scenario.image} alt="" />
                <div><small>0{index + 1} / APPLICATION</small><span>{scenario.icon}</span><h3>{v(scenario.name)}</h3><p>{scenario.name === "AMR / AGV"
                  ? c("导航、定位与多传感器融合", "Navigation, positioning and multi-sensor fusion")
                  : scenario.name === "人形机器人"
                    ? c("感知、规划与硬实时伺服控制", "Perception, planning and hard real-time servo control")
                    : c("高精度定位、视觉与末端感知", "Precision positioning, vision and end-effector sensing")}</p><b>{c("查看适用产品", "View suitable products")} <i>↗</i></b></div>
              </button>
            ))}
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-heading split" data-reveal>
            <div><span>PRODUCT CATALOG</span><h2>{c("候选产品", "Product shortlist")}</h2><p>{c("参数可追溯，待确认项明确标注。", "Traceable data with clear review flags.")}</p></div>
            <button className="text-arrow-button" onClick={() => onNavigate("standard")}>{c("比较并配置产品", "Compare and configure")} <span>↗</span></button>
          </div>
          <div className="catalog-toolbar" data-reveal>
            <div className="catalog-filters">
              {catalogFilters.map((filter) => (
                <button className={catalogFilter === filter && !query ? "active" : ""} key={filter} onClick={() => { setCatalogFilter(filter); setQuery(""); }}>{catalogFilterLabel(filter)}</button>
              ))}
            </div>
            {query && <button className="clear-search" onClick={() => setQuery("")}>{c("清除", "Clear")} “{query}” ×</button>}
          </div>
          <div className="product-grid">
            {visible.map((product, index) => {
              const publication = formatPublicationState(product);
              return (
              <article className={product.id === recommendedId ? "product-card ai-recommended" : "product-card"} data-publication={publication.state} data-reveal style={{ "--reveal-delay": `${index * 70}ms` } as React.CSSProperties} key={product.id}>
                <div className="product-image">
                  <span>{v(product.kind)}</span>
                  {product.id === recommendedId && <b className="ai-match-badge">{c("优先匹配", "Top match")} · {recommendations[0].score}%</b>}
                  <img src={product.image} alt={v(product.name)} />
                  <small>{v(product.status)}</small>
                </div>
                <div className="product-body">
                  <small>{product.model} · {c("资料", "Source")} P.{product.sourceSlide}</small>
                  <h3>{v(product.name)}</h3>
                  <p>{v(product.description)}</p>
                  <div className={standardUnitPriceRanges[product.id] ? "product-price-preview available" : "product-price-preview"}>
                    <small>{standardUnitPriceRanges[product.id] ? c("参考单价", "Indicative unit price") : c("价格方式", "Pricing")}</small>
                    <strong>{productPriceLabel(product, locale)}</strong>
                    <em>{standardUnitPriceRanges[product.id]
                      ? c("仅供参考 · 具体价格请与销售确认", "For reference · Confirm with sales")
                      : c("根据最终方案与工程范围确认", "Confirmed against final solution and scope")}</em>
                  </div>
                  <div className="spec-chips">{product.verified.slice(0, 2).map((spec) => <span key={spec}>{v(spec)}</span>)}</div>
                  <div className={`storefront-availability ${publication.state}`}>
                    <span>{product.publication.storefrontBadge || c("开放询价", "Open for inquiry")}</span>
                    <p><b>{c(publication.label, publication.state === "scheduled" ? "Scheduled presale" : publication.state === "presale" ? "Presale" : "Available")}</b><small>{locale === "zh" ? publication.detail : product.publication.expectedDelivery || product.publication.stockStatus}</small></p>
                  </div>
                  <div className="product-foot">
                    <button onClick={() => onAskAi(locale === "zh" ? `请解释 ${product.model} ${product.name} 的能力、适用场景、与相近产品的差异，以及哪些信息仍需工程师确认。` : `Explain ${product.model} ${v(product.name)}, its suitable applications, differences from similar products, and what still needs engineering confirmation.`)}>{c("咨询产品", "Ask about product")}</button>
                    <button onClick={() => { onSelect(product); onNavigate("standard"); }}>{publication.state === "scheduled" ? c("查看预售", "View presale") : c("查看配置", "Configure")} <span>↗</span></button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
          {!visible.length && <div className="catalog-empty"><b>{c("暂未找到匹配产品", "No matching product found")}</b><p>{c("请尝试其他关键词，或描述用途、距离与接口，让选型助理继续查找。", "Try another keyword or describe the task, range and interface so the advisor can continue the search.")}</p><button onClick={() => onAskAi(locale === "zh" ? `请根据这个需求推荐可用产品：${query}` : `Recommend available products for this requirement: ${query}`)}>{c("继续查找", "Continue with advisor")} →</button></div>}
        </section>

        <section className="path-section" id="workflow">
          <div className="section-heading center" data-reveal>
            <span>TWO WAYS TO REQUEST</span>
            <h2>{c("根据需求清晰度，选择提交方式", "Choose the right request path")}</h2>
            <p>{c("标准件直接询价，复杂项目联合评估。", "Request standard products or review complex projects.")}</p>
          </div>
          <div className="path-grid">
            <article className="path-card standard" id="standard-order" data-reveal>
              <div className="path-topline"><span>01</span><b>STANDARD</b></div>
              <div className="path-icon">↗</div>
              <div><h3>{c("标准件采购", "Standard products")}</h3><p>{c("选配置与数量，加入采购栏统一提交。", "Configure, add to the list and submit together.")}</p></div>
              <button className="primary-button" onClick={() => onNavigate("standard")}>{c("选择并配置产品", "Select and configure")} <span>→</span></button>
            </article>
            <article className="path-card custom" data-reveal style={{ "--reveal-delay": "100ms" } as React.CSSProperties}>
              <div className="path-topline"><span>02</span><b>ENGINEERING</b></div>
              <div className="path-icon">＋</div>
              <div><h3>{c("方案与适配", "Solutions & adaptation")}</h3><p>{c("提交关键条件，由销售与工程师联合评估。", "Share key constraints for joint review.")}</p></div>
              <button className="dark-button" onClick={() => onNavigate("custom")}>{c("提交项目需求", "Submit project requirements")} <span>→</span></button>
            </article>
          </div>
        </section>

        <section className="trust-boundary-section" id="support" data-reveal>
          <div className="trust-boundary-copy"><span>RELIABLE SELECTION SUPPORT</span><h2>{c("资料辅助选型，", "Data-guided selection,")}<br />{c("专业人员确认", "specialist confirmed")}</h2><p>{c("兼容性、价格与交付由销售或工程师确认。", "Compatibility, pricing and delivery require specialist confirmation.")}</p><button onClick={() => onAskAi(c("请帮我梳理采购条件和待确认项。", "Help structure my requirements and open questions."))}>{c("咨询选型", "Ask advisor")} <b>↗</b></button></div>
          <div className="trust-principles">
            {[
              ["01", c("参数来源清楚", "Traceable specifications"), c("关键产品信息标注资料页码", "Key product information includes source pages")],
              ["02", c("待确认项明确", "Unconfirmed items are clear"), c("不猜测认证、库存、价格和交期", "No guessing on certification, stock, price or lead time")],
              ["03", c("需求一次提交", "Submit requirements once"), c("选型条件随采购意向一并交接", "Selection context is handed over with your request")],
              ["04", c("专业人员跟进", "Specialist follow-up"), c("技术与商务结论由授权人员确认", "Authorized staff confirms technical and commercial terms")],
            ].map(([number, title, detail]) => (
              <div key={number}><span>{number}</span><p><b>{title}</b><small>{detail}</small></p></div>
            ))}
          </div>
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
  const { locale, c, v } = useClientCopy();
  const products = useProductCatalog();
  return (
    <div className="selection-grid">
      {products.map((product) => {
        const publication = formatPublicationState(product);
        return (
        <button className={product.id === selected.id ? "select-card selected" : "select-card"} onClick={() => onSelect(product)} key={product.id}>
          <div className="select-image"><img src={product.image} alt="" /><span>{v(product.kind)}</span>{product.id === recommendedId && <b className="ai-select-match">{c("优先匹配", "Top match")}</b>}</div>
          <div><small>{product.model}</small><h3>{v(product.name)}</h3><p>{v(product.description)}</p></div>
          <div className="select-bottom"><strong>{productPriceLabel(product, locale)}</strong><span>{publication.state === "scheduled" ? publication.detail : v(product.lead)}</span></div>
        </button>
        );
      })}
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
  brief,
  onBriefChange,
  onAskAi,
  procurementItems,
  setProcurementItems,
  configurationTarget,
}: {
  selected: Product;
  onSelect: (p: Product) => void;
  onHome: () => void;
  onCustom: () => void;
  onComplete: () => void;
  onLeadCreated: (lead: LeadRecord) => void;
  brief: DiscoveryBrief;
  onBriefChange: (brief: DiscoveryBrief) => void;
  onAskAi: (prompt: string) => void;
  procurementItems: ProcurementItem[];
  setProcurementItems: Dispatch<SetStateAction<ProcurementItem[]>>;
  configurationTarget: ConfigurationTarget;
}) {
  const { locale, c, v } = useClientCopy();
  const products = useProductCatalog();
  const [step, setStep] = useState(configurationTarget?.productId === selected.id ? 2 : 1);
  const [qty, setQty] = useState(() => procurementItems.find((item) => item.productId === selected.id)?.quantity ?? 1);
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
  const selectedProcurementItem = procurementItems.find((item) => item.productId === selected.id);
  const configuration = productConfigurations[selected.id]
    ?? (selectedProcurementItem && Object.keys(selectedProcurementItem.configuration).length
      ? selectedProcurementItem.configuration
      : Object.fromEntries(selected.configuration.map((item) => [item.key, item.options[0]])));
  const setConfigurationValue = (key: string, value: string) =>
    setProductConfigurations((current) => ({
      ...current,
      [selected.id]: { ...configuration, [key]: value },
    }));
  const engineering = selected.engineeringReview;
  const primaryInterface = configuration.interface ?? configuration.realtime ?? configuration.network ?? "按所选方案";
  const estimatedTotalLabel = productPriceLabel(selected, locale, qty);
  const procurementProducts = procurementItems.map((item) => ({
    ...item,
    product: products.find((product) => product.id === item.productId)!,
  })).filter((item) => item.product);
  const totalProcurementQuantity = procurementItems.reduce((total, item) => total + item.quantity, 0);
  const pendingConfigurationCount = procurementItems.filter((item) => Object.keys(item.configuration).length === 0).length;
  const allProcurementConfigured = procurementItems.length > 0 && pendingConfigurationCount === 0;
  const pricedProcurementItems = procurementItems.filter((item) => standardUnitPriceRanges[item.productId]);
  const procurementPriceRange = pricedProcurementItems.reduce((total, item) => {
    const range = standardUnitPriceRanges[item.productId];
    return {
      low: total.low + range.low * item.quantity,
      high: total.high + range.high * item.quantity,
    };
  }, { low: 0, high: 0 });
  const procurementPriceLabel = procurementItems.length === 0
    ? c("尚未加入产品", "No products added")
    : pricedProcurementItems.length === 0
      ? c("评估后报价", "Quoted after review")
      : `${locale === "zh" ? "¥" : "RMB "}${procurementPriceRange.low.toLocaleString()}–${locale === "zh" ? "¥" : "RMB "}${procurementPriceRange.high.toLocaleString()}${pricedProcurementItems.length < procurementItems.length ? c(" + 待报价项", " + items pending quote") : ""}`;
  const customerComplete = [customer.company, customer.contact, customer.contactDetail, customer.country, customer.city, customer.address]
    .every((value) => value.trim().length > 0);
  const customerLocation = `${v(customer.country)} · ${customer.city}`;
  const recommendations = useMemo(() => recommendProducts(brief, products), [brief, products]);
  const recommended = recommendations[0];
  const selectedMatch = recommendations.find((item) => item.product.id === selected.id) ?? recommendations[0];
  const configurationSignals = [
    {
      label: c("用途匹配", "Application fit"),
      status: `${selectedMatch.score}%`,
      tone: selectedMatch.score >= 85 ? "good" : "attention",
      detail: locale === "zh"
        ? `${selected.model} 与“${brief.scene} · ${brief.goal}”的资料匹配度`
        : `${selected.model} fit for “${v(brief.scene)} · ${v(brief.goal)}” based on available data`,
    },
    {
      label: c("配置确认", "Configuration check"),
      status: engineering ? c("需工程确认", "Engineering review") : primaryInterface.includes("需确认") || primaryInterface.includes("EtherCAT") ? c("需核对接口", "Interface check") : c("资料内可配置", "Configurable"),
      tone: engineering || primaryInterface.includes("需确认") || primaryInterface.includes("EtherCAT") ? "attention" : "good",
      detail: engineering
        ? c("最终接口、安装、环境与系统边界需要联合评审", "Final interfaces, installation, environment and system constraints require joint review")
        : locale === "zh" ? `${primaryInterface} 已纳入采购意向摘要` : `${v(primaryInterface)} is included in your purchase request`,
    },
    {
      label: c("采购下一步", "Purchasing next step"),
      status: qty > 10 ? c("销售确认批量需求", "Sales checks volume") : c("可提交采购意向", "Ready to submit"),
      tone: qty > 10 ? "attention" : "good",
      detail: qty > 10
        ? c("销售将确认阶梯价格、库存和交付计划", "Sales will confirm volume pricing, stock and delivery plan")
        : c("补全公司与收货信息后即可提交", "Complete company and delivery details to submit"),
    },
  ];

  function selectProcurementProduct(product: Product) {
    onSelect(product);
    setQty(procurementItems.find((item) => item.productId === product.id)?.quantity ?? 1);
  }

  function addCurrentToProcurement() {
    if (engineering) return;
    const item: ProcurementItem = {
      productId: selected.id,
      quantity: qty,
      configuration: { ...configuration },
    };
    setProcurementItems((current) => [
      ...current.filter((existing) => existing.productId !== selected.id),
      item,
    ]);
  }

  function updateProcurementQuantity(productId: string, quantity: number) {
    const nextQuantity = Math.max(1, quantity);
    setProcurementItems((current) => current.map((item) =>
      item.productId === productId ? { ...item, quantity: nextQuantity } : item));
    if (selected.id === productId) setQty(nextQuantity);
  }

  function removeProcurementItem(productId: string) {
    setProcurementItems((current) => current.filter((item) => item.productId !== productId));
  }

  function submitStandardOrder() {
    if (!customerComplete || !allProcurementConfigured || orderId) return;
    // The request number is generated only in this user-triggered submit handler.
    // eslint-disable-next-line react-hooks/purity
    const id = `JN-20260729-${Date.now().toString().slice(-4)}`;
    const score = Math.min(95, 68 + (totalProcurementQuantity > 10 ? 12 : totalProcurementQuantity > 3 ? 7 : 3) + (procurementItems.length > 1 ? 5 : 0) + (customer.companyType === "机器人整机厂商" ? 8 : 5));
    const priority: LeadRecord["priority"] = score >= 75 ? "高" : score >= 55 ? "中" : "低";
    const itemSummary = procurementProducts.map(({ product, quantity, configuration: itemConfiguration }, index) =>
      `${index + 1}. ${product.model} ${product.name} × ${quantity} 件（${Object.entries(itemConfiguration).map(([key, value]) => `${key}=${value}`).join("；")}）`).join("\n");
    const models = procurementProducts.map(({ product }) => product.model).join(" / ");
    const lead: LeadRecord = {
      id,
      createdAt: "刚刚",
      source: procurementItems.length > 1 ? "集采报单" : "标准订单",
      company: customer.company.trim(),
      companyType: customer.companyType,
      contact: customer.contact.trim(),
      contactDetail: customer.contactDetail.trim(),
      country: customer.country.trim(),
      city: customer.city.trim(),
      score,
      status: "新线索",
      route: totalProcurementQuantity > 10 || procurementItems.length > 1 ? "销售高优先级" : "销售",
      priority,
      product: procurementItems.length > 1 ? `集采报单（${procurementItems.length} 项产品）` : procurementProducts[0].product.name,
      model: models,
      productImage: procurementProducts[0].product.image,
      quantity: `${procurementItems.length} 项 / ${totalProcurementQuantity} 件`,
      scene: [...new Set(procurementProducts.map(({ product }) => product.kind))].join(" / "),
      stage: totalProcurementQuantity > 10 ? "小批量验证" : "样品 / Demo",
      target: procurementItems.length > 1 ? "多产品交期由销售统一确认" : procurementProducts[0].product.lead,
      need: `客户一次性提交集采报单，共 ${procurementItems.length} 项、${totalProcurementQuantity} 件：\n${itemSummary}\n需要统一确认正式价格、库存、分批交付与整体交期。`,
      address: `${customer.country} ${customer.city} ${customer.address}${customer.postalCode ? `，${customer.postalCode}` : ""}`,
      nextAction: procurementItems.length > 1 ? "销售核对集采明细，合并确认价格、库存与交付排期。" : totalProcurementQuantity > 10 ? "销售确认批量库存、阶梯价格和交付排期。" : "销售确认订单、正式价格和发货安排。",
      estimatedPrice: procurementItems.length
        ? `${procurementPriceRange.low ? `¥${procurementPriceRange.low.toLocaleString()}–¥${procurementPriceRange.high.toLocaleString()}` : "评估后报价"}${pricedProcurementItems.length < procurementItems.length ? " + 待报价项" : ""}`
        : "评估后报价",
    };
    setOrderId(id);
    onLeadCreated(lead);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="flow-shell">
      <div className="flow-bar">
        <button className="back-button" onClick={onHome}>← {c("返回产品中心", "Back to products")}</button>
        <Progress step={step} />
        <span className="service-badge"><i /> {c("可咨询销售", "Sales support")}</span>
      </div>
      {step === 1 && (
        <section className="flow-content">
          <div className="flow-title">
            <span>SELECT A PRODUCT</span>
            <h1>{c("选择产品", "Choose products")}</h1>
            <p>{c("比较参数与供货状态，选择后配置。", "Compare specifications and availability, then configure.")}</p>
          </div>
          <div className="ai-selection-guide">
            <div className="ai-guide-copy"><span>AI</span><p><small>{c("当前采购条件", "Current requirements")}</small><b>{v(brief.scene)} · {v(brief.goal)}</b><em>{v(brief.stage)}</em></p></div>
            <div className="ai-guide-reason"><span>{c("优先考虑", "Top candidate")}</span><b>{recommended.product.model} · {v(recommended.product.name)}</b><p>{v(recommended.reason)}{locale === "zh" ? "。" : "."}</p></div>
            <div className="ai-guide-refine">
              <span>{c("调整主要用途", "Change application")}</span>
              <select value={brief.goal} onChange={(event) => onBriefChange({ ...brief, goal: event.target.value as DiscoveryBrief["goal"] })}>
                {discoveryGoals.map((goal) => <option value={goal} key={goal}>{v(goal)}</option>)}
              </select>
            </div>
          </div>
          <ProductList selected={selected} onSelect={selectProcurementProduct} recommendedId={recommended.product.id} />
          <div className="sticky-actions">
            <div><span>{c("当前选择", "Selected")}</span><strong>{selected.model} · {v(selected.name)}</strong></div>
            <button className="primary-button" onClick={() => setStep(2)}>{c("配置并加入采购栏", "Configure and add")} →</button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="config-layout">
          <div className="config-main">
            <button className="back-link" onClick={() => setStep(1)}>← {c("更换产品", "Change product")}</button>
            <div className="config-product">
              <img src={selected.image} alt={v(selected.name)} />
              <div><span className="verified-pill">✓ {c("资料已核对", "Data verified")}</span><small>{selected.model}</small><h1>{v(selected.name)}</h1><p>{v(selected.description)}</p></div>
            </div>
            <div className="panel">
              <div className="panel-heading"><h2>{c("关键参数", "Key specifications")}</h2><span>P.{selected.sourceSlide}</span></div>
              <div className="verified-table">
                {selected.verified.map((item, index) => <div key={item}><span>{[
                  c("性能 / 规格", "Performance / spec"),
                  c("电气 / 范围", "Electrical / range"),
                  c("环境 / 接口", "Environment / interface"),
                  c("扩展能力", "Expansion"),
                ][index] ?? c("参数", "Specification")}</span><strong>{v(item)}</strong><b>✓ {c("已确认", "Verified")}</b></div>)}
              </div>
            </div>
            <div className="panel">
              <div className="panel-heading"><h2>{c("采购配置", "Configuration")}</h2><span>* {c("必选", "Required")}</span></div>
              <div className="config-fields">
                {selected.configuration.map((item) => (
                  <label key={item.key}>
                    <span>{v(item.label)}</span>
                    <select value={configuration[item.key] ?? item.options[0]} onChange={(event) => setConfigurationValue(item.key, event.target.value)}>
                      {item.options.map((option) => <option value={option} key={option}>{v(option)}</option>)}
                    </select>
                    {item.note && <small className="field-note">{v(item.note)}</small>}
                  </label>
                ))}
                <label><span>{c("预计数量 *", "Expected quantity *")}</span><div className="quantity"><button type="button" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><input value={qty} readOnly aria-label={c("预计数量", "Expected quantity")} /><button type="button" onClick={() => setQty(qty + 1)}>＋</button></div></label>
              </div>
            </div>
            <div className="ai-configuration-companion" aria-live="polite">
              <div className="ai-companion-heading"><span>AI</span><p><small>CONFIGURATION CHECK</small><b>{c("配置检查", "Configuration check")}</b></p><button type="button" onClick={() => onAskAi(locale === "zh"
                ? `请评估我为${brief.scene}选择的 ${selected.model} 配置：${Object.entries(configuration).map(([key, value]) => `${key}=${value}`).join("；")}。说明匹配点、风险和仍需确认的参数。`
                : `Review my ${selected.model} configuration for a ${v(brief.scene)} application: ${Object.entries(configuration).map(([key, value]) => `${key}=${v(value)}`).join("; ")}. Explain the fit, risks and parameters still requiring confirmation.`)}>{c("咨询当前配置", "Review configuration")} →</button></div>
              <div className="ai-signal-grid">
                {configurationSignals.map((signal) => (
                  <div className={signal.tone} key={signal.label}><span>{signal.label}</span><strong>{signal.status}</strong><p>{signal.detail}</p></div>
                ))}
              </div>
              <p className="ai-handoff-note"><b>{c("下一步：", "Next step: ")}</b>{engineering
                ? c("该产品需要工程评审。请转入项目需求，当前产品与配置会一并提交。", "This product requires engineering review. Continue with a project request; the selected product and configuration will be included.")
                : customerComplete
                  ? c("信息完整，可提交采购栏。", "Ready to submit.")
                  : c("请补全联系与收货信息。", "Complete contact and delivery details.")}</p>
            </div>
            <div className="panel customer-panel">
              <div className="panel-heading">
                <div><h2>{c("联系与收货", "Contact & delivery")}</h2></div>
                <span>{c("带 * 为必填", "* Required")}</span>
              </div>
              <div className="config-fields">
                <label>
                  <span>{c("公司名称 *", "Company name *")}</span>
                  <input autoComplete="organization" value={customer.company} onChange={(e) => updateCustomer("company", e.target.value)} placeholder={c("公司完整名称", "Legal company name")} />
                </label>
                <label>
                  <span>{c("公司类型 *", "Company type *")}</span>
                  <select value={customer.companyType} onChange={(e) => updateCustomer("companyType", e.target.value)}>
                    {["机器人整机厂商", "系统集成商", "高校 / 研究机构", "创新团队", "经销商 / 渠道伙伴", "其他"].map((item) => <option value={item} key={item}>{v(item)}</option>)}
                  </select>
                </label>
                <label>
                  <span>{c("联系人 *", "Contact name *")}</span>
                  <input autoComplete="name" value={customer.contact} onChange={(e) => updateCustomer("contact", e.target.value)} placeholder={c("姓名", "Full name")} />
                </label>
                <label>
                  <span>{c("电话 / 邮箱 *", "Phone / email *")}</span>
                  <input autoComplete="email" value={customer.contactDetail} onChange={(e) => updateCustomer("contactDetail", e.target.value)} placeholder={c("用于确认采购需求", "For purchase-request confirmation")} />
                </label>
                <label>
                  <span>{c("国家 / 地区 *", "Country / region *")}</span>
                  <input autoComplete="country-name" value={customer.country} onChange={(e) => updateCustomer("country", e.target.value)} placeholder={c("例如：中国、德国", "e.g. Germany, United States")} />
                </label>
                <label>
                  <span>{c("省 / 州 / 城市 *", "State / province / city *")}</span>
                  <input autoComplete="address-level2" value={customer.city} onChange={(e) => updateCustomer("city", e.target.value)} placeholder={c("例如：上海市嘉定区", "e.g. Munich, Bavaria")} />
                </label>
                <label className="full-field">
                  <span>{c("详细地址 *", "Street address *")}</span>
                  <input autoComplete="street-address" value={customer.address} onChange={(e) => updateCustomer("address", e.target.value)} placeholder={c("街道、门牌号、楼宇及房间号", "Street, building and suite")} />
                </label>
                <label>
                  <span>{c("邮政编码", "Postal code")}</span>
                  <input autoComplete="postal-code" value={customer.postalCode} onChange={(e) => updateCustomer("postalCode", e.target.value)} placeholder={c("选填", "Optional")} />
                </label>
              </div>
              <div className="tracking-note"><span>✓</span><p>{c("信息仅用于报价、交付和后续服务。", "Used only for quotation, delivery and follow-up.")}</p></div>
            </div>
            <div className={engineering ? "engineer-warning" : "ai-explanation"}>
              <span>{engineering ? "!" : "AI"}</span>
              <div>
                <h3>{engineering ? c("提交前需要工程师确认", "Engineering confirmation required") : c("当前配置说明", "Configuration note")}</h3>
                <p>{engineering
                  ? c("该产品处于初步工程状态，散热、功耗、机械安装和 EtherCAT 组合需结合整机方案复核。", "This product is at a preliminary engineering stage. Thermal design, power, mechanical installation and EtherCAT combinations must be reviewed against the complete system.")
                  : locale === "zh"
                    ? `${primaryInterface} 已纳入配置。${qty > 10 ? "批量需求将由销售确认阶梯价格、库存和交期。" : "当前数量可提交采购意向，正式价格与交期仍需确认。"}`
                    : `${v(primaryInterface)} is included in the configuration. ${qty > 10 ? "Sales will confirm volume pricing, stock and lead time." : "You can submit this quantity as a purchase request; formal pricing and lead time still need confirmation."}`}</p>
                {engineering && <button onClick={onCustom}>{c("提交项目需求，申请联合评估", "Submit a project request for joint review")} →</button>}
              </div>
            </div>
          </div>
          <aside className="order-summary">
            <div className="procurement-heading">
              <div><span className="summary-label">PROCUREMENT LIST</span><h2>{c("采购栏", "Procurement list")}</h2></div>
              <b>{procurementItems.length}</b>
            </div>
            <div className="procurement-current">
              <div><img src={selected.image} alt="" /><span><small>{selected.model}</small><strong>{v(selected.name)}</strong><em>{qty} {c("件", "pcs")} · {estimatedTotalLabel}</em></span></div>
              <button type="button" disabled={engineering} onClick={addCurrentToProcurement}>
                {selectedProcurementItem ? c("更新当前产品", "Update this product") : c("加入采购栏", "Add to procurement list")} ＋
              </button>
              {engineering && <small>{c("该产品需工程评估，不能直接加入标准件集采报单。", "This product requires engineering review and cannot be added to a standard procurement request.")}</small>}
            </div>
            <div className="procurement-items">
              {procurementProducts.length ? procurementProducts.map(({ product, quantity, configuration: itemConfiguration }) => (
                <article key={product.id}>
                  <img src={product.image} alt="" />
                  <div><small>{product.model}</small><strong>{v(product.name)}</strong><em>{Object.keys(itemConfiguration).length ? productPriceLabel(product, locale, quantity) : c("待配置", "Configuration required")}</em></div>
                  <div className="procurement-item-actions">
                    {!Object.keys(itemConfiguration).length && <button type="button" className="configure-pending" onClick={() => selectProcurementProduct(product)}>{c("去配置", "Configure")}</button>}
                    <button type="button" onClick={() => updateProcurementQuantity(product.id, quantity - 1)}>−</button>
                    <span>{quantity}</span>
                    <button type="button" onClick={() => updateProcurementQuantity(product.id, quantity + 1)}>＋</button>
                    <button type="button" className="remove" onClick={() => removeProcurementItem(product.id)} aria-label={c("移除产品", "Remove product")}>×</button>
                  </div>
                </article>
              )) : <div className="procurement-empty"><b>{c("采购栏还是空的", "Your procurement list is empty")}</b><span>{c("配置产品后加入，可一次提交多项采购需求。", "Configure products and add them for one consolidated submission.")}</span></div>}
            </div>
            <button type="button" className="procurement-more" onClick={() => setStep(1)}>＋ {c("继续添加产品", "Add another product")}</button>
            <dl className="procurement-totals">
              <div><dt>{c("产品项", "Line items")}</dt><dd>{procurementItems.length} {c("项", "items")}</dd></div>
              <div><dt>{c("总数量", "Total quantity")}</dt><dd>{totalProcurementQuantity} {c("件", "pcs")}</dd></div>
            </dl>
            <div className="price-row"><span>{c("集采参考总价", "Indicative total")}</span><strong>{procurementPriceLabel}</strong></div>
            <p className="small-note">{customerComplete
              ? locale === "zh" ? `客户：${customer.company} · ${customerLocation}。` : `Customer: ${customer.company} · ${customerLocation}. `
              : c("请完整填写公司、联系人和收货地址后提交。", "Complete the company, contact and delivery details before submitting. ")}
              {pendingConfigurationCount ? c(`尚有 ${pendingConfigurationCount} 项产品待配置。`, `${pendingConfigurationCount} items still require configuration. `) : ""}
              {c("页面信息不构成正式报价，最终以 JOYNEXT 报价单或订单确认为准。", "Information shown here is not a formal quotation. Final terms are subject to a JOYNEXT quotation or order confirmation.")}</p>
            <button className="primary-button full" disabled={!allProcurementConfigured || !customerComplete} onClick={submitStandardOrder}>{c("一次提交并生成报单", "Submit and create request")} →</button>
            {engineering && <button className="outline-button full" onClick={onCustom}>{c("申请工程评估", "Request engineering review")}</button>}
          </aside>
        </section>
      )}
      {step === 3 && (
        <section className="confirmation">
          <div className="success-mark">✓</div>
          <span>CONSOLIDATED REQUEST CREATED</span>
          <h1>{c("集采报单已生成", "Procurement request created")}</h1>
          <p>{c("报单编号", "Request number")} <b>{orderId}</b>。{c("销售将统一确认价格、库存与交期。", "Sales will confirm pricing, stock and lead time.")}</p>
          <div className="confirmation-card">
            <div><small>{c("产品项", "Line items")}</small><strong>{procurementItems.length} {c("项", "items")}</strong></div>
            <div><small>{c("总数量", "Total quantity")}</small><strong>{totalProcurementQuantity} {c("件", "pcs")}</strong></div>
            <div><small>{c("参考总价", "Indicative total")}</small><strong>{procurementPriceLabel}</strong></div>
            <div><small>{c("处理方式", "Handling")}</small><strong>{c("统一报价与排期", "Consolidated quote and schedule")}</strong></div>
          </div>
          <div className="generated-procurement-sheet">
            <div><span>{c("集采明细", "Procurement details")}</span><b>{orderId}</b></div>
            {procurementProducts.map(({ product, quantity, configuration: itemConfiguration }, index) => (
              <article key={product.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <img src={product.image} alt="" />
                <div><small>{product.model}</small><strong>{v(product.name)}</strong><p>{Object.values(itemConfiguration).slice(0, 3).map(v).join(" · ")}</p></div>
                <b>× {quantity}</b>
                <em>{productPriceLabel(product, locale, quantity)}</em>
              </article>
            ))}
            <p>{c("仅供参考，正式价格与交付以销售确认为准。", "For reference only; final terms require sales confirmation.")}</p>
          </div>
          <div className="customer-profile-card">
            <div className="customer-profile-heading"><span>{c("联系与收货信息", "Contact and delivery details")}</span><b>{c("已随采购意向提交", "Submitted with your request")}</b></div>
            <div className="customer-profile-grid">
              <div><small>{c("公司", "Company")}</small><strong>{customer.company}</strong><span>{v(customer.companyType)}</span></div>
              <div><small>{c("联系人", "Contact")}</small><strong>{customer.contact}</strong><span>{customer.contactDetail}</span></div>
              <div><small>{c("国家 / 城市", "Country / city")}</small><strong>{customerLocation}</strong><span>{customer.postalCode ? `${c("邮编", "Postal code")} ${customer.postalCode}` : c("未填写邮编", "No postal code")}</span></div>
              <div><small>{c("收货地址", "Delivery address")}</small><strong>{customer.address}</strong><span>{c("用于评估发货与区域服务安排", "Used to assess shipping and regional service")}</span></div>
            </div>
          </div>
          <div className="sales-timeline"><div className="done"><span>✓</span><b>{c("意向提交", "Request sent")}</b></div><i /><div className="active"><span>2</span><b>{c("销售确认", "Sales review")}</b></div><i /><div><span>3</span><b>{c("报价与订单", "Quote & order")}</b></div></div>
          <div className="confirmation-actions">
            <button className="outline-button" onClick={onComplete}>{c("返回首页", "Back to homepage")}</button>
            <button className="outline-button" onClick={() => window.print()}>{c("打印 / 保存报单", "Print / save request")}</button>
            <button className="primary-button" onClick={() => onAskAi(c("我已经提交采购意向，请告诉我接下来需要准备哪些信息。", "I have submitted a purchase request. What information should I prepare next?"))}>{c("咨询下一步", "Ask about next steps")} →</button>
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
  brief,
  onAskAi,
}: {
  onHome: () => void;
  onComplete: () => void;
  onLeadCreated: (lead: LeadRecord) => void;
  brief: DiscoveryBrief;
  onAskAi: (prompt: string) => void;
}) {
  const { locale, c, v } = useClientCopy();
  const [submitted, setSubmitted] = useState(false);
  const [priority, setPriority] = useState("常规");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [createdLead, setCreatedLead] = useState<LeadRecord | null>(null);
  const [form, setForm] = useState({
    project: "", company: "", contact: "", phone: "", country: "中国", scene: brief.scene,
    volume: "", stage: brief.stage === "概念设计" ? "概念设计" : brief.stage, target: "3 个月内", need: "",
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const priceEstimate = estimateCustomPrice(form.scene, form.stage, priority, form.need, locale);
  const requirementChecks = [
    { label: c("任务目标", "Task"), done: form.need.trim().length >= 18 },
    { label: c("接口 / 平台", "Interface / platform"), done: /接口|EtherCAT|CAN|USB|RS485|平台|控制器|interface|platform|controller/i.test(form.need) },
    { label: c("环境 / 空间", "Environment / space"), done: /环境|温度|防护|安装|尺寸|空间|户外|室内|environment|temperature|protection|mount|dimension|space|outdoor|indoor/i.test(form.need) },
    { label: c("数量 / 时间", "Quantity / timing"), done: Boolean(form.volume.trim()) && form.target !== "待确认" },
  ];
  const requirementCompleteness = Math.round(requirementChecks.filter((item) => item.done).length / requirementChecks.length * 100);
  const requirementFragments = locale === "en"
    ? form.scene === "AMR / AGV"
      ? ["Add navigation speed, obstacle range and field-of-view needs", "Describe the existing controller and sensor interfaces", "Add warehouse lighting, dust and temperature range"]
      : form.scene === "人形机器人"
        ? ["Add control cycle, joint count and compute needs", "Describe system power, cooling and installation space", "Add attitude accuracy, dynamic range and safety constraints"]
        : ["Add cycle time, accuracy and working range", "Describe the existing platform, interfaces and mounting", "Add environment, protection rating and certification needs"]
    : form.scene === "AMR / AGV"
      ? ["补充导航速度、避障距离和视场要求", "说明已有控制器及传感器接口", "补充仓库光照、粉尘和温度范围"]
      : form.scene === "人形机器人"
        ? ["补充控制周期、关节数量和算力需求", "说明整机功耗、散热与安装空间", "补充姿态精度、动态范围和安全约束"]
        : ["补充任务节拍、精度和工作距离", "说明已有平台、通信接口和安装方式", "补充环境、防护等级与认证要求"];

  const addRequirementFragment = (fragment: string) => {
    setForm((current) => ({
      ...current,
      need: `${current.need}${current.need.trim() ? (locale === "en" ? "; " : "；") : ""}${fragment}${locale === "en" ? ": " : "："}`,
    }));
  };

  if (submitted) {
    return (
      <main className="flow-shell">
        <div className="flow-bar"><button className="back-button" onClick={onHome}>← {c("返回产品中心", "Back to products")}</button><Progress step={3} custom /><span className="service-badge"><i /> {c("已提交", "Submitted")}</span></div>
        <section className="confirmation custom-confirmation">
          <div className="success-mark">✓</div><span>PROJECT REQUEST RECEIVED</span><h1>{c("项目需求已提交", "Project request submitted")}</h1>
          <p>{c("需求编号", "Reference")} <b>{createdLead?.id}</b>。{c("我们会根据技术复杂度安排销售或工程师与您联系。", "We will assign sales or engineering support based on the technical complexity.")}</p>
          <div className="lead-summary">
            <div><small>{c("商务联系", "Commercial contact")}</small><strong>{c("机器人业务销售团队", "Robotics sales team")}</strong><span>{c("预计 2 小时内首次联系", "First contact expected within 2 hours")}</span></div>
            <div><small>{c("技术支持", "Technical support")}</small><strong>{c("按需求匹配工程团队", "Matched engineering team")}</strong><span>{c("技术条件已随需求提交", "Technical details included in the request")}</span></div>
            <div><small>{c("后续文件", "Next documents")}</small><strong>{c("正式报价与初步计划", "Formal quote and initial plan")}</strong><span>{c("预计 2 个工作日内提供", "Expected within 2 business days")}</span></div>
          </div>
          <div className="summary-document">
            <div><span>{c("您提交的需求摘要", "Your request summary")}</span><b>{c("已交给销售与技术人员", "Shared with sales and engineering")}</b></div>
            <p>{locale === "zh"
              ? `${form.company || "客户"}计划在${form.scene}场景中推进“${form.project || "未命名项目"}”，预计需求量 ${form.volume || "待确认"}。核心需求：${form.need || "待进一步沟通"}。`
              : `${form.company || "The customer"} is planning “${form.project || "Untitled project"}” for a ${v(form.scene)} application, with an expected volume of ${form.volume || "to be confirmed"}. Core requirements: ${form.need || "to be discussed"}.`}</p>
          </div>
          <div className="custom-price-estimate">
            <div className="price-estimate-heading">
              <div><span>PRELIMINARY ESTIMATE</span><h2>{c("初步方案价格区间", "Preliminary solution range")}</h2></div>
              <strong>{priceEstimate.label}</strong>
            </div>
            <p>{c("该区间根据初步工程评估、适配开发和样机准备估算，参考因素包括：", "This range is estimated from preliminary engineering, adaptation work and prototype preparation, including:")}</p>
            <div className="estimate-factors">{priceEstimate.reasons.map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
            <div className="estimate-disclaimer"><b>{c("仅供参考，不构成正式报价", "For reference only; not a formal quotation")}</b><span>{c("实际价格受最终配置、技术边界、样品数量、开发投入、测试认证和交付周期影响，请与 JOYNEXT 销售确认。", "Actual pricing depends on final configuration, technical scope, sample quantity, development effort, testing, certification and delivery timing. Please confirm with JOYNEXT sales.")}</span></div>
          </div>
          <div className="confirmation-actions">
            <button className="outline-button" onClick={onComplete}>{c("返回首页", "Back to homepage")}</button>
            <button className="primary-button" onClick={() => onAskAi(c("我已经提交项目需求，请告诉我接下来需要准备哪些技术资料。", "I have submitted a project request. What technical information should I prepare next?"))}>{c("咨询下一步", "Ask about next steps")} →</button>
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
      need: `${form.project}：${form.need}${attachments.length ? `；附件：${attachments.join("、")}` : ""}`,
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
      <div className="flow-bar"><button className="back-button" onClick={onHome}>← {c("返回产品中心", "Back to products")}</button><Progress step={2} custom /><span className="service-badge"><i /> {c("可咨询销售", "Sales support")}</span></div>
      <section className="custom-layout">
        <div className="custom-main">
          <div className="flow-title"><span>PROJECT REQUIREMENTS</span><h1>{c("项目需求评估", "Project review")}</h1><p>{locale === "zh"
            ? `${brief.scene} · ${brief.goal}。补充关键条件即可获得联合评估。`
            : `${v(brief.scene)} · ${v(brief.goal)}. Add key constraints for joint review.`}</p></div>
          <form className="custom-form" onSubmit={submit}>
            <div className="form-section">
              <div className="form-section-title"><span>01</span><div><h2>{c("项目与应用", "Project")}</h2></div></div>
              <div className="form-grid">
                <label><span>{c("项目名称 *", "Project name *")}</span><input required value={form.project} onChange={(e) => update("project", e.target.value)} placeholder={c("例如：仓储 AMR 视觉升级", "e.g. Warehouse AMR vision upgrade")} /></label>
                <label><span>{c("机器人类型 *", "Robot type *")}</span><select value={form.scene} onChange={(e) => update("scene", e.target.value)}>{["人形机器人", "AMR / AGV", "协作机械臂", "服务机器人", "其他"].map((scene) => <option value={scene} key={scene}>{v(scene)}</option>)}</select></label>
                <label className="full-field"><span>{c("需求描述 *", "Requirements *")}</span><textarea required value={form.need} onChange={(e) => update("need", e.target.value)} placeholder={c("用途、接口、环境、安装、数量和时间…", "Task, interface, environment, installation, volume and timing…")} /></label>
              </div>
              <div className="ai-requirement-coach" aria-live="polite">
                <div className="requirement-score"><span>AI</span><p><small>{c("信息完整度", "Information completeness")}</small><strong>{requirementCompleteness}%</strong></p><i><b style={{ width: `${requirementCompleteness}%` }} /></i></div>
                <div className="requirement-checks">
                  {requirementChecks.map((item) => <span className={item.done ? "done" : ""} key={item.label}>{item.done ? "✓" : "+"} {item.label}</span>)}
                </div>
                <div className="requirement-prompts">
                  <small>{c("点击补充缺失项", "Add missing details")}</small>
                  <div>{requirementFragments.map((fragment) => <button type="button" key={fragment} onClick={() => addRequirementFragment(fragment)}>{fragment}</button>)}</div>
                </div>
                <p><b>{c("当前信息检查：", "Current information check: ")}</b>{form.need.trim()
                  ? locale === "zh"
                    ? `${form.scene}项目，主要用于${brief.goal}；已包含 ${requirementChecks.filter((item) => item.done).map((item) => item.label).join("、") || "基础场景"}，其余内容需要后续确认。`
                    : `${v(form.scene)} project for ${v(brief.goal)}; captured: ${requirementChecks.filter((item) => item.done).map((item) => item.label).join(", ") || "basic application"}. Remaining items still need confirmation.`
                  : c("请先描述任务目标。", "Start with the task.")}</p>
              </div>
            </div>
            <div className="form-section">
              <div className="form-section-title"><span>02</span><div><h2>{c("采购与联系", "Purchasing & contact")}</h2></div></div>
              <div className="form-grid">
                <label><span>{c("公司名称 *", "Company name *")}</span><input required value={form.company} onChange={(e) => update("company", e.target.value)} placeholder={c("公司全称", "Legal company name")} /></label>
                <label><span>{c("预计用量", "Expected volume")}</span><input value={form.volume} onChange={(e) => update("volume", e.target.value)} placeholder={c("例如：100–500 套 / 年", "e.g. 100–500 units / year")} /></label>
                <label><span>{c("联系人 *", "Contact name *")}</span><input required value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder={c("姓名", "Full name")} /></label>
                <label><span>{c("电话 / 邮箱 *", "Phone / email *")}</span><input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder={c("用于销售联系", "For sales follow-up")} /></label>
                <label><span>{c("国家 / 地区 *", "Country / region *")}</span><input required value={form.country} onChange={(e) => update("country", e.target.value)} placeholder={c("例如：中国、德国", "e.g. Germany, United States")} /></label>
                <label><span>{c("项目阶段 *", "Project stage *")}</span><select value={form.stage} onChange={(e) => update("stage", e.target.value)}>{["概念设计", "Demo / 样机", "样机验证", "小批量验证", "量产导入"].map((stage) => <option value={stage} key={stage}>{v(stage)}</option>)}</select></label>
                <label><span>{c("期望时间 *", "Required timing *")}</span><select value={form.target} onChange={(e) => update("target", e.target.value)}>{["1 个月内", "3 个月内", "6 个月内", "12 个月内", "待确认"].map((target) => <option value={target} key={target}>{v(target)}</option>)}</select></label>
              </div>
            </div>
            <div className="form-section">
              <div className="form-section-title"><span>03</span><div><h2>{c("节奏与附件", "Timing & files")}</h2></div></div>
              <div className="priority-row">
                {["常规", "紧急样机", "量产项目"].map((item) => <button type="button" className={priority === item ? "priority active" : "priority"} key={item} onClick={() => setPriority(item)}><span>{item === "常规" ? "○" : item === "紧急样机" ? "⚡" : "▦"}</span><b>{v(item)}</b><small>{item === "常规"
                  ? c("常规评估与联系节奏", "Standard review and response")
                  : item === "紧急样机"
                    ? c("优先确认样机资源与时间", "Priority check of prototype resources and timing")
                    : c("评估量产导入、验证与供货计划", "Review production launch, validation and supply planning")}</small></button>)}
              </div>
              <div className="upload-box"><span>⇧</span><div><b>{attachments.length ? attachments.join(" · ") : c("添加文档、图纸或 BOM", "Add documents, drawings or BOM")}</b><small>PDF · PPT · STEP · Excel</small></div><label className="upload-trigger">{c("选择文件", "Choose files")}<input type="file" multiple accept=".pdf,.ppt,.pptx,.step,.stp,.xls,.xlsx" onChange={(event) => setAttachments(Array.from(event.target.files ?? []).map((file) => file.name))} /></label></div>
            </div>
            <label className="consent"><input required type="checkbox" /> {c("我同意 JOYNEXT 使用以上信息联系我并评估本次采购需求。", "I agree that JOYNEXT may use this information to contact me and evaluate this purchasing request.")}</label>
            <div className="form-submit"><div><span className="live-dot" />{c("提交后由销售确认", "Sales will confirm after submission")}</div><button className="primary-button" type="submit">{c("提交项目需求", "Submit project request")} →</button></div>
          </form>
        </div>
        <aside className="custom-aside">
          <div className="live-estimate-card aside-estimate" aria-live="polite">
            <div className="live-estimate-main">
              <div className="live-estimate-label"><span>AI</span><p><small>PRELIMINARY RANGE</small><b>{c("初步参考估价", "Preliminary estimate")}</b></p></div>
              <strong>{priceEstimate.label}</strong>
              <p>{c("基于场景、阶段与复杂度。", "Based on scope, stage and complexity.")}</p>
            </div>
            <div className="live-estimate-detail">
              <div>{priceEstimate.reasons.map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
              <p><b>{c("仅供参考。", "For reference only. ")}</b>{c("正式价格由销售确认。", "Sales confirms final pricing.")}</p>
            </div>
          </div>
          <button className="aside-ai-review" type="button" onClick={() => onAskAi(form.need.trim()
            ? locale === "zh" ? `请根据以下项目需求给出候选产品组合、缺失信息和工程风险：场景=${form.scene}；阶段=${form.stage}；需求=${form.need}` : `For this project request, suggest candidate products, missing information and engineering risks: application=${v(form.scene)}; stage=${v(form.stage)}; requirements=${form.need}`
            : locale === "zh" ? `请围绕${form.scene}和${brief.goal}目标，通过关键问题帮我补全一份可供工程师评估的需求描述。` : `For ${v(form.scene)} and ${v(brief.goal)}, ask key questions to help me complete a requirement description for engineering review.`)}>
            <span>AI</span><p><b>{form.need.trim() ? c("检查需求", "Review requirements") : c("补全需求", "Complete requirements")}</b><small>{c("候选产品与待确认项", "Candidates and open questions")}</small></p><em>→</em>
          </button>
          <div className="sales-card"><span className="live-dot" /><small>SALES + ENGINEERING</small><h3>{c("一次提交，持续跟进", "One request, continuous follow-up")}</h3><div className="avatar-row"><i>AI</i><i>{c("销", "S")}</i><i>{c("技", "E")}</i><span>{c("智能整理 + 专业确认", "AI structured + specialist confirmed")}</span></div></div>
          <div className="next-card"><h3>{c("提交后会发生什么", "What happens after submission")}</h3>{[
            ["1", c("需求确认", "Request received"), c("生成需求编号与摘要", "Reference and summary created")],
            ["2", c("销售联系", "Sales contact"), c("预计 2 小时内首次联系", "First contact expected within 2 hours")],
            ["3", c("工程评估", "Engineering review"), c("确认接口、风险与技术边界", "Confirm interfaces, risks and technical scope")],
            ["4", c("报价与计划", "Quote and plan"), c("预计 2 个工作日内提供", "Expected within 2 business days")],
          ].map(([n, h, p]) => <div key={n}><span>{n}</span><p><b>{h}</b><small>{p}</small></p></div>)}</div>
          <div className="trust-card"><h3>{c("信息边界", "Information boundary")}</h3><p>{c("兼容、安全、价格与设计结论需专业确认。", "Compatibility, safety, pricing and design require specialist confirmation.")}</p></div>
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
  const { c } = useClientCopy();
  return (
    <footer className="contact-footer" id="contact">
      <div className="contact-footer-intro">
        <span>CONTACT JOYNEXT</span>
        <h2>{c("让销售与工程团队继续协助", "Continue with sales and engineering")}</h2>
        <p>{c("发送产品型号、数量和项目阶段，我们会安排后续沟通。", "Share the model, quantity and project stage for follow-up.")}</p>
      </div>
      <div className="contact-footer-methods">
        <a href="mailto:contact@joynext.com"><small>{c("电子邮箱", "Email")}</small><strong>contact@joynext.com</strong><span>↗</span></a>
        <a href="tel:+8657487127249"><small>{c("联系电话", "Phone")}</small><strong>+86 0574 8712 7249</strong><span>↗</span></a>
        <div><small>{c("中国总部", "China headquarters")}</small><strong>{c("浙江省宁波市高新区清逸路 99 号", "No. 99 Qingyi Road, Hi-Tech Park, Ningbo")}</strong></div>
      </div>
      <div className="contact-footer-bottom">
        <Logo inverse />
        <p>{c("机器人元器件选型、询价与项目支持", "Robotics component selection, quotation and project support")}</p>
        <div><a href="#products">{c("产品", "Products")}</a><a href="#scenarios">{c("应用", "Applications")}</a><a href="#support">{c("支持", "Support")}</a><span>© 2026 JOYNEXT</span></div>
      </div>
    </footer>
  );
}

function FloatingOrderButton({ onClick }: { onClick: () => void }) {
  const { c } = useClientCopy();
  return (
    <button className="floating-order-button" onClick={onClick} aria-label={c("前往产品采购入口", "Go to purchase options")}>
      <PurchaseIcon />
      <span><small>PURCHASE REQUEST</small><b>{c("提交采购意向", "Request a quote")}</b></span>
      <i>→</i>
    </button>
  );
}

export default function HomePage() {
  const [locale, setLocale] = useState<ClientLocale>("zh");
  const [localeReady, setLocaleReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [managedProducts, setManagedProducts] = useState<ManagedProduct[]>(createDefaultManagedProducts);
  const storefrontProducts = useMemo(() => managedProducts
    .filter((product) => product.publication.lifecycle !== "offline")
    .map((product) => ({ ...product, image: withBasePath(product.image) })), [managedProducts]);
  const [selected, setSelected] = useState(defaultProducts.find((product) => product.id === "depth-48") ?? defaultProducts[0]);
  const [brief, setBrief] = useState<DiscoveryBrief>({
    scene: "AMR / AGV",
    goal: "导航与避障",
    stage: "Demo / 样机",
  });
  const [leads, setLeads] = useState<LeadRecord[]>(seedLeads);
  const [leadStoreReady, setLeadStoreReady] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState<AssistantPrompt | null>(null);
  const [procurementItems, setProcurementItems] = useState<ProcurementItem[]>([]);
  const [procurementOpen, setProcurementOpen] = useState(false);
  const [configurationTarget, setConfigurationTarget] = useState<ConfigurationTarget>(null);

  useEffect(() => {
    const restoreProducts = () => {
      const saved = parseManagedProducts(window.localStorage.getItem(PRODUCT_OPERATIONS_STORAGE_KEY));
      if (saved) setManagedProducts(saved);
    };
    const restore = window.setTimeout(restoreProducts, 0);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PRODUCT_OPERATIONS_STORAGE_KEY) restoreProducts();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearTimeout(restore);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!storefrontProducts.length || storefrontProducts.some((product) => product.id === selected.id)) return;
    const sync = window.setTimeout(() => setSelected(storefrontProducts[0]), 0);
    return () => window.clearTimeout(sync);
  }, [selected.id, storefrontProducts]);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const savedLocale = window.localStorage.getItem("joynext-client-locale");
      if (savedLocale === "zh" || savedLocale === "en") setLocale(savedLocale);
      setLocaleReady(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!localeReady) return;
    window.localStorage.setItem("joynext-client-locale", locale);
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    document.title = locale === "en"
      ? "JOYNEXT Robotics Components | Product Selection & RFQ"
      : "JOYNEXT 机器人元器件选型与询价";
  }, [locale, localeReady]);

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
    setConfigurationTarget(null);
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

  const navigateToProductCategory = (category: string) => {
    setView("home");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("joynext:product-category", { detail: category }));
        document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const addProductToProcurement = (product: Product) => {
    setProcurementItems((current) => current.some((item) => item.productId === product.id)
      ? current
      : [...current, { productId: product.id, quantity: 1, configuration: {} }]);
  };

  const configureProcurementProduct = (product: Product) => {
    setSelected(product);
    setProcurementOpen(false);
    setAssistantOpen(false);
    navigate("standard");
    setConfigurationTarget({ productId: product.id, requestId: Date.now() });
  };

  const removeProcurementProduct = (productId: string) => {
    setProcurementItems((current) => current.filter((item) => item.productId !== productId));
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <ProductCatalogContext.Provider value={storefrontProducts}>
        <div>
          <MotionEffects />
          <Header
            onNavigate={navigate}
            onNavigateSection={navigateToSection}
            onNavigateCategory={navigateToProductCategory}
            onOpenAssistant={() => openAssistant()}
            procurementCount={procurementItems.length}
            onOpenProcurement={() => setProcurementOpen(true)}
          />
          {view === "home" && <Home onNavigate={navigate} onSelect={setSelected} brief={brief} onBriefChange={setBrief} onAskAi={openAssistant} />}
          {view === "standard" && <StandardFlow key={configurationTarget?.requestId ?? "standard"} selected={selected} onSelect={setSelected} onHome={() => navigate("home")} onCustom={() => navigate("custom")} onComplete={() => navigate("home")} onLeadCreated={addLead} brief={brief} onBriefChange={setBrief} onAskAi={openAssistant} procurementItems={procurementItems} setProcurementItems={setProcurementItems} configurationTarget={configurationTarget} />}
          {view === "custom" && <CustomFlow onHome={() => navigate("home")} onComplete={() => navigate("home")} onLeadCreated={addLead} brief={brief} onAskAi={openAssistant} />}
          {view === "home" && <Footer />}
          {view === "home" && <FloatingOrderButton onClick={() => navigateToSection("standard-order")} />}
          <ProcurementDrawer open={procurementOpen} items={procurementItems} onClose={() => setProcurementOpen(false)} onConfigure={configureProcurementProduct} onRemove={removeProcurementProduct} />
          <AiAssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} brief={brief} selected={selected} view={view} promptRequest={assistantPrompt} onSelectProduct={selectFromAssistant} procurementItems={procurementItems} onAddProduct={addProductToProcurement} />
        </div>
      </ProductCatalogContext.Provider>
    </LocaleContext.Provider>
  );
}
