const crypto = require("crypto");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { sendLeadEmails } = require("../services/mail-service");

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
    const email = String(req.body.email || "").trim();
    const phone = String(req.body.phone || "").trim();
    const name = String(req.body.name || "").trim();
    const company = String(req.body.company || "").trim();
    const taxCode = String(req.body.taxCode || "").trim();
    const service = String(req.body.service || "").trim();
    const message = String(req.body.message || "").trim();

    if (!name || name.length > 150 || company.length > 200 || service.length > 100 || message.length > 5000) {
      return res.status(400).json({ ok: false, error: "Thông tin liên hệ không hợp lệ hoặc vượt quá độ dài cho phép." });
    }

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Email không hợp lệ." });
    }
    if (!phone || phone.length > 30 || phone.replace(/\D/g, "").length < 8) {
      return res.status(400).json({ ok: false, error: "Số điện thoại không hợp lệ." });
    }
    if (!/^(?:\d{10}|\d{12}|\d{10}-\d{3})$/.test(taxCode)) {
      return res.status(400).json({
        ok: false,
        error: "Mã số thuế phải gồm 10 chữ số, mã cá nhân/CCCD 12 chữ số hoặc có dạng 0123456789-001.",
      });
    }

    const lead = {
      id: crypto.randomUUID(), email, phone, name, company, taxCode, service, message,
      createdAt: new Date().toISOString(),
    };

    try {
      await database.query(
        `INSERT INTO contact_leads
         (id, name, email, phone, company, tax_code, service, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [lead.id, name, email, phone, company, taxCode, service, message, lead.createdAt]
      );
    } catch (error) {
      return next(error);
    }

    try {
      const mail = await sendLeadEmails(lead);
      if (!mail.configured) {
        await database.query(
          "UPDATE contact_leads SET customer_mail_status = 'not_configured', admin_mail_status = 'not_configured' WHERE id = $1",
          [lead.id]
        );
        console.warn("SMTP chua cau hinh (backend/.env) - lead da luu PostgreSQL, chua gui email.");
        return res.json({ ok: true, warning: "no_smtp" });
      }

      await database.query(
        `UPDATE contact_leads SET customer_mail_status = $1, admin_mail_status = $2 WHERE id = $3`,
        [
          mail.customerResult.ok ? "sent" : "failed",
          mail.hasAdminRecipient ? (mail.adminResult.ok ? "sent" : "failed") : "not_configured",
          lead.id,
        ]
      );

      if (!mail.customerResult.ok && !mail.adminResult.ok) {
        throw mail.customerResult.error || mail.adminResult.error;
      }
      if (!mail.customerResult.ok || !mail.adminResult.ok) {
        return res.json({
          ok: true,
          warning: !mail.customerResult.ok ? "customer_mail_failed" : "admin_mail_failed",
        });
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        ok: false,
        error: "Không gửi được email. Vui lòng thử lại sau hoặc gọi hotline.",
      });
    }
  });

  return router;
};
