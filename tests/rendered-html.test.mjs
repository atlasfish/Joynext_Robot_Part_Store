import assert from "node:assert/strict";
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
  assert.match(html, /不确定具体型号/);
  assert.match(html, /按您的应用条件，筛选合适的产品/);
  assert.match(html, /查看配置并提交采购意向/);
  assert.match(html, /JOYNEXT AI 选型助理/);
  assert.match(html, /从需求出发/);
  assert.match(html, /找到符合采购条件的候选产品/);
  assert.match(html, /提交采购意向/);
  assert.match(html, /切换为英文/);
  assert.doesNotMatch(html, /选型 Copilot 持续在线/);
  assert.doesNotMatch(html, /标准件订单已生成/);
  assert.doesNotMatch(html, /sk-[A-Za-z0-9_-]{20,}/);
});
