const express = require("express");
const crypto = require("node:crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { isCloudinaryConfigured } = require("../services/cloudinary-service");
const { requireAdmin } = require("../middleware/admin-auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, fieldSize: 1024 },
  fileFilter: (_req, file, done) => done(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});
const LOGO_ID = /^nht\/partner-logos\/[a-zA-Z0-9_-]{1,180}$/;
function isImage(buffer) {
  return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP");
}
function serializeLogo(asset) {
  return {
    publicId: asset.public_id,
    name: asset.context?.custom?.alt || asset.display_name || asset.public_id.split("/").pop().replace(/[-_]/g, " "),
    url: cloudinary.url(asset.public_id, {
      secure: true, version: asset.version, width: 320, height: 160,
      crop: "pad", background: "white", fetch_format: "auto", quality: "auto",
    }),
  };
}

// Cache and coalesce requests so page traffic does not consume Admin API quota.
module.exports = function createPartnerLogoRoutes() {
  const router = express.Router();
  let cached = null;
  let expires = 0;
  let pending = null;
  let generation = 0;
  const invalidate = () => { generation++; cached = null; expires = 0; pending = null; };
  const requireLogoSource = (_req, res, next) => {
    if (!isCloudinaryConfigured() || !process.env.CLOUDINARY_LOGO_TAG) {
      return res.status(503).json({ ok: false, error: "Chưa bật nguồn logo Cloudinary trên máy chủ." });
    }
    return next();
  };

  async function loadLogos() {
    const resources = [];
    let nextCursor;
    do {
      const page = await cloudinary.api.resources_by_tag(process.env.CLOUDINARY_LOGO_TAG, {
        resource_type: "image", type: "upload", max_results: 500,
        context: true, next_cursor: nextCursor, timeout: 10000,
      });
      resources.push(...page.resources);
      nextCursor = page.next_cursor;
    } while (nextCursor);
    return resources.filter((asset) => asset.type === "upload")
      .sort((a, b) => a.public_id.localeCompare(b.public_id, "en", { numeric: true }))
      .map(serializeLogo);
  }

  router.get("/admin/partner-logos", requireAdmin, requireLogoSource, async (_req, res) => {
    try {
      return res.json({ ok: true, logos: await loadLogos() });
    } catch {
      return res.status(502).json({ ok: false, error: "Không tải được danh sách logo. Vui lòng thử lại." });
    }
  });

  router.post("/admin/partner-logos", requireAdmin, requireLogoSource, (req, res) => {
    upload.single("image")(req, res, async (error) => {
      if (error) return res.status(400).json({ ok: false, error: error.code === "LIMIT_FILE_SIZE" ? "Ảnh tối đa 5 MB." : "Chọn một ảnh JPG, PNG hoặc WebP." });
      const name = String(req.body?.name || "").trim();
      if (!name || name.length > 120 || /[\u0000-\u001f]/.test(name)) return res.status(400).json({ ok: false, error: "Tên khách hàng hoặc đối tác phải từ 1 đến 120 ký tự." });
      if (!req.file || !isImage(req.file.buffer)) return res.status(400).json({ ok: false, error: "Vui lòng chọn ảnh JPG, PNG hoặc WebP hợp lệ." });
      try {
        const asset = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({
            public_id: `nht/partner-logos/${Date.now()}-${crypto.randomUUID()}`,
            resource_type: "image", type: "upload", overwrite: false,
            tags: [process.env.CLOUDINARY_LOGO_TAG], context: { alt: name }, timeout: 60000,
          }, (uploadError, result) => uploadError ? reject(uploadError) : resolve(result));
          stream.end(req.file.buffer);
        });
        invalidate();
        return res.status(201).json({ ok: true, logo: serializeLogo(asset) });
      } catch {
        return res.status(502).json({ ok: false, error: "Không tải được logo lên Cloudinary. Vui lòng thử lại." });
      }
    });
  });

  router.delete("/admin/partner-logos", requireAdmin, requireLogoSource, async (req, res) => {
    const id = req.body?.publicId;
    if (typeof id !== "string" || !LOGO_ID.test(id)) return res.status(400).json({ ok: false, error: "Mã logo không hợp lệ." });
    try {
      const asset = await cloudinary.api.resource(id, { resource_type: "image", type: "upload", tags: true });
      if (!asset.tags?.includes(process.env.CLOUDINARY_LOGO_TAG)) return res.status(404).json({ ok: false, error: "Không tìm thấy logo trong danh sách đối tác." });
      const result = await cloudinary.uploader.destroy(id, { resource_type: "image", type: "upload", invalidate: true });
      if (result.result !== "ok" && result.result !== "not found") throw new Error("Delete failed");
      invalidate();
      return res.json({ ok: true });
    } catch (error) {
      if (error.http_code === 404 || error.error?.http_code === 404) return res.status(404).json({ ok: false, error: "Logo đã bị xóa hoặc không tồn tại." });
      return res.status(502).json({ ok: false, error: "Không xóa được logo. Vui lòng thử lại." });
    }
  });

  router.get("/partner-logos", async (_req, res) => {
    // Explicit opt-in keeps the local demo independent of legal-document assets.
    if (!process.env.CLOUDINARY_LOGO_TAG) return res.json({ source: "local", logos: [] });
    if (!isCloudinaryConfigured()) return res.status(503).json({ error: "Logo source unavailable" });
    if (Date.now() >= expires) {
      if (!pending) {
        const requestGeneration = generation;
        const request = loadLogos().then((logos) => {
          if (requestGeneration !== generation) return;
          cached = logos;
          expires = Date.now() + 5 * 60 * 1000;
        }).catch((error) => {
          if (requestGeneration !== generation) return;
          console.error("Could not load partner logos:", error.message);
          expires = Date.now() + 30000;
        }).finally(() => { if (pending === request) pending = null; });
        pending = request;
      }
      await pending;
    }
    if (cached === null) return res.status(503).json({ error: "Logo source unavailable" });
    res.set("Cache-Control", "no-store");
    return res.json({ source: "cloudinary", logos: cached.map(({ name, url }) => ({ name, url })) });
  });
  return router;
};
