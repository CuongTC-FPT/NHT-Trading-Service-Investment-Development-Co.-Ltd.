const path = require("path");
const express = require("express");

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
const PORT = Number(process.env.PORT || 3000);

function setNoStoreHeaders(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
}

async function start() {
  const database = await createDatabase();
  const app = express();

  app.use(express.json({ limit: "32kb" }));

  app.get("/admin.html", (req, res) => {
    setNoStoreHeaders(res);
    if (!getAdminSession(req)) return res.redirect("/admin-login.html");
    return res.sendFile(path.join(HTML_ROOT, "admin.html"));
  });

  app.get("/admin-login.html", (_req, res) => {
    setNoStoreHeaders(res);
    return res.sendFile(path.join(HTML_ROOT, "admin-login.html"));
  });

  app.use(express.static(HTML_ROOT));
  app.use(express.static(PICTURE_ROOT));
  app.use(express.static(FRONTEND_ROOT));

  app.use("/api/admin", authRoutes);
  app.use("/api/contact", createContactRoutes(database));
  app.use("/api/leads", createLeadsRoutes(database));
  app.use("/api", createLegalDocumentRoutes(database));

  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    console.log("Legal documents and contact leads database: PostgreSQL");
    if (!isMailConfigured()) {
      console.warn("SMTP not ready yet. Configure backend/.env to enable automatic email sending.");
    }
  });
}

start().catch((error) => {
  console.error("Could not start database:", error);
  process.exit(1);
});
