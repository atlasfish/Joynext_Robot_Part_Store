import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /不确定具体型号/);
  assert.match(html, /domain-controller-hero\.png/);
  assert.match(html, /按您的应用条件，筛选合适的产品/);
  assert.match(html, /查看配置/);
  assert.match(html, /JOYNEXT AI 选型助理/);
  assert.match(html, /从需求出发/);
  assert.match(html, /按应用场景分类/);
  assert.doesNotMatch(html, /按机器人应用查看产品。/);
  assert.match(html, /候选产品/);
  assert.match(html, /提交采购意向/);
  assert.match(html, /参考单价/);
  assert.match(html, /¥3,500–¥5,800/);
  assert.match(html, /切换为英文/);
  assert.doesNotMatch(html, /选型 Copilot 持续在线/);
  assert.doesNotMatch(html, /标准件订单已生成/);
  assert.doesNotMatch(html, /sk-[A-Za-z0-9_-]{20,}/);
});

test("streams non-thinking Qwen responses and renders Markdown safely", async () => {
  const route = await readFile(new URL("../app/api/assistant/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(route, /qwen3\.7-flash/);
  assert.match(route, /stream:\s*true/);
  assert.match(route, /enable_thinking:\s*false/);
  assert.match(route, /text\/event-stream/);
  assert.match(page, /ReactMarkdown/);
  assert.match(page, /remarkGfm/);
  assert.match(page, /skipHtml/);
  assert.match(page, /采购栏/);
  assert.match(page, /一次提交并生成报单/);
  assert.match(page, /集采报单已生成/);
  assert.match(page, /打印 \/ 保存报单/);
  assert.match(page, /source: procurementItems\.length > 1 \? "集采报单"/);
  assert.match(page, /header-procurement-button/);
  assert.match(page, /function ProcurementDrawer/);
  assert.match(page, /onAddProduct\(product\)/);
  assert.match(page, /待配置/);
  assert.match(page, /product-nav-dropdown/);
  assert.match(page, /contact@joynext\.com/);
  assert.match(page, /tel:\+8657487127249/);
  assert.doesNotMatch(page, /onNavigateSection\("workflow"\)/);
  assert.match(styles, /\.floating-order-button:hover/);
  assert.match(styles, /\.contact-footer/);
});

test("provides demo product publishing operations without a backend", async () => {
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const storefront = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const operations = await readFile(new URL("../lib/product-operations.ts", import.meta.url), "utf8");

  assert.match(admin, /商品运营/);
  assert.match(admin, /立即上线/);
  assert.match(admin, /临时下线/);
  assert.match(admin, /定时预售/);
  assert.match(admin, /新增商品/);
  assert.match(admin, /PRODUCT_OPERATIONS_STORAGE_KEY/);
  assert.match(storefront, /storefrontProducts/);
  assert.match(storefront, /storefront-availability/);
  assert.match(operations, /joynext-demo-products-v1/);
  assert.match(operations, /2026-08-15T10:00/);
});
