const crypto = require("crypto");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { notifyLead } = require("../services/lead-notification-service");
const { services } = require("../../js/service-catalog");

module.exports = function createContactRoutes(database) {
  const router = express.Router();
  const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { ok: false, error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút." },
  });

  router.post("/", contactLimiter, async (req, res, next) => {
    const email = String(req.body?.email || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const name = String(req.body?.name || "").trim();
    const company = String(req.body?.company || "").trim();
    const taxCode = String(req.body?.taxCode || "").trim();
    const service = String(req.body?.service || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || name.length > 150 || company.length > 200 || service.length > 100 || message.length > 5000) {
      return res.status(400).json({ ok: false, error: "Thông tin liên hệ không hợp lệ hoặc vượt quá độ dài cho phép." });
    }

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Email không hợp lệ." });
    }
    if (!phone || phone.length > 30 || phone.replace(/\D/g, "").length < 8) {
      return res.status(400).json({ ok: false, error: "Số điện thoại không hợp lệ." });
    }
    if (taxCode && !/^(?:\d{10}|\d{12}|\d{10}-\d{3})$/.test(taxCode)) {
      return res.status(400).json({
        ok: false,
        error: "Mã số thuế phải gồm 10 chữ số, mã cá nhân/CCCD 12 chữ số hoặc có dạng 0123456789-001.",
      });
    }

    if (service && !services.some((item) => item.id === service)) {
      return res.status(400).json({ ok: false, error: "Vui lòng chọn dịch vụ trong danh sách." });
    }
    const requestKey = req.body?.requestId || crypto.randomUUID();
    if (typeof requestKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
      return res.status(400).json({ ok: false, error: "Mã yêu cầu không hợp lệ." });
    }
    const requestHash = crypto.createHash("sha256")
      .update(JSON.stringify({ name, email, phone, company, taxCode, service, message })).digest("hex");
    const lead = { id: crypto.randomUUID(), email, phone, name, company, taxCode, service, message, createdAt: new Date().toISOString() };
    try {
      const inserted = await database.query(
        `INSERT INTO contact_leads
         (id, name, email, phone, company, tax_code, service, message, created_at, request_key, request_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (request_key) DO NOTHING RETURNING id`,
        [lead.id, name, email, phone, company, taxCode, service, message, lead.createdAt, requestKey, requestHash]
      );
      if (!inserted.rows.length) {
        const { rows } = await database.query("SELECT request_hash FROM contact_leads WHERE request_key = $1", [requestKey]);
        if (rows[0]?.request_hash !== requestHash) {
          return res.status(409).json({ ok: false, error: "Thông tin đã thay đổi. Vui lòng gửi lại yêu cầu." });
        }
        return res.json({ ok: true, duplicate: true });
      }
    } catch (error) { return next(error); }

    // The lead is durable now. SMTP or status-update failures must not report
    // the entire submission as failed and invite another submission.
    try {
      const result = await notifyLead(database, lead);
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error("Could not update lead email status:", error.message);
      return res.json({ ok: true, warning: "mail_pending" });
    }
  });
  return router;
};
