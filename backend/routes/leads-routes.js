const express = require("express");
const { requireAdmin } = require("../middleware/admin-auth");
const { createLeadsWorkbook } = require("../services/excel-service");
const { notifyLead } = require("../services/lead-notification-service");
const { rateLimit } = require("express-rate-limit");

module.exports = function createLeadsRoutes(database) {
  const router = express.Router();
  const queryAll = async (sql, params = []) => (await database.query(sql, params)).rows;
  const queryOne = async (sql, params = []) => (await queryAll(sql, params))[0] || null;

  router.use(requireAdmin);

  router.post("/:id/retry-email", rateLimit({ windowMs: 60000, limit: 5 }), async (req, res, next) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ ok: false, error: "Mã yêu cầu không hợp lệ." });
    try {
      const lead = await queryOne(
        `SELECT id, name, email, phone, company, tax_code AS "taxCode", service, message,
          customer_mail_status AS "customerMailStatus", admin_mail_status AS "adminMailStatus",
          created_at AS "createdAt" FROM contact_leads WHERE id = $1`, [req.params.id]
      );
      if (!lead) return res.status(404).json({ ok: false, error: "Không tìm thấy yêu cầu tư vấn." });
      if (lead.customerMailStatus === "sent" && lead.adminMailStatus === "sent") return res.json({ ok: true });
      const result = await notifyLead(database, lead);
      return res.json({ ok: true, ...result });
    } catch (error) { return next(error); }
  });

  router.get("/", async (_req, res, next) => {
    try {
      const leads = await queryAll(
        `SELECT id, name, email, phone, company, tax_code AS "taxCode", service, message,
                customer_mail_status AS "customerMailStatus", admin_mail_status AS "adminMailStatus",
                processing_status AS "processingStatus", completed_at AS "completedAt",
                created_at AS "createdAt"
         FROM contact_leads ORDER BY created_at DESC`
      );
      res.json({ ok: true, leads });
    } catch (error) { next(error); }
  });

  router.patch("/:id/status", async (req, res, next) => {
    const processingStatus = String(req.body.processingStatus || "").trim();
    if (!["new", "in_progress", "completed"].includes(processingStatus)) {
      return res.status(400).json({ ok: false, error: "Trạng thái xử lý không hợp lệ." });
    }
    try {
      const existing = await queryOne(
        `SELECT id, processing_status AS "processingStatus" FROM contact_leads WHERE id = $1`,
        [req.params.id]
      );
      if (!existing) return res.status(404).json({ ok: false, error: "Không tìm thấy yêu cầu tư vấn." });
      if (processingStatus === "new" && existing.processingStatus !== "new") {
        return res.status(400).json({ ok: false, error: "Yêu cầu đã xử lý không thể chuyển lại trạng thái Mới." });
      }
      const lead = await queryOne(
        `UPDATE contact_leads
         SET processing_status = $1::VARCHAR,
             completed_at = CASE
               WHEN $1::VARCHAR = 'completed' AND processing_status <> 'completed' THEN NOW()
               WHEN $1::VARCHAR = 'completed' THEN completed_at ELSE NULL
             END
         WHERE id = $2
         RETURNING id, processing_status AS "processingStatus", completed_at AS "completedAt"`,
        [processingStatus, req.params.id]
      );
      return res.json({ ok: true, lead });
    } catch (error) { next(error); }
  });

  router.get("/export", async (_req, res, next) => {
    try {
      const leads = await queryAll(
        `SELECT name, email, phone, company, tax_code AS "taxCode", service, message,
                customer_mail_status AS "customerMailStatus", admin_mail_status AS "adminMailStatus",
                processing_status AS "processingStatus", completed_at AS "completedAt",
                created_at AS "createdAt"
         FROM contact_leads ORDER BY created_at DESC`
      );
      const fileDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
      const buffer = await createLeadsWorkbook(leads);
      res.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="yeu-cau-tu-van-NHT-${fileDate}.xlsx"`,
        "Cache-Control": "no-store",
      });
      res.send(Buffer.from(buffer));
    } catch (error) { next(error); }
  });

  return router;
};
