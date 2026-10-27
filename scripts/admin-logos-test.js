const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
const express = require("../backend/node_modules/express");
const cloudinary = require("../backend/node_modules/cloudinary").v2;
const { createAdminSession } = require("../backend/middleware/admin-auth");
const routes = require("../backend/routes/partner-logos-routes");

async function main() {
  Object.assign(process.env, {
    ADMIN_SESSION_SECRET: "admin-logo-test-session-secret", ADMIN_USERNAME: "logo-test-admin",
    CLOUDINARY_CLOUD_NAME: "logo-test", CLOUDINARY_API_KEY: "test", CLOUDINARY_API_SECRET: "test", CLOUDINARY_LOGO_TAG: "logo-contact",
  });
  cloudinary.config({ cloud_name: "logo-test" });
  let resources = [{ public_id: "nht/partner-logos/01-original", type: "upload", version: 1, tags: ["logo-contact"], context: { custom: { alt: "Original" } } }];
  let uploads = 0, deletes = 0, failUpload = false, failDelete = false;
  cloudinary.api.resources_by_tag = async () => ({ resources: [...resources] });
  cloudinary.api.resource = async (id) => {
    const asset = resources.find(item => item.public_id === id);
    if (!asset) throw { http_code: 404 };
    return asset;
  };
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) {
      uploads++;
      if (failUpload) callback(new Error("Upload failed"));
      else {
        const asset = { public_id: options.public_id, type: "upload", version: 1, tags: options.tags, context: { custom: options.context } };
        resources.push(asset); callback(null, asset);
      }
      done();
    },
  });
  cloudinary.uploader.destroy = async (id, options) => {
    if (failDelete) throw new Error("Delete failed");
    assert.equal(options.invalidate, true);
    resources = resources.filter(item => item.public_id !== id); deletes++;
    return { result: "ok" };
  };
  const app = express(); app.use(express.json()); app.use("/api", routes());
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const cookie = `nht_admin_session=${createAdminSession("logo-test-admin")}`;
  const request = (path, options = {}, authenticated = true) => fetch(base + path, { ...options, headers: { ...(authenticated ? { cookie } : {}), ...options.headers } });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");
  const add = (name, buffer = png, type = "image/png") => {
    const body = new FormData(); body.append("name", name); body.append("image", new Blob([buffer], { type }), "test.png");
    return request("/admin/partner-logos", { method: "POST", body });
  };
  const remove = (publicId) => request("/admin/partner-logos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicId }) });
  try {
    for (const method of ["GET", "POST", "DELETE"]) assert.equal((await request("/admin/partner-logos", { method }, false)).status, 401);
    assert.equal(uploads, 0); assert.equal(deletes, 0);
    assert.equal((await (await request("/admin/partner-logos")).json()).logos.length, 1);
    await request("/partner-logos"); // Seed the public cache before upload.
    assert.equal((await add(" ")).status, 400);
    assert.equal((await add("Fake", Buffer.from("not-an-image"))).status, 400);
    assert.equal((await add("SVG", png, "image/svg+xml")).status, 400);
    assert.equal((await add("Large", Buffer.alloc(5 * 1024 * 1024 + 1))).status, 400);
    assert.equal(uploads, 0);
    const response = await add("Đối tác thử <script>"); assert.equal(response.status, 201);
    const { logo } = await response.json();
    assert.match(logo.publicId, /^nht\/partner-logos\//);
    let publicResponse = await request("/partner-logos");
    assert.equal(publicResponse.headers.get("cache-control"), "no-store");
    assert.equal((await publicResponse.json()).logos.length, 2, "Upload must invalidate public cache");
    assert.equal((await remove("nht/legal-documents/another-image")).status, 400);
    resources.push({ public_id: "nht/partner-logos/not-tagged", type: "upload", tags: [] });
    assert.equal((await remove("nht/partner-logos/not-tagged")).status, 404);
    failDelete = true;
    assert.equal((await remove(logo.publicId)).status, 502);
    assert.ok(resources.some(item => item.public_id === logo.publicId));
    failDelete = false;
    assert.equal((await remove(logo.publicId)).status, 200);
    resources = resources.filter(item => item.public_id !== "nht/partner-logos/not-tagged");
    assert.equal((await (await request("/partner-logos")).json()).logos.length, 1, "Delete must invalidate public cache");
    assert.equal((await remove(logo.publicId)).status, 404);
    assert.equal(deletes, 1);
    failUpload = true;
    assert.equal((await add("Fails")).status, 502);
    console.log("PASS: authentication; valid upload; file/name validation; 5MB limit; deletion scope; failure handling; cache invalidation after add/delete.");
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
