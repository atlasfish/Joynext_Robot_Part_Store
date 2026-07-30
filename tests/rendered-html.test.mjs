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
  assert.match(html, /查看配置并提交采购意向/);
  assert.match(html, /JOYNEXT AI 选型助理/);
  assert.match(html, /从需求出发/);
  assert.match(html, /找到符合采购条件的候选产品/);
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
});
