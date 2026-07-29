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
  assert.match(html, /选型 Copilot 持续在线/);
  assert.match(html, /先说场景，AI 和你一起缩小选型范围/);
  assert.match(html, /带着上下文继续配置/);
  assert.match(html, /JOYNEXT AI 选型助理/);
  assert.match(html, /让复杂选型/);
  assert.match(html, /只突出此刻有用的信息/);
  assert.match(html, /智能负责提效/);
  assert.doesNotMatch(html, /sk-[A-Za-z0-9_-]{20,}/);
});
