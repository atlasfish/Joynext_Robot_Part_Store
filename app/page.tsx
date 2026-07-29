"use client";

import { FormEvent, useMemo, useState } from "react";

type View = "home" | "standard" | "custom" | "success";
type Product = {
  id: string;
  name: string;
  model: string;
  kind: string;
  image: string;
  price: string;
  lead: string;
  verified: string[];
  description: string;
};

const products: Product[] = [
  {
    id: "controller",
    name: "机器人域控制器",
    model: "nRB-H1",
    kind: "计算与控制",
    image: "/products/domain-controller.png",
    price: "价格待确认",
    lead: "工程样件 · 需确认",
    verified: ["最高 2,070 TOPS", "24–48 V DC", "控制周期 ≤ 1 ms", "最多 4 × EtherCAT"],
    description: "面向人形、协作机器人与 AMR 的脑—小脑融合计算平台。",
  },
  {
    id: "fisheye",
    name: "车规级鱼眼相机",
    model: "FSC-210",
    kind: "环境感知",
    image: "/products/fisheye-camera.webp",
    price: "¥2,680 起",
    lead: "7–10 个工作日",
    verified: ["1920 × 1536", "H 210° / V 170°", "最大 140 dB HDR", "前 IP69 / 后 IP67"],
    description: "超广角全场景感知，适用于盲区监测、视觉 SLAM 与安全防护。",
  },
  {
    id: "depth",
    name: "双目深度相机",
    model: "DPC-48-XM-A1",
    kind: "3D 感知",
    image: "/products/depth-camera.webp",
    price: "¥4,980 起",
    lead: "10–15 个工作日",
    verified: ["48 mm 基线", "0.2–5 m", "1080 × 720 深度", "USB-C 接口"],
    description: "融合深度、RGB 与 IMU，支持 SLAM、三维重建和并行感知任务。",
  },
  {
    id: "imu",
    name: "高可靠 IMU 模组",
    model: "IMU-MCU-01",
    kind: "运动感知",
    image: "/products/imu-module.webp",
    price: "¥1,280 起",
    lead: "5–7 个工作日",
    verified: ["陶瓷封装", "UART / RS485", "可选 EtherCAT", "多精度等级"],
    description: "面向动态机器人姿态、平衡与运动反馈的微型惯性测量模组。",
  },
];

const scenarios = [
  { icon: "◫", name: "AMR / AGV", note: "导航、定位与多传感器融合", image: "/scenes/amr-warehouse.jpeg" },
  { icon: "⌁", name: "人形机器人", note: "感知、规划与硬实时伺服控制", image: "/scenes/humanoid.png" },
  { icon: "⌖", name: "机械臂", note: "高精度定位、视觉与末端感知", image: "/products/depth-camera.webp" },
];

function Logo() {
  return (
    <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="回到页面顶部">
      <span className="brand-mark"><i /><i /><i /><i /></span>
      <span><b>JOYNEXT</b><small>Robotics Components</small></span>
    </button>
  );
}

function Header({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <header className="site-header">
      <Logo />
      <nav aria-label="主导航">
        <a href="#products">产品中心</a>
        <a href="#scenarios">机器人场景</a>
        <a href="#workflow">选型流程</a>
        <a href="#support">技术支持</a>
      </nav>
      <div className="header-actions">
        <button className="text-button">中 / EN</button>
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

function Home({ onNavigate, onSelect }: { onNavigate: (v: View) => void; onSelect: (p: Product) => void }) {
  const [query, setQuery] = useState("");
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
            </div>
          </div>
          <div className="hero-visual">
            <img src="/scenes/amr-warehouse.jpeg" alt="仓储 AMR 机器人场景" />
            <div className="hero-overlay">
              <span className="live-dot" /> 场景方案已上线
              <strong>AMR 多传感器感知套件</strong>
              <button onClick={() => onNavigate("standard")}>查看推荐配置 →</button>
            </div>
            <div className="floating-stat stat-one"><b>4</b><span>类真实产品</span></div>
            <div className="floating-stat stat-two"><b>2</b><span>条成交路径</span></div>
          </div>
        </div>
      </section>

      <main>
        <section className="path-section" id="workflow">
          <div className="section-heading center">
            <span>START HERE</span>
            <h2>你现在要解决哪类需求？</h2>
            <p>系统根据需求复杂度自动进入标准选型或工程定制流程。</p>
          </div>
          <div className="path-grid">
            <article className="path-card standard">
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
              <button className="scenario-card" key={scenario.name} onClick={() => onNavigate("standard")}>
                <img src={scenario.image} alt="" />
                <div><span>{scenario.icon}</span><h3>{scenario.name}</h3><p>{scenario.note}</p><b>进入场景 →</b></div>
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
              <article className="product-card" key={product.id}>
                <div className="product-image"><span>{product.kind}</span><img src={product.image} alt={product.name} /></div>
                <div className="product-body">
                  <small>{product.model}</small>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="spec-chips">{product.verified.slice(0, 2).map((s) => <span key={s}>✓ {s}</span>)}</div>
                  <div className="product-foot"><strong>{product.price}</strong><button onClick={() => { onSelect(product); onNavigate("standard"); }}>查看配置 →</button></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ai-strip" id="support">
          <div><span className="ai-orb">AI</span><div><small>AI 参数助手</small><h2>解释参数，也知道何时需要工程师确认</h2><p>基于已提供资料生成解释；系统级兼容、安全和最终设计决策会转交工程师。</p></div></div>
          <button className="light-button" onClick={() => onNavigate("standard")}>体验 AI 辅助选型 ✦</button>
        </section>
      </main>
    </>
  );
}

function ProductList({ selected, onSelect }: { selected: Product; onSelect: (p: Product) => void }) {
  return (
    <div className="selection-grid">
      {products.map((product) => (
        <button className={product.id === selected.id ? "select-card selected" : "select-card"} onClick={() => onSelect(product)} key={product.id}>
          <div className="select-image"><img src={product.image} alt="" /><span>{product.kind}</span></div>
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
}: {
  selected: Product;
  onSelect: (p: Product) => void;
  onHome: () => void;
  onCustom: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const [qty, setQty] = useState(1);
  const [protocol, setProtocol] = useState(selected.id === "controller" ? "EtherCAT" : "USB-C");
  const engineering = selected.id === "controller";
  const total = selected.id === "fisheye" ? 2680 * qty : selected.id === "depth" ? 4980 * qty : selected.id === "imu" ? 1280 * qty : 0;

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
          <ProductList selected={selected} onSelect={onSelect} />
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
                <label><span>通信接口 *</span><select value={protocol} onChange={(e) => setProtocol(e.target.value)}><option>EtherCAT</option><option>USB-C</option><option>RS485</option><option>CAN FD</option></select></label>
                <label><span>数量 *</span><div className="quantity"><button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><input value={qty} readOnly /><button onClick={() => setQty(qty + 1)}>＋</button></div></label>
                <label><span>使用环境 *</span><select><option>室内常温</option><option>仓储 / 轻工业</option><option>户外 / 高防护</option></select></label>
                <label><span>计划交付</span><select><option>尽快</option><option>1 个月内</option><option>3 个月内</option></select></label>
              </div>
            </div>
            <div className={engineering ? "engineer-warning" : "ai-explanation"}>
              <span>{engineering ? "!" : "AI"}</span>
              <div>
                <h3>{engineering ? "需要工程师确认" : "AI 配置解释"}</h3>
                <p>{engineering
                  ? "nRB-H1 当前处于初步工程状态，散热、功耗、机械安装和 EtherCAT 组合需按整机方案复核。"
                  : `${protocol} 与当前产品资料中的接口能力匹配。${qty > 10 ? "数量超过 10 件，系统将自动提醒销售确认批量交期。" : "当前数量可进入标准订单流程。"}`}</p>
                {engineering && <button onClick={onCustom}>转为定制需求，与工程师联合评估 →</button>}
              </div>
            </div>
          </div>
          <aside className="order-summary">
            <span className="summary-label">配置摘要</span>
            <img src={selected.image} alt="" />
            <small>{selected.model}</small>
            <h2>{selected.name}</h2>
            <dl><div><dt>接口</dt><dd>{protocol}</dd></div><div><dt>数量</dt><dd>{qty} 件</dd></div><div><dt>交期</dt><dd>{selected.lead}</dd></div></dl>
            <div className="price-row"><span>预估金额</span><strong>{total ? `¥${total.toLocaleString()}` : "工程确认后报价"}</strong></div>
            <p className="small-note">价格与交期为原型演示信息，最终以正式订单或报价单为准。</p>
            <button className="primary-button full" disabled={engineering} onClick={() => setStep(3)}>提交订单 →</button>
            {engineering && <button className="outline-button full" onClick={onCustom}>提交询价需求</button>}
          </aside>
        </section>
      )}
      {step === 3 && (
        <section className="confirmation">
          <div className="success-mark">✓</div>
          <span>ORDER CREATED</span>
          <h1>标准件订单已生成</h1>
          <p>订单号 <b>JN-20260729-{String(selected.id.length * 317).padStart(4, "0")}</b>，销售部门已收到结构化摘要。</p>
          <div className="confirmation-card">
            <div><small>产品</small><strong>{selected.model} · {selected.name}</strong></div>
            <div><small>数量</small><strong>{qty} 件</strong></div>
            <div><small>接口</small><strong>{protocol}</strong></div>
            <div><small>预计发货</small><strong>{selected.lead}</strong></div>
          </div>
          <div className="sales-timeline"><div className="done"><span>✓</span><b>订单提交</b></div><i /><div className="active"><span>2</span><b>销售确认</b></div><i /><div><span>3</span><b>备货发出</b></div></div>
          <button className="primary-button" onClick={onComplete}>返回首页</button>
        </section>
      )}
    </main>
  );
}

function CustomFlow({ onHome, onComplete }: { onHome: () => void; onComplete: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [priority, setPriority] = useState("常规");
  const [form, setForm] = useState({ project: "", company: "", contact: "", phone: "", scene: "人形机器人", volume: "", need: "" });
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });

  if (submitted) {
    return (
      <main className="flow-shell">
        <div className="flow-bar"><button className="back-button" onClick={onHome}>← 返回产品中心</button><Progress step={3} custom /><span className="service-badge"><i /> 已分配销售</span></div>
        <section className="confirmation custom-confirmation">
          <div className="success-mark">✓</div><span>CUSTOM REQUEST RECEIVED</span><h1>定制需求已提交</h1>
          <p>需求单号 <b>CR-20260729-086</b>，系统评分 <b>82 / 100</b>，已分流至机器人业务销售与系统工程师。</p>
          <div className="lead-summary">
            <div><small>负责人</small><strong>机器人业务销售组</strong><span>预计 2 小时内首次联系</span></div>
            <div><small>技术协同</small><strong>域控制器与感知团队</strong><span>工程师已收到结构化摘要</span></div>
            <div><small>约定单据</small><strong>报价单 + 初步工期单</strong><span>2 个工作日内生成</span></div>
          </div>
          <div className="summary-document">
            <div><span>AI 结构化摘要</span><b>已发送给销售与技术人员</b></div>
            <p>{form.company || "客户"}计划在{form.scene}场景中推进“{form.project || "未命名项目"}”，预计需求量 {form.volume || "待确认"}。核心需求：{form.need || "待销售进一步澄清"}。</p>
          </div>
          <button className="primary-button" onClick={onComplete}>完成并返回首页</button>
        </section>
      </main>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="flow-shell">
      <div className="flow-bar"><button className="back-button" onClick={onHome}>← 返回产品中心</button><Progress step={2} custom /><span className="service-badge"><i /> 销售在线</span></div>
      <section className="custom-layout">
        <div className="custom-main">
          <div className="flow-title"><span>CUSTOM SOLUTION PATH</span><h1>提交定制需求</h1><p>用业务语言描述任务即可。系统会整理成销售与技术人员可直接处理的结构化摘要。</p></div>
          <form className="custom-form" onSubmit={submit}>
            <div className="form-section">
              <div className="form-section-title"><span>01</span><div><h2>项目与场景</h2><p>帮助我们判断对应的销售与工程团队。</p></div></div>
              <div className="form-grid">
                <label><span>项目名称 *</span><input required value={form.project} onChange={(e) => update("project", e.target.value)} placeholder="例如：仓储 AMR 视觉升级" /></label>
                <label><span>机器人场景 *</span><select value={form.scene} onChange={(e) => update("scene", e.target.value)}><option>人形机器人</option><option>AMR / AGV</option><option>协作机械臂</option><option>服务机器人</option><option>其他</option></select></label>
                <label className="full-field"><span>需求描述 *</span><textarea required value={form.need} onChange={(e) => update("need", e.target.value)} placeholder="请描述任务目标、已有平台、关键指标、接口、安装空间、环境约束和期望交付时间…" /></label>
              </div>
            </div>
            <div className="form-section">
              <div className="form-section-title"><span>02</span><div><h2>商务与联系信息</h2><p>用于生成报价、工期评估和后续沟通。</p></div></div>
              <div className="form-grid">
                <label><span>公司名称 *</span><input required value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="公司全称" /></label>
                <label><span>预计年用量</span><input value={form.volume} onChange={(e) => update("volume", e.target.value)} placeholder="例如：100–500 套 / 年" /></label>
                <label><span>联系人 *</span><input required value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder="姓名" /></label>
                <label><span>手机 / 邮箱 *</span><input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="便于销售联系" /></label>
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
          <div className="sales-card"><span className="live-dot" /><small>SALES ONLINE</small><h3>提交后立即进入销售队列</h3><p>系统会根据场景、年用量、项目阶段和技术复杂度评分分流。</p><div className="avatar-row"><i>销</i><i>技</i><span>销售 + 工程师联合响应</span></div></div>
          <div className="next-card"><h3>接下来会发生什么</h3>{[["1", "需求入队", "即时生成结构化摘要"], ["2", "销售首联", "预计 2 小时内"], ["3", "工程评估", "确认接口、风险与边界"], ["4", "单据生成", "2 个工作日内给出报价与工期"]].map(([n, h, p]) => <div key={n}><span>{n}</span><p><b>{h}</b><small>{p}</small></p></div>)}</div>
          <div className="trust-card"><h3>资料边界</h3><p>AI 只整理和解释已提供资料。系统兼容、安全、法规与最终设计结论必须由工程师确认。</p></div>
        </aside>
      </section>
    </main>
  );
}

function Footer() {
  return (
    <footer>
      <Logo />
      <p>JOYNEXT Robotics Components · 从场景到选型，从需求到成交。</p>
      <div><a href="#products">产品</a><a href="#scenarios">场景</a><a href="#support">支持</a><span>© 2026 JOYNEXT Prototype</span></div>
    </footer>
  );
}

export default function HomePage() {
  const [view, setView] = useState<View>("home");
  const [selected, setSelected] = useState(products[1]);

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <Header onNavigate={navigate} />
      {view === "home" && <Home onNavigate={navigate} onSelect={setSelected} />}
      {view === "standard" && <StandardFlow selected={selected} onSelect={setSelected} onHome={() => navigate("home")} onCustom={() => navigate("custom")} onComplete={() => navigate("home")} />}
      {view === "custom" && <CustomFlow onHome={() => navigate("home")} onComplete={() => navigate("home")} />}
      {view === "home" && <Footer />}
    </div>
  );
}
