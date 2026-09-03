const assert = require("node:assert/strict");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

async function request(pathname, options) {
  return fetch(`${baseUrl}${pathname}`, { redirect: "manual", ...options });
}

async function main() {
  const home = await request("/");
  assert.equal(home.status, 200);
  assert.match(await home.text(), /css\/tailwind\.min\.css/);
  assert.match(home.headers.get("content-security-policy") || "", /default-src 'self'/);
  assert.equal(home.headers.get("x-powered-by"), null);
  assert.match(home.headers.get("link") || "", /rel="canonical"/);

  const health = await request("/healthz");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const admin = await request("/admin.html");
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.get("location"), "/admin-login.html");
  assert.match(admin.headers.get("x-robots-tag") || "", /noindex/);

  assert.equal((await request("/HTML/admin.html")).status, 404);
  assert.equal((await request("/backend/env.example")).status, 404);
  assert.equal((await request("/picture/logo-transparent.webp")).status, 200);
  assert.equal((await request("/css/fonts.css")).status, 200);
  assert.equal((await request("/fonts/lora-vietnamese-600-normal.woff2")).status, 200);
  assert.equal((await request("/robots.txt")).status, 200);
  assert.equal((await request("/sitemap.xml")).status, 200);
  assert.equal((await request("/api/legal-documents")).status, 200);
  assert.equal((await request("/api/admin/me")).status, 401);
  assert.equal((await request("/api/leads")).status, 401);

  const invalidContact = await request("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(invalidContact.status, 400);

  console.log("HTTP smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
