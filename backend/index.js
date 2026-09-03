const path = require("path");
const express = require("express");
const compression = require("compression");
const helmet = require("helmet");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const { createDatabase } = require("./database");
const { getAdminSession } = require("./middleware/admin-auth");
const authRoutes = require("./routes/auth-routes");
const createContactRoutes = require("./routes/contact-routes");
const createLeadsRoutes = require("./routes/leads-routes");
const createLegalDocumentRoutes = require("./routes/legal-documents-routes");
const { isMailConfigured } = require("./services/mail-service");

const FRONTEND_ROOT = path.join(__dirname, "..");
const HTML_ROOT = path.join(FRONTEND_ROOT, "HTML");
const PICTURE_ROOT = path.join(FRONTEND_ROOT, "picture");
const CSS_ROOT = path.join(FRONTEND_ROOT, "css");
const JS_ROOT = path.join(FRONTEND_ROOT, "js");
const PDF_ROOT = path.join(FRONTEND_ROOT, "pdf");
const FONTS_ROOT = path.join(FRONTEND_ROOT, "fonts");
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_PAGES = [
  ["/", "weekly", "1.0"],
  ["/dich-vu.html", "monthly", "0.9"],
  ["/bang-gia.html", "monthly", "0.9"],
  ["/thong-tu-phap-luat.html", "weekly", "0.8"],
  ["/ve-chung-toi.html", "monthly", "0.7"],
  ["/lien-he.html", "monthly", "0.8"],
  ["/dieu-khoan.html", "yearly", "0.4"],
];

function publicBaseUrl(req) {
  return String(process.env.PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const required = ["DATABASE_URL", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"];
  const missing = required.filter((key) => !String(process.env[key] || "").trim());
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  if (String(process.env.ADMIN_PASSWORD).length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  if (String(process.env.ADMIN_SESSION_SECRET).length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  if (process.env.PUBLIC_SITE_URL) new URL(process.env.PUBLIC_SITE_URL);
}

function setNoStoreHeaders(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
}

async function start() {
  validateProductionConfig();
  const database = await createDatabase();
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }));
  app.use(compression());
  app.use(express.json({ limit: "32kb" }));

  app.use(["/admin.html", "/admin-login.html", "/api/admin", "/api/leads"], (_req, res, next) => {
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    next();
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin-login.html\nDisallow: /api/\nSitemap: ${publicBaseUrl(req)}/sitemap.xml\n`);
  });

  app.get("/sitemap.xml", (req, res) => {
    const baseUrl = publicBaseUrl(req);
    const urls = PUBLIC_PAGES.map(([url, frequency, priority]) =>
      `<url><loc>${baseUrl}${url}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`
    ).join("");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  });

  app.get(PUBLIC_PAGES.map(([url]) => url), (req, res, next) => {
    res.set("Link", `<${publicBaseUrl(req)}${req.path}>; rel="canonical"`);
    next();
  });

  app.get("/healthz", async (_req, res) => {
    try {
      await database.query("SELECT 1");
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get("/admin.html", (req, res) => {
    setNoStoreHeaders(res);
    if (!getAdminSession(req)) return res.redirect("/admin-login.html");
    return res.sendFile(path.join(HTML_ROOT, "admin.html"));
  });

  app.get("/admin-login.html", (_req, res) => {
    setNoStoreHeaders(res);
    return res.sendFile(path.join(HTML_ROOT, "admin-login.html"));
  });

  const staticOptions = { dotfiles: "deny", etag: true, maxAge: "1h" };
  app.use("/css", express.static(CSS_ROOT, staticOptions));
  app.use("/js", express.static(JS_ROOT, staticOptions));
  app.use("/picture", express.static(PICTURE_ROOT, staticOptions));
  app.use("/pdf", express.static(PDF_ROOT, staticOptions));
  app.use("/fonts", express.static(FONTS_ROOT, { ...staticOptions, maxAge: "30d", immutable: true }));
  app.use(express.static(HTML_ROOT, { ...staticOptions, maxAge: 0, index: "index.html" }));

  app.use("/api/admin", authRoutes);
  app.use("/api/contact", createContactRoutes(database));
  app.use("/api/leads", createLeadsRoutes(database));
  app.use("/api", createLegalDocumentRoutes(database));

  app.use("/api", (_req, res) => res.status(404).json({ ok: false, error: "Không tìm thấy API." }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ ok: false, error: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau." });
  });

  const server = app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    console.log("Legal documents and contact leads database: PostgreSQL");
    if (!isMailConfigured()) {
      console.warn("SMTP not ready yet. Configure backend/.env to enable automatic email sending.");
    }
  });

  const shutdown = (signal) => {
    console.log(`${signal}: shutting down`);
    server.close(async () => {
      await database.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Could not start database:", error);
  process.exit(1);
});
