import { productCatalog, type CatalogProduct } from "./product-catalog";

export const PRODUCT_OPERATIONS_STORAGE_KEY = "joynext-demo-products-v1";

export type ProductLifecycle = "online" | "offline" | "presale";

export type ProductPublication = {
  lifecycle: ProductLifecycle;
  storefrontBadge: string;
  stockStatus: string;
  presaleStartAt: string;
  expectedDelivery: string;
  offlineReason: string;
  updatedAt: string;
};

export type ManagedProduct = CatalogProduct & {
  publication: ProductPublication;
};

const defaultPublication: ProductPublication = {
  lifecycle: "online",
  storefrontBadge: "现货询价",
  stockStatus: "可接受采购意向",
  presaleStartAt: "",
  expectedDelivery: "",
  offlineReason: "",
  updatedAt: "2026-07-30 09:30",
};

const publicationOverrides: Record<string, Partial<ProductPublication>> = {
  "controller-h1": {
    storefrontBadge: "重点推荐",
    stockStatus: "项目制供货 · 交期需确认",
  },
  "controller-m1": {
    stockStatus: "项目制供货 · 交期需确认",
  },
  "depth-100": {
    lifecycle: "presale",
    storefrontBadge: "新品预售",
    stockStatus: "2026-08-15 开启预售",
    presaleStartAt: "2026-08-15T10:00",
    expectedDelivery: "预计 2026 年 9 月起分批交付",
  },
  "imu-mems": {
    lifecycle: "offline",
    storefrontBadge: "",
    stockStatus: "暂不可询价",
    offlineReason: "产品规格页更新中",
  },
};

export function createDefaultManagedProducts(): ManagedProduct[] {
  return productCatalog.map((product) => ({
    ...product,
    publication: {
      ...defaultPublication,
      ...publicationOverrides[product.id],
    },
  }));
}

export function parseManagedProducts(value: string | null): ManagedProduct[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ManagedProduct[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const valid = parsed.filter((product) =>
      product
      && typeof product.id === "string"
      && typeof product.name === "string"
      && typeof product.publication?.lifecycle === "string",
    );
    return valid.length ? valid : null;
  } catch {
    return null;
  }
}

export function formatPublicationState(product: ManagedProduct, now = Date.now()) {
  if (product.publication.lifecycle === "offline") {
    return { state: "offline" as const, label: "已下线", detail: product.publication.offlineReason || "暂不可见" };
  }
  if (product.publication.lifecycle === "presale") {
    const startsAt = product.publication.presaleStartAt
      ? new Date(product.publication.presaleStartAt).getTime()
      : 0;
    const scheduled = Number.isFinite(startsAt) && startsAt > now;
    return {
      state: scheduled ? "scheduled" as const : "presale" as const,
      label: scheduled ? "定时预售" : "预售中",
      detail: scheduled
        ? `${new Date(startsAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 开启`
        : product.publication.expectedDelivery || "交付时间由销售确认",
    };
  }
  return { state: "online" as const, label: "销售中", detail: product.publication.stockStatus };
}

