const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const { createDatabase } = require("./database");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const FRONTEND_ROOT = path.join(__dirname, "..");
const HTML_ROOT = path.join(FRONTEND_ROOT, "HTML");
const PICTURE_ROOT = path.join(FRONTEND_ROOT, "picture");
const LEADS_FILE = path.join(__dirname, "data", "leads.json");
const UPLOAD_ROOT = path.join(__dirname, "uploads", "legal-documents");
const ADMIN_COOKIE_NAME = "nht_admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8;

const app = express();
let legalDatabase;
let persistDatabase;
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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const imageStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    callback(null, UPLOAD_ROOT);
  },
  filename: (_req, file, callback) => {
    const extension = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype];
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});
const uploadLegalImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    maxAge: ADMIN_SESSION_TTL_MS,
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
    return res.status(401).json({ ok: false, error: "Chua dang nhap." });
  }
  req.admin = session;
  next();
}

function queryAll(sql, params = []) {
  const statement = legalDatabase.prepare(sql);
  statement.bind(params);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
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
    status,
  };
}

function validateLegalDocument(document) {
  if (!document.title) return "Vui long nhap tieu de.";
  if (!document.summary && !document.content) return "Vui long nhap tom tat hoac noi dung.";
  if (document.sourceUrl && !/^https?:\/\//i.test(document.sourceUrl)) {
    return "Duong dan van ban goc phai bat dau bang http:// hoac https://.";
  }
  if (document.imageUrl && !/^\/uploads\/legal-documents\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(document.imageUrl)) {
    return "Duong dan anh khong hop le.";
  }
  for (const date of [document.issuedDate, document.effectiveDate]) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Ngay khong dung dinh dang.";
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
  const service = String(req.body.service || "").trim();
  const message = String(req.body.message || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Email khong hop le." });
  }

  if (!phone || phone.replace(/\D/g, "").length < 8) {
    return res.status(400).json({ ok: false, error: "So dien thoai khong hop le." });
  }

  const lead = appendLead({ email, phone, name, company, service, message });
  const transporter = createTransporter();
  const fromAddr = getFromAddress();

  if (!transporter || !fromAddr) {
    console.warn("SMTP chua cau hinh (backend/.env) - lead da luu, chua gui email.");
    return res.json({ ok: true, warning: "no_smtp" });
  }

  const displayName = name || "Quy khach";
  const customerMail = {
    from: `"NHT" <${fromAddr}>`,
    to: email,
    subject: process.env.MAIL_CUSTOMER_SUBJECT || "Da nhan thong tin lien he - NHT",
    replyTo: fromAddr,
    text: `Xin chao ${displayName},

Cam on ban da de lai thong tin tai website. Chung toi da nhan duoc yeu cau va se lien he som nhat.

Tran trong,
NHT`,
    html: `<p>Xin chao <strong>${escapeHtml(displayName)}</strong>,</p>
<p>Cam on ban da de lai thong tin. Chung toi da nhan duoc yeu cau va se lien he som nhat.</p>
<p>Tran trong,<br/>NHT</p>`,
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
          html: `<p>Lead moi:</p><pre style="font-family:monospace;font-size:12px">${escapeHtml(
            JSON.stringify(lead, null, 2)
          )}</pre>`,
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
      error: "Khong gui duoc email. Vui long thu lai sau hoac goi hotline.",
    });
  }
});

app.post("/api/admin/login", (req, res) => {
  const configuredPassword = getAdminPassword();
  const sessionSecret = getSessionSecret();
  if (!configuredPassword || !sessionSecret) {
    return res.status(500).json({
      ok: false,
      error: "Admin chua duoc cau hinh. Hay them ADMIN_PASSWORD va ADMIN_SESSION_SECRET trong backend/.env.",
    });
  }

  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!safeEqual(username, getAdminUsername()) || !safeEqual(password, configuredPassword)) {
    return res.status(401).json({ ok: false, error: "Sai tai khoan hoac mat khau." });
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
  uploadLegalImage.single("image")(req, res, (error) => {
    if (error) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Anh toi da 5 MB."
        : "Chi chap nhan anh JPG, PNG hoac WebP.";
      return res.status(400).json({ ok: false, error: message });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: "Vui long chon anh JPG, PNG hoac WebP." });
    return res.status(201).json({
      ok: true,
      imageUrl: `/uploads/legal-documents/${req.file.filename}`,
    });
  });
});

app.get("/api/legal-documents", (req, res) => {
  const documents = queryAll(
    `SELECT id, title, summary, document_number AS documentNumber, issuing_body AS issuingBody,
            issued_date AS issuedDate, effective_date AS effectiveDate, source_url AS sourceUrl, image_url AS imageUrl,
            published_at AS publishedAt
     FROM legal_documents
     WHERE status = 'published'
     ORDER BY COALESCE(published_at, created_at) DESC`
  );
  res.json({ ok: true, documents });
});

app.get("/api/legal-documents/:id", (req, res) => {
  const document = queryOne(
    `SELECT id, title, summary, content, document_number AS documentNumber, issuing_body AS issuingBody,
            issued_date AS issuedDate, effective_date AS effectiveDate, source_url AS sourceUrl, image_url AS imageUrl,
            published_at AS publishedAt
     FROM legal_documents WHERE id = ? AND status = 'published'`,
    [req.params.id]
  );
  if (!document) return res.status(404).json({ ok: false, error: "Khong tim thay van ban." });
  res.json({ ok: true, document });
});

app.get("/api/admin/legal-documents", requireAdmin, (req, res) => {
  const documents = queryAll(
    `SELECT id, title, summary, content, document_number AS documentNumber, issuing_body AS issuingBody,
            issued_date AS issuedDate, effective_date AS effectiveDate, source_url AS sourceUrl, image_url AS imageUrl,
            status, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt,
            published_at AS publishedAt
     FROM legal_documents ORDER BY updated_at DESC`
  );
  res.json({ ok: true, documents });
});

app.post("/api/admin/legal-documents", requireAdmin, (req, res) => {
  const document = normalizeLegalDocument(req.body || {});
  const validationError = validateLegalDocument(document);
  if (validationError) return res.status(400).json({ ok: false, error: validationError });

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const publishedAt = document.status === "published" ? now : null;
  legalDatabase.run(
    `INSERT INTO legal_documents
     (id, title, summary, content, document_number, issuing_body, issued_date, effective_date, source_url, image_url, status, created_by, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, document.title, document.summary, document.content, document.documentNumber, document.issuingBody,
      document.issuedDate || null, document.effectiveDate || null, document.sourceUrl, document.imageUrl, document.status,
      req.admin.username, now, now, publishedAt]
  );
  persistDatabase();
  res.status(201).json({ ok: true, document: queryOne("SELECT * FROM legal_documents WHERE id = ?", [id]) });
});

app.put("/api/admin/legal-documents/:id", requireAdmin, (req, res) => {
  const existing = queryOne("SELECT id, published_at AS publishedAt FROM legal_documents WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ ok: false, error: "Khong tim thay van ban." });
  const document = normalizeLegalDocument(req.body || {});
  const validationError = validateLegalDocument(document);
  if (validationError) return res.status(400).json({ ok: false, error: validationError });

  const now = new Date().toISOString();
  const publishedAt = document.status === "published" ? (existing.publishedAt || now) : null;
  legalDatabase.run(
    `UPDATE legal_documents SET title = ?, summary = ?, content = ?, document_number = ?, issuing_body = ?,
       issued_date = ?, effective_date = ?, source_url = ?, image_url = ?, status = ?, updated_at = ?, published_at = ? WHERE id = ?`,
    [document.title, document.summary, document.content, document.documentNumber, document.issuingBody,
      document.issuedDate || null, document.effectiveDate || null, document.sourceUrl, document.imageUrl, document.status, now,
      publishedAt, req.params.id]
  );
  persistDatabase();
  res.json({ ok: true, document: queryOne("SELECT * FROM legal_documents WHERE id = ?", [req.params.id]) });
});

app.delete("/api/admin/legal-documents/:id", requireAdmin, (req, res) => {
  const existing = queryOne("SELECT id FROM legal_documents WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ ok: false, error: "Khong tim thay van ban." });
  legalDatabase.run("DELETE FROM legal_documents WHERE id = ?", [req.params.id]);
  persistDatabase();
  res.json({ ok: true });
});

const PORT = Number(process.env.PORT || 3000);
async function start() {
  const storage = await createDatabase();
  legalDatabase = storage.database;
  persistDatabase = storage.save;
  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    console.log(`Legal documents database: ${storage.databaseFile}`);
    if (!createTransporter() || !getFromAddress()) {
      console.warn("SMTP not ready yet. Configure backend/.env to enable automatic email sending.");
    }
  });
}

start().catch((error) => {
  console.error("Could not start database:", error);
  process.exit(1);
});
