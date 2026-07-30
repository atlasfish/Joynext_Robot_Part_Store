"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createDefaultManagedProducts,
  formatPublicationState,
  parseManagedProducts,
  PRODUCT_OPERATIONS_STORAGE_KEY,
  type ManagedProduct,
  type ProductLifecycle,
} from "@/lib/product-operations";
import "./admin.css";
import "./swiss-admin.css";

type AdminTab = "overview" | "products" | "leads" | "customers" | "orders" | "tasks";
type LeadStatus = "新线索" | "工程评审" | "销售跟进" | "培育中" | "已转机会" | "已关闭";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const withBasePath = (path: string) => `${basePath}${path}`;

type Lead = {
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

const demoLeads: Lead[] = [
  {
    id: "L-20260729-0059", createdAt: "今天 09:18", source: "定制需求", company: "RoboMotion GmbH", companyType: "机器人整机厂商",
    contact: "Anna Weber", contactDetail: "info@robomotion.de", country: "德国", city: "慕尼黑", score: 92, status: "工程评审",
    route: "销售 + 工程", priority: "高", product: "机器人域控制器", model: "nRB-H1", productImage: withBasePath("/products/domain-controller.png"),
    quantity: "50–100 套 / 年", scene: "协作机械臂", stage: "样机验证", target: "3 个月内", address: "Munich, Germany",
    need: "精密装配机械臂，需要高重复定位精度、紧凑结构和与现有产线集成。", nextAction: "安排系统工程师确认实时控制、安装空间和负载边界。", estimatedPrice: "¥14万 – ¥27万",
  },
  {
    id: "L-20260729-0058", createdAt: "今天 09:42", source: "标准订单", company: "Alpha Automation", companyType: "系统集成商",
    contact: "James Cole", contactDetail: "purchasing@alphaauto.com", country: "美国", city: "底特律", score: 78, status: "销售跟进",
    route: "销售", priority: "高", product: "高可靠 IMU 模组", model: "IMU-MCU-01", productImage: withBasePath("/products/imu-module.webp"),
    quantity: "24 件", scene: "AMR / AGV", stage: "小批量验证", target: "1 个月内", address: "Detroit, USA",
    need: "采购标准 IMU 模组用于仓储 AMR 小批量验证。", nextAction: "确认批量交期并发送正式报价。", estimatedPrice: "¥30,720",
  },
  {
    id: "L-20260729-0057", createdAt: "今天 10:05", source: "定制需求", company: "SmartFab Solutions", companyType: "系统集成商",
    contact: "Olivia Brown", contactDetail: "hello@smartfab.co.uk", country: "英国", city: "曼彻斯特", score: 64, status: "工程评审",
    route: "工程", priority: "中", product: "机器人域控制器", model: "nRB-H1", productImage: withBasePath("/products/domain-controller.png"),
    quantity: "20–50 套 / 年", scene: "协作机械臂", stage: "概念设计", target: "6 个月内", address: "Manchester, UK",
    need: "整合视觉感知、运动控制和安全通信，功耗与散热条件待确认。", nextAction: "补充整机功耗、散热和机械安装资料。", estimatedPrice: "¥12万 – ¥24万",
  },
  {
    id: "L-20260729-0056", createdAt: "今天 10:33", source: "标准订单", company: "NexGen Robotics", companyType: "机器人整机厂商",
    contact: "Liam Martin", contactDetail: "rfq@nexgenrobotics.ca", country: "加拿大", city: "多伦多", score: 81, status: "新线索",
    route: "销售", priority: "高", product: "双目深度相机", model: "DPC-48-XM-A1", productImage: withBasePath("/products/depth-camera.webp"),
    quantity: "36 件", scene: "服务机器人", stage: "样机验证", target: "1 个月内", address: "Toronto, Canada",
    need: "室内服务机器人需要深度、RGB 与 IMU 融合感知。", nextAction: "确认库存、USB-C 接口与批量交付计划。", estimatedPrice: "¥179,280",
  },
  {
    id: "L-20260729-0055", createdAt: "今天 11:02", source: "定制需求", company: "MechPro Systems", companyType: "创新团队",
    contact: "Arjun Rao", contactDetail: "buy@mechpro.in", country: "印度", city: "班加罗尔", score: 58, status: "培育中",
    route: "培育", priority: "中", product: "车规级鱼眼相机", model: "FSC-210", productImage: withBasePath("/products/fisheye-camera.webp"),
    quantity: "5–10 套 / 年", scene: "AMR / AGV", stage: "概念设计", target: "待确认", address: "Bengaluru, India",
    need: "早期 AMR 项目，需要评估超广角视觉 SLAM 的可行性。", nextAction: "发送产品资料并在两周后自动回访。", estimatedPrice: "¥8万 – ¥16万",
  },
  {
    id: "L-20260729-0054", createdAt: "今天 11:27", source: "标准订单", company: "Nordic Automate", companyType: "高校 / 研究机构",
    contact: "Erik Lund", contactDetail: "contact@nordicautomate.se", country: "瑞典", city: "斯德哥尔摩", score: 45, status: "培育中",
    route: "培育", priority: "低", product: "高可靠 IMU 模组", model: "IMU-MCU-01", productImage: withBasePath("/products/imu-module.webp"),
    quantity: "2 件", scene: "人形机器人", stage: "概念设计", target: "待确认", address: "Stockholm, Sweden",
    need: "实验室姿态控制研究样品。", nextAction: "自动发送样品政策与开发资料。", estimatedPrice: "¥2,560",
  },
];

const tabMeta: Array<{ id: AdminTab; icon: string; label: string; note: string }> = [
  { id: "overview", icon: "01", label: "经营概览", note: "关键指标与转化" },
  { id: "products", icon: "02", label: "商品运营", note: "信息、上下线与预售" },
  { id: "leads", icon: "03", label: "线索中心", note: "评分与业务路由" },
  { id: "customers", icon: "04", label: "客户档案", note: "公司与历史记录" },
  { id: "orders", icon: "05", label: "订单管理", note: "报价与履约状态" },
  { id: "tasks", icon: "06", label: "跟进任务", note: "SLA 与待办事项" },
];

const statusOptions: LeadStatus[] = ["新线索", "工程评审", "销售跟进", "培育中", "已转机会", "已关闭"];

function scoreClass(score: number) {
  return score >= 70 ? "high" : score >= 40 ? "medium" : "low";
}

function AdminHeader({ title, description, query, onQuery }: { title: string; description: string; query: string; onQuery: (value: string) => void }) {
  return (
    <header className="admin-header">
      <div><span>JOYNEXT OPERATIONS</span><h1>{title}</h1><p>{description}</p></div>
      <div className="admin-header-actions">
        <label><span>⌕</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索客户、产品或编号…" /></label>
        <button className="admin-notice">♢<i>3</i></button>
        <div className="admin-user"><span>管</span><p><b>运营管理员</b><small>机器人业务组</small></p></div>
      </div>
    </header>
  );
}

function Overview({ leads, onOpenLead }: { leads: Lead[]; onOpenLead: () => void }) {
  const active = leads.filter((lead) => !["已关闭", "已转机会"].includes(lead.status));
  const high = active.filter((lead) => lead.score >= 70);
  const opportunities = leads.filter((lead) => lead.status === "已转机会");
  const standardOrders = leads.filter((lead) => lead.source === "标准订单");
  const pipeline = statusOptions.map((status) => ({ status, count: leads.filter((lead) => lead.status === status).length }));
  const maxCount = Math.max(1, ...pipeline.map((item) => item.count));

  return (
    <div className="admin-module">
      <section className="admin-kpis">
        <article><span>活跃线索</span><strong>{active.length}</strong><small><b>↑ 18%</b> 较上周</small><i className="blue">◎</i></article>
        <article><span>高潜客户</span><strong>{high.length}</strong><small><b>↑ 23%</b> 评分 ≥ 70</small><i className="green">♙</i></article>
        <article><span>标准订单</span><strong>{standardOrders.length}</strong><small>待销售确认与履约</small><i className="orange">▣</i></article>
        <article><span>销售机会</span><strong>{opportunities.length}</strong><small>本期目标转化率 25%</small><i className="purple">◆</i></article>
      </section>

      <section className="overview-grid">
        <article className="admin-card funnel-card">
          <div className="card-heading"><div><span>FUNNEL</span><h2>线索转化漏斗</h2></div><button onClick={onOpenLead}>查看全部 →</button></div>
          <div className="funnel-bars">
            {pipeline.map((item) => (
              <div key={item.status}><span>{item.status}</span><i><b style={{ width: `${Math.max(8, item.count / maxCount * 100)}%` }} /></i><strong>{item.count}</strong></div>
            ))}
          </div>
        </article>
        <article className="admin-card priority-card">
          <div className="card-heading"><div><span>PRIORITY</span><h2>需要立即处理</h2></div><em>{high.length} 项</em></div>
          <div className="priority-leads">
            {high.slice(0, 4).map((lead) => (
              <button key={lead.id} onClick={onOpenLead}>
                <span className={`mini-score ${scoreClass(lead.score)}`}>{lead.score}</span>
                <p><b>{lead.company}</b><small>{lead.nextAction}</small></p>
                <i>{lead.createdAt}</i>
              </button>
            ))}
          </div>
        </article>
        <article className="admin-card source-card">
          <div className="card-heading"><div><span>SOURCE</span><h2>需求来源结构</h2></div></div>
          <div className="source-chart">
            <div className="donut" style={{ "--standard": `${standardOrders.length / Math.max(1, leads.length) * 100}%` } as React.CSSProperties}><span><b>{leads.length}</b>总需求</span></div>
            <ul><li><i className="standard" />标准订单 <b>{standardOrders.length}</b></li><li><i className="custom" />定制需求 <b>{leads.length - standardOrders.length}</b></li></ul>
          </div>
        </article>
        <article className="admin-card routing-health">
          <div className="card-heading"><div><span>AUTOMATION</span><h2>业务路由健康度</h2></div><em>运行正常</em></div>
          <div className="health-list">
            <div><span>高分线索自动路由</span><b>100%</b><i><em style={{ width: "100%" }} /></i></div>
            <div><span>2 小时 SLA 覆盖</span><b>92%</b><i><em style={{ width: "92%" }} /></i></div>
            <div><span>客户信息完整率</span><b>84%</b><i><em style={{ width: "84%" }} /></i></div>
          </div>
        </article>
      </section>
    </div>
  );
}

function LeadsModule({ leads, query, onUpdate }: { leads: Lead[]; query: string; onUpdate: (id: string, changes: Partial<Lead>) => void }) {
  const [filter, setFilter] = useState<LeadStatus | "全部">("全部");
  const [selectedId, setSelectedId] = useState(leads[0]?.id ?? "");
  const filtered = leads.filter((lead) => {
    const term = query.toLowerCase();
    return (filter === "全部" || lead.status === filter)
      && (!term || `${lead.company}${lead.product}${lead.id}${lead.contactDetail}`.toLowerCase().includes(term));
  });
  const selected = leads.find((lead) => lead.id === selectedId) ?? filtered[0];

  return (
    <div className="lead-module">
      <section className="admin-card lead-table-card">
        <div className="module-toolbar">
          <div className="filter-pills">
            {(["全部", ...statusOptions] as const).map((status) => <button className={filter === status ? "active" : ""} onClick={() => setFilter(status)} key={status}>{status}<span>{status === "全部" ? leads.length : leads.filter((lead) => lead.status === status).length}</span></button>)}
          </div>
          <button className="export-button">导出报表 ↓</button>
        </div>
        <div className="admin-table lead-admin-table">
          <div className="table-head"><span>客户 / 联系方式</span><span>评分</span><span>产品需求</span><span>来源</span><span>当前状态</span><span>负责人</span></div>
          {filtered.map((lead) => (
            <button className={selected?.id === lead.id ? "table-row selected" : "table-row"} onClick={() => setSelectedId(lead.id)} key={lead.id}>
              <span><b>{lead.company}</b><small>{lead.contactDetail}</small></span>
              <span><i className={`mini-score ${scoreClass(lead.score)}`}>{lead.score}</i><small>{lead.priority}潜</small></span>
              <span><b>{lead.product}</b><small>{lead.quantity}</small></span>
              <span><b>{lead.source}</b><small>{lead.createdAt}</small></span>
              <span><em className="admin-status">{lead.status}</em><small>{lead.stage}</small></span>
              <span><b>{lead.route}</b><small>{lead.target}</small></span>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <aside className="admin-card lead-inspector">
          <div className="inspector-heading"><div><span>{selected.id}</span><h2>{selected.company}</h2><p>{selected.contact} · {selected.country}/{selected.city}</p></div><i className={`big-score ${scoreClass(selected.score)}`}>{selected.score}</i></div>
          <div className="inspector-tags"><span>{selected.companyType}</span><span>{selected.source}</span><span>{selected.priority}优先级</span></div>
          <section><h3>结构化需求摘要</h3><p>{selected.need}</p></section>
          <section className="inspector-product"><img src={selected.productImage} alt="" /><div><small>产品 / 方案</small><b>{selected.product}</b><span>{selected.model} · {selected.quantity}</span></div></section>
          <dl><div><dt>价格参考</dt><dd>{selected.estimatedPrice ?? "待确认"}</dd></div><div><dt>目标时间</dt><dd>{selected.target}</dd></div><div><dt>客户地址</dt><dd>{selected.address}</dd></div></dl>
          <div className="next-action"><span>推荐下一步</span><p>{selected.nextAction}</p></div>
          <label className="status-select"><span>流转状态</span><select value={selected.status} onChange={(event) => onUpdate(selected.id, { status: event.target.value as LeadStatus })}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
          <div className="inspector-actions"><button onClick={() => onUpdate(selected.id, { status: "销售跟进", route: "销售" })}>分配销售</button><button onClick={() => onUpdate(selected.id, { status: "工程评审", route: "工程" })}>分配工程</button><button className="primary" onClick={() => onUpdate(selected.id, { status: "已转机会", route: "销售机会" })}>创建机会</button></div>
        </aside>
      )}
    </div>
  );
}

function CustomersModule({ leads, query }: { leads: Lead[]; query: string }) {
  const customers = useMemo(() => {
    const map = new Map<string, { company: string; type: string; country: string; contacts: Set<string>; records: Lead[]; maxScore: number }>();
    leads.forEach((lead) => {
      const current = map.get(lead.company) ?? { company: lead.company, type: lead.companyType, country: lead.country, contacts: new Set<string>(), records: [], maxScore: 0 };
      current.contacts.add(`${lead.contact} · ${lead.contactDetail}`);
      current.records.push(lead);
      current.maxScore = Math.max(current.maxScore, lead.score);
      map.set(lead.company, current);
    });
    return [...map.values()].filter((customer) => !query || `${customer.company}${customer.country}${customer.type}`.toLowerCase().includes(query.toLowerCase()));
  }, [leads, query]);

  return (
    <div className="admin-module">
      <section className="customer-summary">
        <div><span>客户主体</span><strong>{customers.length}</strong></div><div><span>覆盖国家/地区</span><strong>{new Set(customers.map((item) => item.country)).size}</strong></div><div><span>高价值客户</span><strong>{customers.filter((item) => item.maxScore >= 70).length}</strong></div>
      </section>
      <section className="customer-grid">
        {customers.map((customer) => (
          <article className="admin-card customer-card" key={customer.company}>
            <div className="customer-card-head"><span>{customer.company.slice(0, 1)}</span><p><b>{customer.company}</b><small>{customer.type} · {customer.country}</small></p><i className={`mini-score ${scoreClass(customer.maxScore)}`}>{customer.maxScore}</i></div>
            <dl><div><dt>历史需求</dt><dd>{customer.records.length} 条</dd></div><div><dt>主要产品</dt><dd>{customer.records[0].product}</dd></div><div><dt>当前阶段</dt><dd>{customer.records[0].status}</dd></div></dl>
            <div className="customer-contact">{[...customer.contacts].slice(0, 2).map((contact) => <span key={contact}>{contact}</span>)}</div>
            <button>查看完整客户档案 →</button>
          </article>
        ))}
      </section>
    </div>
  );
}

function ProductsModule({
  products,
  query,
  onUpdate,
  onCreate,
  onReset,
}: {
  products: ManagedProduct[];
  query: string;
  onUpdate: (id: string, changes: Partial<ManagedProduct>) => void;
  onCreate: () => string;
  onReset: () => void;
}) {
  const [filter, setFilter] = useState<ProductLifecycle | "all">("all");
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const filtered = products.filter((product) => {
    const term = query.trim().toLowerCase();
    return (filter === "all" || product.publication.lifecycle === filter)
      && (!term || `${product.name}${product.model}${product.kind}${product.description}`.toLowerCase().includes(term));
  });
  const selected = products.find((product) => product.id === selectedId) ?? filtered[0] ?? products[0];
  const counts = {
    online: products.filter((product) => product.publication.lifecycle === "online").length,
    presale: products.filter((product) => product.publication.lifecycle === "presale").length,
    offline: products.filter((product) => product.publication.lifecycle === "offline").length,
  };

  const updateSelected = (changes: Partial<ManagedProduct>, message = "商品信息已自动保存") => {
    if (!selected) return;
    onUpdate(selected.id, changes);
    setNotice(message);
  };
  const updatePublication = (changes: Partial<ManagedProduct["publication"]>, message?: string) => {
    if (!selected) return;
    updateSelected({ publication: { ...selected.publication, ...changes } }, message);
  };
  const setLifecycle = (lifecycle: ProductLifecycle) => {
    const label = lifecycle === "online" ? "商品已上线" : lifecycle === "offline" ? "商品已临时下线" : "商品已设为预售";
    updatePublication({
      lifecycle,
      offlineReason: lifecycle === "offline" ? selected?.publication.offlineReason || "运营临时下线" : "",
    }, label);
  };

  return (
    <div className="product-ops-module">
      <section className="product-ops-summary">
        <article><span>商品总数</span><strong>{products.length}</strong><small>本地演示商品库</small></article>
        <article><span>销售中</span><strong>{counts.online}</strong><small>客户端可直接询价</small></article>
        <article><span>预售计划</span><strong>{counts.presale}</strong><small>支持定时开启</small></article>
        <article><span>临时下线</span><strong>{counts.offline}</strong><small>客户端立即隐藏</small></article>
      </section>

      <section className="product-ops-toolbar">
        <div className="filter-pills">
          {([
            ["all", "全部"],
            ["online", "销售中"],
            ["presale", "预售"],
            ["offline", "已下线"],
          ] as const).map(([value, label]) => (
            <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>
              {label}<span>{value === "all" ? products.length : counts[value]}</span>
            </button>
          ))}
        </div>
        <div>
          <button className="product-reset-button" onClick={() => { onReset(); setNotice("已恢复初始演示商品"); }}>恢复演示数据</button>
          <button className="product-create-button" onClick={() => { const id = onCreate(); setSelectedId(id); setFilter("all"); setNotice("已创建待配置商品"); }}>＋ 新增商品</button>
        </div>
      </section>

      <div className="product-ops-layout">
        <section className="admin-card product-ops-list">
          <div className="product-list-head"><span>商品</span><span>销售状态</span><span>库存 / 计划</span><span>最近更新</span></div>
          {filtered.map((product) => {
            const publication = formatPublicationState(product);
            return (
              <button className={selected?.id === product.id ? "product-list-row selected" : "product-list-row"} onClick={() => { setSelectedId(product.id); setNotice(""); }} key={product.id}>
                <span className="product-list-main"><img src={withBasePath(product.image)} alt="" /><span><b>{product.name}</b><small>{product.model} · {product.kind}</small></span></span>
                <span><em className={`publication-pill ${publication.state}`}>{publication.label}</em><small>{product.publication.storefrontBadge || "无前台标签"}</small></span>
                <span><b>{publication.detail}</b><small>{product.publication.expectedDelivery || product.lead}</small></span>
                <span><b>{product.publication.updatedAt}</b><small>运营管理员</small></span>
              </button>
            );
          })}
          {!filtered.length && <div className="product-list-empty">当前筛选下没有商品。</div>}
        </section>

        {selected && (
          <aside className="admin-card product-editor">
            <div className="product-editor-heading">
              <div><span>PRODUCT EDITOR</span><h2>商品信息与销售设置</h2><p>演示修改自动保存，客户端刷新后生效。</p></div>
              <a href={basePath || "/"} target="_blank" rel="noreferrer">预览前台 ↗</a>
            </div>
            {notice && <div className="product-save-notice"><i />{notice}<button onClick={() => setNotice("")}>×</button></div>}
            <div className="product-editor-preview">
              <img src={withBasePath(selected.image)} alt="" />
              <div><small>{selected.kind}</small><strong>{selected.name}</strong><span>{selected.model}</span></div>
              <em className={`publication-pill ${formatPublicationState(selected).state}`}>{formatPublicationState(selected).label}</em>
            </div>

            <section className="editor-section">
              <div className="editor-section-title"><span>01</span><div><h3>基础商品信息</h3><p>用于客户端产品卡片、搜索和询价摘要。</p></div></div>
              <div className="editor-form-grid">
                <label><span>商品名称</span><input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
                <label><span>产品型号</span><input value={selected.model} onChange={(event) => updateSelected({ model: event.target.value })} /></label>
                <label><span>商品分类</span><select value={selected.kind} onChange={(event) => updateSelected({ kind: event.target.value })}><option>计算与控制</option><option>3D 感知</option><option>环境感知</option><option>运动感知</option></select></label>
                <label><span>价格展示</span><input value={selected.price} onChange={(event) => updateSelected({ price: event.target.value })} placeholder="如 ¥3,500–¥5,800 / 件" /></label>
                <label><span>供货说明</span><input value={selected.lead} onChange={(event) => updateSelected({ lead: event.target.value })} placeholder="库存与交期需确认" /></label>
                <label className="wide"><span>商品图片路径</span><input value={selected.image} onChange={(event) => updateSelected({ image: event.target.value })} placeholder="/products/example.webp" /></label>
                <label className="wide"><span>产品简介</span><textarea value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} /></label>
                <label className="wide"><span>关键参数（每行一项）</span><textarea value={selected.verified.join("\n")} onChange={(event) => updateSelected({ verified: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} /></label>
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-title"><span>02</span><div><h3>销售状态</h3><p>控制客户端是否可见以及当前购买方式。</p></div></div>
              <div className="lifecycle-actions">
                <button className={selected.publication.lifecycle === "online" ? "active online" : ""} onClick={() => setLifecycle("online")}><i>●</i><span><b>立即上线</b><small>前台展示并接受询价</small></span></button>
                <button className={selected.publication.lifecycle === "presale" ? "active presale" : ""} onClick={() => setLifecycle("presale")}><i>◷</i><span><b>定时预售</b><small>展示预售日期与交付计划</small></span></button>
                <button className={selected.publication.lifecycle === "offline" ? "active offline" : ""} onClick={() => setLifecycle("offline")}><i>—</i><span><b>临时下线</b><small>前台立即隐藏，数据保留</small></span></button>
              </div>
              <div className="editor-form-grid publication-fields">
                <label><span>前台运营标签</span><input value={selected.publication.storefrontBadge} onChange={(event) => updatePublication({ storefrontBadge: event.target.value })} placeholder="重点推荐 / 新品预售" /></label>
                <label><span>库存与供货提示</span><input value={selected.publication.stockStatus} onChange={(event) => updatePublication({ stockStatus: event.target.value })} /></label>
                {selected.publication.lifecycle === "presale" && <>
                  <label><span>预售开启时间</span><input type="datetime-local" value={selected.publication.presaleStartAt} onChange={(event) => updatePublication({ presaleStartAt: event.target.value })} /></label>
                  <label><span>预计交付</span><input value={selected.publication.expectedDelivery} onChange={(event) => updatePublication({ expectedDelivery: event.target.value })} placeholder="预计 9 月起分批交付" /></label>
                </>}
                {selected.publication.lifecycle === "offline" && <label className="wide"><span>下线原因（仅管理端）</span><input value={selected.publication.offlineReason} onChange={(event) => updatePublication({ offlineReason: event.target.value })} /></label>}
              </div>
            </section>

            <div className="editor-result">
              <span>当前前台效果</span>
              <b>{formatPublicationState(selected).label} · {selected.publication.storefrontBadge || "常规商品"}</b>
              <p>{selected.publication.lifecycle === "offline"
                ? "该商品不会出现在客户端目录、选型推荐和采购配置中。"
                : `${formatPublicationState(selected).detail}。${selected.publication.expectedDelivery || "最终库存、价格与交期由销售确认。"}`}</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function OrdersModule({ leads, query, onUpdate }: { leads: Lead[]; query: string; onUpdate: (id: string, changes: Partial<Lead>) => void }) {
  const orders = leads.filter((lead) => lead.source === "标准订单" && (!query || `${lead.company}${lead.product}${lead.id}`.toLowerCase().includes(query.toLowerCase())));
  return (
    <section className="admin-card orders-card">
      <div className="card-heading"><div><span>STANDARD ORDERS</span><h2>标准订单与履约</h2></div><button>批量导出 ↓</button></div>
      <div className="orders-table">
        <div className="orders-head"><span>订单号</span><span>客户</span><span>产品</span><span>数量</span><span>金额参考</span><span>状态</span><span>操作</span></div>
        {orders.map((order) => (
          <div className="order-row" key={order.id}>
            <span><b>{order.id}</b><small>{order.createdAt}</small></span><span><b>{order.company}</b><small>{order.country}</small></span>
            <span><b>{order.product}</b><small>{order.model}</small></span><span><b>{order.quantity}</b><small>{order.target}</small></span>
            <span><b>{order.estimatedPrice}</b><small>最终以报价单为准</small></span><span><em className="admin-status">{order.status}</em><small>{order.route}</small></span>
            <span><button onClick={() => onUpdate(order.id, { status: "销售跟进", nextAction: "销售确认订单价格、库存和交付日期。" })}>确认订单</button></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TasksModule({ leads, query, onUpdate }: { leads: Lead[]; query: string; onUpdate: (id: string, changes: Partial<Lead>) => void }) {
  const tasks = leads.filter((lead) => !["已关闭", "已转机会"].includes(lead.status) && (!query || `${lead.company}${lead.nextAction}`.toLowerCase().includes(query.toLowerCase())));
  return (
    <div className="tasks-layout">
      <section className="task-column">
        <div className="task-column-title"><h2>今日待办</h2><span>{tasks.filter((lead) => lead.priority === "高").length} 项紧急</span></div>
        {tasks.map((lead, index) => (
          <article className="admin-card task-card" key={lead.id}>
            <button className="task-check" onClick={() => onUpdate(lead.id, { status: "销售跟进", nextAction: "已完成首次联系，等待客户补充信息。" })}>✓</button>
            <div><span>{lead.route} · {lead.id}</span><h3>{lead.nextAction}</h3><p>{lead.company} · {lead.product}</p><small>{index < 2 ? "今天 14:00 前" : "今天下班前"} · 负责人：{lead.route}</small></div>
            <i className={`task-priority ${lead.priority}`}>{lead.priority}</i>
          </article>
        ))}
      </section>
      <aside className="admin-card task-calendar">
        <div className="card-heading"><div><span>SLA</span><h2>响应时效</h2></div></div>
        <strong>{tasks.filter((lead) => lead.score >= 70).length}</strong><p>条高潜线索正在计时</p>
        <div className="sla-ring"><span>92%<small>按时响应</small></span></div>
        <ul><li><i className="green" />正常 <b>{Math.max(0, tasks.length - 2)}</b></li><li><i className="orange" />即将到期 <b>2</b></li><li><i className="red" />已超时 <b>0</b></li></ul>
      </aside>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>(demoLeads);
  const [managedProducts, setManagedProducts] = useState<ManagedProduct[]>(createDefaultManagedProducts);
  const [ready, setReady] = useState(false);
  const [productsReady, setProductsReady] = useState(false);

  useEffect(() => {
    const restoreTab = window.setTimeout(() => {
      const requested = window.location.hash.replace("#", "") as AdminTab;
      if (tabMeta.some((item) => item.id === requested)) setTab(requested);
    }, 0);
    return () => window.clearTimeout(restoreTab);
  }, []);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("joynext-demo-leads");
        if (saved) {
          const parsed = JSON.parse(saved) as Lead[];
          if (Array.isArray(parsed) && parsed.length) setLeads(parsed);
        }
      } catch {
        // Invalid or unavailable local demo data falls back to the built-in queue.
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem("joynext-demo-leads", JSON.stringify(leads));
  }, [leads, ready]);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const saved = parseManagedProducts(window.localStorage.getItem(PRODUCT_OPERATIONS_STORAGE_KEY));
      if (saved) setManagedProducts(saved);
      setProductsReady(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (productsReady) window.localStorage.setItem(PRODUCT_OPERATIONS_STORAGE_KEY, JSON.stringify(managedProducts));
  }, [managedProducts, productsReady]);

  const updateLead = (id: string, changes: Partial<Lead>) => {
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, ...changes } : lead));
  };
  const updateProduct = (id: string, changes: Partial<ManagedProduct>) => {
    setManagedProducts((current) => current.map((product) => product.id === id ? {
      ...product,
      ...changes,
      publication: {
        ...product.publication,
        ...(changes.publication ?? {}),
        updatedAt: "刚刚",
      },
    } : product));
  };
  const createProduct = () => {
    const template = createDefaultManagedProducts()[0];
    const id = `demo-product-${managedProducts.length + 1}`;
    const product: ManagedProduct = {
      ...template,
      id,
      name: "待配置机器人元器件",
      model: "NEW-MODEL",
      price: "价格待确认",
      description: "请补充产品用途、核心能力和适用客户场景。",
      verified: ["待补充关键参数"],
      sourceSlide: 0,
      publication: {
        ...template.publication,
        lifecycle: "offline",
        storefrontBadge: "新品",
        stockStatus: "待配置",
        offlineReason: "商品资料尚未配置完成",
        updatedAt: "刚刚",
      },
    };
    setManagedProducts((current) => [...current, product]);
    return id;
  };
  const resetProducts = () => setManagedProducts(createDefaultManagedProducts());
  const current = tabMeta.find((item) => item.id === tab) ?? tabMeta[0];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/"><img src={withBasePath("/assets/brand/joynext-logo-dark.png")} alt="JOYNEXT 均联智行" /></Link>
        <div className="admin-portal-label"><span>ADMIN PORTAL</span><small>数字化销售运营中心</small></div>
        <nav>
          {tabMeta.map((item) => <button className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setQuery(""); window.history.replaceState(null, "", `#${item.id}`); }} key={item.id}><i>{item.icon}</i><span><b>{item.label}</b><small>{item.note}</small></span>{item.id === "leads" && <em>{leads.filter((lead) => lead.status === "新线索").length}</em>}</button>)}
        </nav>
        <div className="admin-side-bottom"><Link href="/">← 返回客户端网站</Link><p><span className="live-dot" />系统运行正常<small>演示数据本地持久化</small></p></div>
      </aside>
      <div className="admin-content">
        <AdminHeader title={current.label} description={current.note} query={query} onQuery={setQuery} />
        {tab === "overview" && <Overview leads={leads} onOpenLead={() => setTab("leads")} />}
        {tab === "products" && <ProductsModule products={managedProducts} query={query} onUpdate={updateProduct} onCreate={createProduct} onReset={resetProducts} />}
        {tab === "leads" && <LeadsModule leads={leads} query={query} onUpdate={updateLead} />}
        {tab === "customers" && <CustomersModule leads={leads} query={query} />}
        {tab === "orders" && <OrdersModule leads={leads} query={query} onUpdate={updateLead} />}
        {tab === "tasks" && <TasksModule leads={leads} query={query} onUpdate={updateLead} />}
      </div>
    </div>
  );
}
