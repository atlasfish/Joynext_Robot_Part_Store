export type ProductConfiguration = {
  key: string;
  label: string;
  options: string[];
  note?: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  model: string;
  kind: string;
  image: string;
  price: string;
  lead: string;
  verified: string[];
  description: string;
  sourceSlide: number;
  status: "资料已确认" | "初步工程状态";
  engineeringReview: boolean;
  configuration: ProductConfiguration[];
  fit: {
    scenes: string[];
    goals: string[];
    reason: string;
  };
};

const sharedDeliveryConfiguration: ProductConfiguration[] = [
  { key: "environment", label: "使用环境 *", options: ["室内常温", "仓储 / 轻工业", "户外 / 高防护"], note: "防护与温度边界需按具体型号复核" },
  { key: "delivery", label: "计划交付 *", options: ["尽快", "1 个月内", "3 个月内", "待销售确认"] },
];

export const productCatalog: CatalogProduct[] = [
  {
    id: "controller-h1",
    name: "机器人域控制器",
    model: "nRB-H1",
    kind: "计算与控制",
    image: "/products/domain-controller.png",
    price: "价格待确认",
    lead: "初步工程状态 · 需评审",
    verified: ["最高 2,070 TOPS", "最高 128 GB LPDDR5X", "控制周期 ≤ 1 ms", "24–48 V DC"],
    description: "面向人形、协作机器人与 AMR 的脑—小脑融合 AI 计算和硬实时控制平台。",
    sourceSlide: 4,
    status: "初步工程状态",
    engineeringReview: true,
    configuration: [
      { key: "compute", label: "SOM 算力平台 *", options: ["单 Jetson AGX Thor · 最高 1,035 TOPS", "双 Jetson AGX Thor · 最高 2,070 TOPS"], note: "最终 SOM 与算力组合需工程确认" },
      { key: "memory", label: "内存 *", options: ["64 GB LPDDR5X", "128 GB LPDDR5X"] },
      { key: "realtime", label: "实时网络 *", options: ["千兆以太网", "最多 4 × EtherCAT", "CAN FD / RS485 组合"], note: "总线数量与实时性需结合整机拓扑评审" },
      { key: "wireless", label: "无线与定位", options: ["不选配", "5G + Wi-Fi 6 + BT 5.3", "5G + Wi-Fi 6 + BT 5.3 + GNSS"] },
      { key: "camera", label: "GMSL2 相机接入", options: ["暂不接入", "1–4 路", "5–8 路", "9–12 路"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["人形机器人", "协作机械臂", "AMR / AGV"],
      goals: ["集中计算与实时控制", "导航与避障"],
      reason: "适合需要高算力、硬实时控制和多传感器/多总线协同的机器人平台",
    },
  },
  {
    id: "controller-m1",
    name: "高性能机器人计算平台",
    model: "nRB-M1",
    kind: "计算与控制",
    image: "/products/domain-controller.png",
    price: "价格待确认",
    lead: "方案与供货状态需确认",
    verified: ["双 Jetson AGX Orin 64G", "550 TOPS", "TC397 安全单元", "16 × GMSL2 / 8 × CAN FD"],
    description: "双 Orin 与 TC397 架构的高可靠计算中心，面向机器人感知、规划与多传感器融合。",
    sourceSlide: 3,
    status: "资料已确认",
    engineeringReview: true,
    configuration: [
      { key: "sensor", label: "传感器接入规模 *", options: ["1–4 路 GMSL2", "5–8 路 GMSL2", "9–16 路 GMSL2"] },
      { key: "network", label: "车载网络 *", options: ["CAN FD", "千兆以太网", "CAN FD + 千兆以太网"] },
      { key: "safety", label: "安全协同", options: ["基础计算方案", "TC397 实时监控与冗余评估"], note: "功能安全结论必须由授权工程师确认" },
      { key: "use", label: "主要计算任务 *", options: ["感知融合", "规划决策", "感知 + 规划并行"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["人形机器人", "AMR / AGV", "协作机械臂"],
      goals: ["集中计算与实时控制", "视觉与三维感知"],
      reason: "适合多路感知输入、集中规划计算和需要安全监控单元的高性能平台",
    },
  },
  {
    id: "fisheye",
    name: "车规级高清鱼眼相机",
    model: "型号需销售确认",
    kind: "环境感知",
    image: "/products/fisheye-camera.webp",
    price: "价格待确认",
    lead: "库存与交期需确认",
    verified: ["1920 × 1536 @ 30 fps", "H 210° ± 5° / V 170° ± 5°", "最大 140 dB HDR", "前 IP69 / 后 IP67"],
    description: "超广角全场景感知，适用于盲区监测、安全防护、视觉 SLAM 与 VIO。",
    sourceSlide: 10,
    status: "资料已确认",
    engineeringReview: false,
    configuration: [
      { key: "calibration", label: "标定需求 *", options: ["支持内参标定", "随整机进行系统标定"] },
      { key: "serializer", label: "串行器 *", options: ["Maxim 96717F", "其他方案需确认"] },
      { key: "harness", label: "相机线束", options: ["不需要", "需要可选线束"] },
      { key: "mount", label: "安装位置 *", options: ["机器人前向", "侧向盲区", "后向 / 环视", "其他位置"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["AMR / AGV", "服务机器人", "人形机器人"],
      goals: ["导航与避障", "视觉与三维感知"],
      reason: "超广角视野和高动态范围适合盲区覆盖、视觉 SLAM 与复杂光照环境感知",
    },
  },
  {
    id: "depth-25",
    name: "近距双目深度相机",
    model: "DPC-25-XM-A2",
    kind: "3D 感知",
    image: "/products/depth-camera.webp",
    price: "价格待确认",
    lead: "库存与交期需确认",
    verified: ["25 mm 基线", "0.05–0.5 m", "RMS ≤ 1% @ 0.5 m", "1080 × 720 @ 30 fps"],
    description: "适合近距离抓取、精细操作和紧凑安装位置的深度、RGB 与 IMU 融合相机。",
    sourceSlide: 11,
    status: "资料已确认",
    engineeringReview: false,
    configuration: [
      { key: "interface", label: "数据与供电接口 *", options: ["USB-C", "GMSL2"] },
      { key: "range", label: "目标工作距离 *", options: ["0.05–0.2 m", "0.2–0.5 m"] },
      { key: "task", label: "主要任务 *", options: ["近距抓取", "精细测量", "局部三维重建", "其他"] },
      { key: "integration", label: "融合方式", options: ["深度数据", "深度 + RGB", "深度 + RGB + IMU"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["协作机械臂", "人形机器人", "服务机器人"],
      goals: ["视觉与三维感知"],
      reason: "25 mm 小基线和 0.05–0.5 m 工作范围更适合近距操作与紧凑安装",
    },
  },
  {
    id: "depth-48",
    name: "中距双目深度相机",
    model: "DPC-48-XM-A1",
    kind: "3D 感知",
    image: "/products/depth-camera.webp",
    price: "价格待确认",
    lead: "库存与交期需确认",
    verified: ["48 mm 基线", "0.2–5 m", "RMS ≤ 2% @ 2 m", "1080 × 720 @ 15 fps"],
    description: "覆盖室内导航、避障、SLAM 与通用三维感知的 USB-C 深度相机。",
    sourceSlide: 11,
    status: "资料已确认",
    engineeringReview: false,
    configuration: [
      { key: "interface", label: "数据与供电接口 *", options: ["USB-C"] },
      { key: "range", label: "目标工作距离 *", options: ["0.2–1 m", "1–3 m", "3–5 m"] },
      { key: "task", label: "主要任务 *", options: ["导航与避障", "SLAM", "三维重建", "人机交互"] },
      { key: "integration", label: "融合方式", options: ["深度数据", "深度 + RGB", "深度 + RGB + IMU"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["AMR / AGV", "协作机械臂", "服务机器人"],
      goals: ["视觉与三维感知", "导航与避障"],
      reason: "0.2–5 m 通用工作范围适合室内导航、空间测量、避障和三维重建",
    },
  },
  {
    id: "depth-100",
    name: "远距双目深度相机",
    model: "DPC-100-XM-A2",
    kind: "3D 感知",
    image: "/products/depth-camera.webp",
    price: "价格待确认",
    lead: "库存与交期需确认",
    verified: ["100 mm 基线", "0.15–5 m", "RMS ≤ 1% @ 2 m", "1080 × 720 @ 30 fps"],
    description: "100 mm 大基线深度相机，适合强调远距精度和稳定传输的机器人感知任务。",
    sourceSlide: 11,
    status: "资料已确认",
    engineeringReview: false,
    configuration: [
      { key: "interface", label: "数据与供电接口 *", options: ["USB-C", "GMSL2"] },
      { key: "range", label: "目标工作距离 *", options: ["0.15–1 m", "1–3 m", "3–5 m"] },
      { key: "task", label: "主要任务 *", options: ["远距避障", "空间测量", "三维重建", "其他"] },
      { key: "integration", label: "融合方式", options: ["深度数据", "深度 + RGB", "深度 + RGB + IMU"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["AMR / AGV", "服务机器人", "协作机械臂"],
      goals: ["视觉与三维感知", "导航与避障"],
      reason: "100 mm 大基线和 30 fps 深度输出适合更强调远距测量精度的感知任务",
    },
  },
  {
    id: "imu-mems",
    name: "微惯性 MEMS 传感器",
    model: "MEMS Sensor",
    kind: "运动感知",
    image: "/products/imu-module.webp",
    price: "价格待确认",
    lead: "规格与交期需确认",
    verified: ["陶瓷封装", "多精度等级", "多形态可选", "面向动态机器人"],
    description: "面向高度集成设计的微惯性传感器形态，具体量程、精度与封装需按项目确认。",
    sourceSlide: 9,
    status: "资料已确认",
    engineeringReview: true,
    configuration: [
      { key: "accuracy", label: "精度等级 *", options: ["低精度", "中精度", "高精度"], note: "具体指标需工程师提供对应规格" },
      { key: "integration", label: "集成形态 *", options: ["MEMS 芯片级集成", "评估模块方案"] },
      { key: "task", label: "运动任务 *", options: ["姿态检测", "平衡控制", "运动反馈", "导航辅助"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["人形机器人", "协作机械臂", "AMR / AGV"],
      goals: ["姿态与平衡"],
      reason: "适合有芯片级集成能力、需要按目标精度定制惯性测量链路的团队",
    },
  },
  {
    id: "imu-no-mcu",
    name: "IMU 模组（无 MCU）",
    model: "IMU Module · without MCU",
    kind: "运动感知",
    image: "/products/imu-module.webp",
    price: "价格待确认",
    lead: "规格与交期需确认",
    verified: ["无 MCU 模组形态", "陶瓷封装传感器", "多精度等级", "抗振动与冲击"],
    description: "适合已有主控与算法链路、希望直接集成惯性传感单元的机器人平台。",
    sourceSlide: 9,
    status: "资料已确认",
    engineeringReview: true,
    configuration: [
      { key: "accuracy", label: "精度等级 *", options: ["低精度", "中精度", "高精度"] },
      { key: "host", label: "已有主控平台 *", options: ["自研控制器", "机器人域控制器", "其他主控"] },
      { key: "task", label: "运动任务 *", options: ["姿态检测", "平衡控制", "运动反馈", "导航辅助"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["人形机器人", "协作机械臂", "AMR / AGV"],
      goals: ["姿态与平衡", "导航与避障"],
      reason: "适合已有主控和信号处理能力、需要灵活集成惯性测量单元的机器人平台",
    },
  },
  {
    id: "imu-mcu",
    name: "IMU 模组（带 MCU）",
    model: "IMU Module · with MCU",
    kind: "运动感知",
    image: "/products/imu-module.webp",
    price: "价格待确认",
    lead: "规格与交期需确认",
    verified: ["带 MCU 模组形态", "UART / RS485", "可选 EtherCAT", "多精度等级"],
    description: "提供姿态与运动反馈的完整 IMU 模组，适合机器人平衡、运动控制和导航辅助。",
    sourceSlide: 9,
    status: "资料已确认",
    engineeringReview: false,
    configuration: [
      { key: "interface", label: "通信接口 *", options: ["UART", "RS485", "EtherCAT（需确认）"] },
      { key: "accuracy", label: "精度等级 *", options: ["低精度", "中精度", "高精度"] },
      { key: "task", label: "运动任务 *", options: ["姿态检测", "平衡控制", "运动反馈", "导航辅助"] },
      { key: "rate", label: "实时反馈侧重 *", options: ["常规姿态反馈", "低延迟 / 高刷新率需求"] },
      ...sharedDeliveryConfiguration,
    ],
    fit: {
      scenes: ["人形机器人", "AMR / AGV", "协作机械臂"],
      goals: ["姿态与平衡", "导航与避障"],
      reason: "具备 MCU 与多种接口选项，适合快速接入姿态、平衡和运动控制闭环",
    },
  },
];

export function catalogKnowledgeText() {
  return productCatalog.map((product) => [
    `产品：${product.name}`,
    `型号：${product.model}`,
    `类别：${product.kind}`,
    `资料状态：${product.status}`,
    `已确认参数：${product.verified.join("；")}`,
    `用途说明：${product.description}`,
    `适用场景：${product.fit.scenes.join("、")}`,
    `适用目标：${product.fit.goals.join("、")}`,
    `可配置项：${product.configuration.map((item) => `${item.label.replace(" *", "")}=[${item.options.join("/")}]${item.note ? `（${item.note}）` : ""}`).join("；")}`,
    `价格与交期：${product.price}；${product.lead}`,
    `工程评审：${product.engineeringReview ? "需要" : "仍需在正式采购前确认最终配置"}`,
    `来源：Joynext robotics product intro 20260729.pptx，第 ${product.sourceSlide} 页`,
  ].join("\n")).join("\n\n");
}
