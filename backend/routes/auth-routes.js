const express = require("express");
const { rateLimit } = require("express-rate-limit");
const {
  clearAdminCookie,
  createAdminSession,
  getAdminPassword,
  getAdminUsername,
  getSessionSecret,
  requireAdmin,
  safeEqual,
  setAdminCookie,
} = require("../middleware/admin-auth");

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { ok: false, error: "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút." },
});

router.post("/login", loginLimiter, (req, res) => {
  const configuredPassword = getAdminPassword();
  if (!configuredPassword || !getSessionSecret()) {
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
  return res.json({ ok: true, user: { username } });
});

router.post("/logout", (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ ok: true, user: { username: req.admin.username } });
});

module.exports = router;
