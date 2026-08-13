const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { createDatabase } = require("./database");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const FRONTEND_ROOT = path.join(__dirname, "..");
const HTML_ROOT = path.join(FRONTEND_ROOT, "HTML");
const PICTURE_ROOT = path.join(FRONTEND_ROOT, "picture");
const EMAIL_LOGO_PATH = path.join(PICTURE_ROOT, "logo.png");
const LEADS_FILE = path.join(__dirname, "data", "leads.json");
const CUSTOMER_EMAIL_TEMPLATE = path.join(__dirname, "uploads", "Customer Email", "code.html");
const ADMIN_EMAIL_TEMPLATE = path.join(__dirname, "uploads", "Admin email", "code.html");
const ADMIN_COOKIE_NAME = "nht_admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8;

const app = express();
let legalDatabase;
app.use(express.json({ limit: "32kb" }));

function setNoStoreHeaders(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
}

app.get("/admin.html", (req, res) => {
  setNoStoreHeaders(res);
  if (!getAdminSession(req)) {
    return res.redirect("/admin-login.html");
  }
  return res.sendFile(path.join(HTML_ROOT, "admin.html"));
});

app.get("/admin-login.html", (_req, res) => {
  setNoStoreHeaders(res);
  return res.sendFile(path.join(HTML_ROOT, "admin-login.html"));
});

app.use(express.static(HTML_ROOT));
app.use(express.static(PICTURE_ROOT));
app.use(express.static(FRONTEND_ROOT));
const uploadLegalImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function isCloudinaryConfigured() {
  return ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
    .every((key) => String(process.env[key] || "").trim() && !String(process.env[key]).startsWith("THAY_BANG_"));
}

function uploadImageToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "nht/legal-documents", resource_type: "image" },
      (error, result) => error ? reject(error) : resolve(result)
    );
    stream.end(buffer);
  });
}

async function destroyCloudinaryImage(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  } catch (error) {
    console.error(`Could not delete Cloudinary image ${publicId}:`, error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmailTemplate(templatePath, values) {
  const template = fs.readFileSync(templatePath, "utf8");
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) =>
    escapeHtml(values[key] ?? "")
  );
}

function readLeads() {
  try {
    if (!fs.existsSync(LEADS_FILE)) return [];
    const raw = fs.readFileSync(LEADS_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function saveLeads(leads) {
  const dir = path.dirname(LEADS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf8");
}

function appendLead(entry) {
  const leads = readLeads();
  const lead = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  };
  leads.push(lead);
  saveLeads(leads);
  return lead;
}

function isTruthyEnv(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  return header.split(";").reduce((cookies, pair) => {
    const index = pair.indexOf("=");
    if (index === -1) return cookies;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function getAdminUsername() {
  return String(process.env.ADMIN_USERNAME || "admin").trim();
}

function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || "").trim();
}

function getSessionSecret() {
  return String(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET || "").trim();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function createAdminSession(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      exp: Date.now() + ADMIN_SESSION_TTL_MS,
    })
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function verifyAdminSession(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || !getSessionSecret()) return null;
  if (!safeEqual(signature, signPayload(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || Date.now() > session.exp) return null;
    if (session.username !== getAdminUsername()) return null;
    return session;
  } catch {
    return null;
  }
}

function getAdminSession(req) {
  return verifyAdminSession(parseCookies(req)[ADMIN_COOKIE_NAME]);
}

function setAdminCookie(res, token) {
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: isTruthyEnv(process.env.COOKIE_SECURE),
    path: "/",
  });
}

function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "strict",
    secure: isTruthyEnv(process.env.COOKIE_SECURE),
    path: "/",
  });
}

function requireAdmin(req, res, next) {
  const session = getAdminSession(req);
  if (!session) {
    return res.status(401).json({ ok: false, error: "Chưa đăng nhập." });
  }
  req.admin = session;
  next();
}

async function queryAll(sql, params = []) {
  const result = await legalDatabase.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows[0] || null;
}

function normalizeLegalDocument(input) {
  const value = (key, max = 0) => {
    const result = String(input[key] || "").trim();
    return max ? result.slice(0, max) : result;
  };
  const status = value("status") === "published" ? "published" : "draft";
  return {
    title: value("title", 250),
    summary: value("summary", 600),
    content: value("content", 30000),
    documentNumber: value("documentNumber", 100),
    issuingBody: value("issuingBody", 200),
    issuedDate: value("issuedDate", 10),
    effectiveDate: value("effectiveDate", 10),
    sourceUrl: value("sourceUrl", 2000),
    imageUrl: value("imageUrl", 500),
    imagePublicId: value("imagePublicId", 300),
    status,
  };
}

function validateLegalDocument(document) {
  if (!document.title) return "Vui lòng nhập tiêu đề.";
  if (!document.summary && !document.content) return "Vui lòng nhập tóm tắt hoặc nội dung.";
  if (document.sourceUrl && !/^https?:\/\//i.test(document.sourceUrl)) {
    return "Đường dẫn văn bản gốc phải bắt đầu bằng http:// hoặc https://.";
  }
  if (document.imageUrl && !/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(document.imageUrl)) {
    return "Đường dẫn ảnh không hợp lệ.";
  }
  if (document.imagePublicId && !/^nht\/legal-documents\/[a-z0-9_-]+$/i.test(document.imagePublicId)) {
    return "Mã ảnh Cloudinary không hợp lệ.";
  }
  if (Boolean(document.imageUrl) !== Boolean(document.imagePublicId)) return "Thông tin ảnh không đầy đủ.";
  for (const date of [document.issuedDate, document.effectiveDate]) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Ngày không đúng định dạng.";
  }
  return null;
}

function createTransporter() {
  const host = String(process.env.SMTP_HOST || "").trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = isTruthyEnv(process.env.SMTP_SECURE) || port === 465;
  const transporterOptions = { host, port, secure };

  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  if (user && pass) {
    transporterOptions.auth = { user, pass };
  }

  return nodemailer.createTransport(transporterOptions);
}

function getFromAddress() {
  return String(process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
}

async function sendMailSafely(transporter, mailOptions) {
  try {
    const info = await transporter.sendMail(mailOptions);
    return { ok: true, info };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

app.post("/api/contact", async (req, res) => {
  const email = String(req.body.email || "").trim();
  const phone = String(req.body.phone || "").trim();
  const name = String(req.body.name || "").trim();
  const company = String(req.body.company || "").trim();
  const taxCode = String(req.body.taxCode || "").trim();
  const service = String(req.body.service || "").trim();
  const message = String(req.body.message || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Email không hợp lệ." });
  }

  if (!phone || phone.replace(/\D/g, "").length < 8) {
    return res.status(400).json({ ok: false, error: "Số điện thoại không hợp lệ." });
  }

  if (!/^(?:\d{10}|\d{12}|\d{10}-\d{3})$/.test(taxCode)) {
    return res.status(400).json({
      ok: false,
      error: "Mã số thuế phải gồm 10 chữ số, mã cá nhân/CCCD 12 chữ số hoặc có dạng 0123456789-001.",
    });
  }

  const lead = appendLead({ email, phone, name, company, taxCode, service, message });
  const transporter = createTransporter();
  const fromAddr = getFromAddress();

  if (!transporter || !fromAddr) {
    console.warn("SMTP chua cau hinh (backend/.env) - lead da luu, chua gui email.");
    return res.json({ ok: true, warning: "no_smtp" });
  }

  const displayName = name || "Quy khach";
  const now = new Date();
  const customerHtml = renderEmailTemplate(CUSTOMER_EMAIL_TEMPLATE, {
    name: displayName,
    date: new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(now),
    year: now.getFullYear(),
  });
  const customerMail = {
    from: `"NHT" <${fromAddr}>`,
    to: email,
    subject: process.env.MAIL_CUSTOMER_SUBJECT || "Da nhan thong tin lien he - NHT",
    replyTo: fromAddr,
    text: `Cảm ơn khách hàng ${displayName} đã tin tưởng NHT Accounting

Thông tin quý khách cung cấp đã được bộ phận chuyên môn tiếp nhận và xử lý. NHT Accounting sẽ chủ động liên hệ và phản hồi đến khách hàng trong vòng 24 giờ làm việc.

Đây là email tự động, quý khách vui lòng không phản hồi email này.

Trân trọng,
Đội ngũ NHT Accounting`,
    html: customerHtml,
    attachments: [{ filename: "nht-logo.png", path: EMAIL_LOGO_PATH, cid: "nht-logo" }],
  };

  try {
    const customerResult = await sendMailSafely(transporter, customerMail);

    const adminTo = String(process.env.ADMIN_EMAIL || "").trim();
    const adminResult = adminTo
      ? await sendMailSafely(transporter, {
          from: `"Website NHT" <${fromAddr}>`,
          to: adminTo,
          subject: `[Lead] ${phone} - ${email}`,
          text: JSON.stringify(lead, null, 2),
          replyTo: email,
          attachments: [{ filename: "nht-logo.png", path: EMAIL_LOGO_PATH, cid: "nht-logo" }],
          html: renderEmailTemplate(ADMIN_EMAIL_TEMPLATE, {
            name: name || "Không cung cấp",
            email,
            phone,
            company: company || "Không cung cấp",
            taxCode,
            service: service || "Không cung cấp",
            message: message || "Không có lời nhắn",
            submittedAt: new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(now),
            leadId: lead.id,
          }),
        })
      : { ok: true };

    if (!customerResult.ok && !adminResult.ok) {
      throw customerResult.error || adminResult.error;
    }

    if (!customerResult.ok || !adminResult.ok) {
      return res.json({
        ok: true,
        warning: !customerResult.ok ? "customer_mail_failed" : "admin_mail_failed",
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

app.post("/api/admin/login", (req, res) => {
  const configuredPassword = getAdminPassword();
  const sessionSecret = getSessionSecret();
  if (!configuredPassword || !sessionSecret) {
    return res.status(500).json({
      ok: false,
      error: "Admin chưa được cấu hình. Hãy thêm ADMIN_PASSWORD và ADMIN_SESSION_SECRET trong backend/.env.",
    });
  }

  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!safeEqual(username, getAdminUsername()) || !safeEqual(password, configuredPassword)) {
    return res.status(401).json({ ok: false, error: "Sai tài khoản hoặc mật khẩu." });
  }

  setAdminCookie(res, createAdminSession(username));
  res.json({ ok: true, user: { username } });
});

app.post("/api/admin/logout", (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ ok: true, user: { username: req.admin.username } });
});

app.get("/api/leads", requireAdmin, (req, res) => {
  res.json({ ok: true, leads: readLeads() });
});

app.post("/api/admin/legal-documents/upload-image", requireAdmin, (req, res) => {
  uploadLegalImage.single("image")(req, res, async (error) => {
    if (error) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Ảnh tối đa 5 MB."
        : "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.";
      return res.status(400).json({ ok: false, error: message });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: "Vui lòng chọn ảnh JPG, PNG hoặc WebP." });
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ ok: false, error: "Cloudinary chưa được cấu hình trên máy chủ." });
    }
    try {
      const result = await uploadImageToCloudinary(req.file.buffer);
      return res.status(201).json({ ok: true, imageUrl: result.secure_url, imagePublicId: result.public_id });
    } catch (uploadError) {
      console.error("Cloudinary upload failed:", uploadError.message);
      return res.status(502).json({ ok: false, error: "Không tải được ảnh lên Cloudinary." });
    }
  });
});

app.get("/api/legal-documents", async (req, res, next) => {
  try {
    const documents = await queryAll(
    `SELECT id, title, summary, document_number AS "documentNumber", issuing_body AS "issuingBody",
            issued_date AS "issuedDate", effective_date AS "effectiveDate", source_url AS "sourceUrl", image_url AS "imageUrl",
            published_at AS "publishedAt"
     FROM legal_documents
     WHERE status = 'published'
     ORDER BY COALESCE(published_at, created_at) DESC`
    );
    res.json({ ok: true, documents });
  } catch (error) { next(error); }
});

app.get("/api/legal-documents/:id", async (req, res, next) => {
  try {
    const document = await queryOne(
    `SELECT id, title, summary, content, document_number AS "documentNumber", issuing_body AS "issuingBody",
            issued_date AS "issuedDate", effective_date AS "effectiveDate", source_url AS "sourceUrl", image_url AS "imageUrl",
            published_at AS "publishedAt"
     FROM legal_documents WHERE id = $1 AND status = 'published'`,
    [req.params.id]
    );
    if (!document) return res.status(404).json({ ok: false, error: "Không tìm thấy văn bản." });
    res.json({ ok: true, document });
  } catch (error) { next(error); }
});

app.get("/api/admin/legal-documents", requireAdmin, async (req, res, next) => {
  try {
    const documents = await queryAll(
    `SELECT id, title, summary, content, document_number AS "documentNumber", issuing_body AS "issuingBody",
            issued_date AS "issuedDate", effective_date AS "effectiveDate", source_url AS "sourceUrl", image_url AS "imageUrl", image_public_id AS "imagePublicId",
            status, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt",
            published_at AS "publishedAt"
     FROM legal_documents ORDER BY updated_at DESC`
    );
    res.json({ ok: true, documents });
  } catch (error) { next(error); }
});

app.post("/api/admin/legal-documents", requireAdmin, async (req, res, next) => {
  try {
  const document = normalizeLegalDocument(req.body || {});
  const validationError = validateLegalDocument(document);
  if (validationError) return res.status(400).json({ ok: false, error: validationError });

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const publishedAt = document.status === "published" ? now : null;
  await legalDatabase.query(
    `INSERT INTO legal_documents
     (id, title, summary, content, document_number, issuing_body, issued_date, effective_date, source_url, image_url, image_public_id, status, created_by, created_at, updated_at, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [id, document.title, document.summary, document.content, document.documentNumber, document.issuingBody,
      document.issuedDate || null, document.effectiveDate || null, document.sourceUrl, document.imageUrl, document.imagePublicId, document.status,
      req.admin.username, now, now, publishedAt]
  );
  res.status(201).json({ ok: true, document: await queryOne("SELECT * FROM legal_documents WHERE id = $1", [id]) });
  } catch (error) { next(error); }
});

app.put("/api/admin/legal-documents/:id", requireAdmin, async (req, res, next) => {
  try {
  const existing = await queryOne("SELECT id, published_at AS \"publishedAt\", image_public_id AS \"imagePublicId\" FROM legal_documents WHERE id = $1", [req.params.id]);
  if (!existing) return res.status(404).json({ ok: false, error: "Không tìm thấy văn bản." });
  const document = normalizeLegalDocument(req.body || {});
  const validationError = validateLegalDocument(document);
  if (validationError) return res.status(400).json({ ok: false, error: validationError });

  const now = new Date().toISOString();
  const publishedAt = document.status === "published" ? (existing.publishedAt || now) : null;
  await legalDatabase.query(
    `UPDATE legal_documents SET title = $1, summary = $2, content = $3, document_number = $4, issuing_body = $5,
       issued_date = $6, effective_date = $7, source_url = $8, image_url = $9, image_public_id = $10, status = $11, updated_at = $12, published_at = $13 WHERE id = $14`,
    [document.title, document.summary, document.content, document.documentNumber, document.issuingBody,
      document.issuedDate || null, document.effectiveDate || null, document.sourceUrl, document.imageUrl, document.imagePublicId, document.status, now,
      publishedAt, req.params.id]
  );
  if (existing.imagePublicId && existing.imagePublicId !== document.imagePublicId) {
    await destroyCloudinaryImage(existing.imagePublicId);
  }
  res.json({ ok: true, document: await queryOne("SELECT * FROM legal_documents WHERE id = $1", [req.params.id]) });
  } catch (error) { next(error); }
});

app.delete("/api/admin/legal-documents/:id", requireAdmin, async (req, res, next) => {
  try {
  const existing = await queryOne("SELECT id, image_public_id AS \"imagePublicId\" FROM legal_documents WHERE id = $1", [req.params.id]);
  if (!existing) return res.status(404).json({ ok: false, error: "Không tìm thấy văn bản." });
  await legalDatabase.query("DELETE FROM legal_documents WHERE id = $1", [req.params.id]);
  await destroyCloudinaryImage(existing.imagePublicId);
  res.json({ ok: true });
  } catch (error) { next(error); }
});

const PORT = Number(process.env.PORT || 3000);
async function start() {
  legalDatabase = await createDatabase();
  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    console.log("Legal documents database: PostgreSQL");
    if (!createTransporter() || !getFromAddress()) {
      console.warn("SMTP not ready yet. Configure backend/.env to enable automatic email sending.");
    }
  });
}

start().catch((error) => {
  console.error("Could not start database:", error);
  process.exit(1);
});
