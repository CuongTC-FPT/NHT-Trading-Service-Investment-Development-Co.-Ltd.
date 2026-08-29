const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { requireAdmin } = require("../middleware/admin-auth");
const { destroyImage, isCloudinaryConfigured, uploadImage } = require("../services/cloudinary-service");
const { normalizeLegalDocument, validateLegalDocument } = require("../utils/legal-document");

const uploadLegalImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

module.exports = function createLegalDocumentRoutes(database) {
  const router = express.Router();
  const queryAll = async (sql, params = []) => (await database.query(sql, params)).rows;
  const queryOne = async (sql, params = []) => (await queryAll(sql, params))[0] || null;

  router.get("/legal-documents", async (_req, res, next) => {
    try {
      const documents = await queryAll(
        `SELECT id, title, summary, document_number AS "documentNumber", issuing_body AS "issuingBody",
                issued_date AS "issuedDate", effective_date AS "effectiveDate", source_url AS "sourceUrl", image_url AS "imageUrl",
                published_at AS "publishedAt"
         FROM legal_documents WHERE status = 'published'
         ORDER BY COALESCE(published_at, created_at) DESC`
      );
      res.json({ ok: true, documents });
    } catch (error) { next(error); }
  });

  router.get("/legal-documents/:id", async (req, res, next) => {
    try {
      const document = await queryOne(
        `SELECT id, title, summary, content, document_number AS "documentNumber", issuing_body AS "issuingBody",
                issued_date AS "issuedDate", effective_date AS "effectiveDate", source_url AS "sourceUrl", image_url AS "imageUrl",
                published_at AS "publishedAt"
         FROM legal_documents WHERE id = $1 AND status = 'published'`,
        [req.params.id]
      );
      if (!document) return res.status(404).json({ ok: false, error: "Không tìm thấy văn bản." });
      return res.json({ ok: true, document });
    } catch (error) { return next(error); }
  });

  router.post("/admin/legal-documents/upload-image", requireAdmin, (req, res) => {
    uploadLegalImage.single("image")(req, res, async (error) => {
      if (error) {
        const message = error.code === "LIMIT_FILE_SIZE" ? "Ảnh tối đa 5 MB." : "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.";
        return res.status(400).json({ ok: false, error: message });
      }
      if (!req.file) return res.status(400).json({ ok: false, error: "Vui lòng chọn ảnh JPG, PNG hoặc WebP." });
      if (!isCloudinaryConfigured()) return res.status(503).json({ ok: false, error: "Cloudinary chưa được cấu hình trên máy chủ." });
      try {
        const result = await uploadImage(req.file.buffer);
        return res.status(201).json({ ok: true, imageUrl: result.secure_url, imagePublicId: result.public_id });
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError.message);
        return res.status(502).json({ ok: false, error: "Không tải được ảnh lên Cloudinary." });
      }
    });
  });

  router.get("/admin/legal-documents", requireAdmin, async (_req, res, next) => {
    try {
      const documents = await queryAll(
        `SELECT id, title, summary, content, document_number AS "documentNumber", issuing_body AS "issuingBody",
                issued_date AS "issuedDate", effective_date AS "effectiveDate", source_url AS "sourceUrl", image_url AS "imageUrl", image_public_id AS "imagePublicId",
                status, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", published_at AS "publishedAt"
         FROM legal_documents ORDER BY updated_at DESC`
      );
      res.json({ ok: true, documents });
    } catch (error) { next(error); }
  });

  router.post("/admin/legal-documents", requireAdmin, async (req, res, next) => {
    try {
      const document = normalizeLegalDocument(req.body || {});
      const validationError = validateLegalDocument(document);
      if (validationError) return res.status(400).json({ ok: false, error: validationError });
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const publishedAt = document.status === "published" ? now : null;
      await database.query(
        `INSERT INTO legal_documents
         (id, title, summary, content, document_number, issuing_body, issued_date, effective_date, source_url, image_url, image_public_id, status, created_by, created_at, updated_at, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [id, document.title, document.summary, document.content, document.documentNumber, document.issuingBody,
          document.issuedDate || null, document.effectiveDate || null, document.sourceUrl, document.imageUrl, document.imagePublicId,
          document.status, req.admin.username, now, now, publishedAt]
      );
      return res.status(201).json({ ok: true, document: await queryOne("SELECT * FROM legal_documents WHERE id = $1", [id]) });
    } catch (error) { return next(error); }
  });

  router.put("/admin/legal-documents/:id", requireAdmin, async (req, res, next) => {
    try {
      const existing = await queryOne(
        `SELECT id, published_at AS "publishedAt", image_public_id AS "imagePublicId" FROM legal_documents WHERE id = $1`,
        [req.params.id]
      );
      if (!existing) return res.status(404).json({ ok: false, error: "Không tìm thấy văn bản." });
      const document = normalizeLegalDocument(req.body || {});
      const validationError = validateLegalDocument(document);
      if (validationError) return res.status(400).json({ ok: false, error: validationError });
      const now = new Date().toISOString();
      const publishedAt = document.status === "published" ? (existing.publishedAt || now) : null;
      await database.query(
        `UPDATE legal_documents SET title = $1, summary = $2, content = $3, document_number = $4, issuing_body = $5,
           issued_date = $6, effective_date = $7, source_url = $8, image_url = $9, image_public_id = $10,
           status = $11, updated_at = $12, published_at = $13 WHERE id = $14`,
        [document.title, document.summary, document.content, document.documentNumber, document.issuingBody,
          document.issuedDate || null, document.effectiveDate || null, document.sourceUrl, document.imageUrl,
          document.imagePublicId, document.status, now, publishedAt, req.params.id]
      );
      if (existing.imagePublicId && existing.imagePublicId !== document.imagePublicId) await destroyImage(existing.imagePublicId);
      return res.json({ ok: true, document: await queryOne("SELECT * FROM legal_documents WHERE id = $1", [req.params.id]) });
    } catch (error) { return next(error); }
  });

  router.delete("/admin/legal-documents/:id", requireAdmin, async (req, res, next) => {
    try {
      const existing = await queryOne(
        `SELECT id, image_public_id AS "imagePublicId" FROM legal_documents WHERE id = $1`,
        [req.params.id]
      );
      if (!existing) return res.status(404).json({ ok: false, error: "Không tìm thấy văn bản." });
      await database.query("DELETE FROM legal_documents WHERE id = $1", [req.params.id]);
      await destroyImage(existing.imagePublicId);
      return res.json({ ok: true });
    } catch (error) { return next(error); }
  });

  return router;
};
