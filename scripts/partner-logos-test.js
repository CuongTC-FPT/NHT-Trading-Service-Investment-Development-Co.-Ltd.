const assert = require("node:assert/strict");
const express = require("../backend/node_modules/express");
const cloudinary = require("../backend/node_modules/cloudinary").v2;
const createRoutes = require("../backend/routes/partner-logos-routes");

async function main() {
  Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" });
  cloudinary.config({ cloud_name: "test-cloud", secure: true });
  let calls = 0;
  const original = cloudinary.api.resources_by_tag;
  cloudinary.api.resources_by_tag = async (tag, options) => {
    calls++;
    assert.equal(tag, "logo-contact");
    await new Promise((resolve) => setTimeout(resolve, 15));
    return options.next_cursor
      ? { resources: [{ public_id: "01-first", type: "upload", version: 2, context: { custom: { alt: "First company" } } }] }
      : { resources: [{ public_id: "02-second", type: "upload", version: 1 }], next_cursor: "page2" };
  };
  const app = express();
  app.use("/api", createRoutes());
  app.use("/empty", createRoutes());
  app.use("/unavailable", createRoutes());
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/partner-logos`;
  try {
    delete process.env.CLOUDINARY_LOGO_TAG;
    assert.deepEqual(await (await fetch(url)).json(), { source: "local", logos: [] });
    assert.equal(calls, 0);
    process.env.CLOUDINARY_LOGO_TAG = "logo-contact";
    const responses = await Promise.all(Array.from({ length: 5 }, () => fetch(url)));
    const lists = await Promise.all(responses.map((response) => response.json()));
    assert.equal(calls, 2, "Concurrent page requests must share one paginated lookup");
    assert.equal(lists[0].source, "cloudinary");
    assert.equal(lists[0].logos[0].name, "First company");
    assert.match(lists[0].logos[0].url, /^https:\/\/res\.cloudinary\.com\/test-cloud\//);
    assert.ok(!JSON.stringify(lists).includes("test-secret"));
    await fetch(url);
    assert.equal(calls, 2, "Repeated visits must use cached list");
    cloudinary.api.resources_by_tag = async () => ({ resources: [] });
    const base = url.replace("/api/partner-logos", "");
    assert.deepEqual(await (await fetch(`${base}/empty/partner-logos`)).json(), { source: "cloudinary", logos: [] });
    delete process.env.CLOUDINARY_API_SECRET;
    assert.equal((await fetch(`${base}/unavailable/partner-logos`)).status, 503);
    console.log("PASS: local demo, tag lookup, pagination, order, concurrent requests, cache, secret isolation, empty cloud list, missing credentials.");
  } finally {
    cloudinary.api.resources_by_tag = original;
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
