const crypto = require("crypto");

const ADMIN_COOKIE_NAME = "nht_admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 3;

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
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + ADMIN_SESSION_TTL_MS,
  })).toString("base64url");
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

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: isTruthyEnv(process.env.COOKIE_SECURE),
    path: "/",
  };
}

function setAdminCookie(res, token) {
  res.cookie(ADMIN_COOKIE_NAME, token, cookieOptions());
}

function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, cookieOptions());
}

function requireAdmin(req, res, next) {
  const session = getAdminSession(req);
  if (!session) return res.status(401).json({ ok: false, error: "Chưa đăng nhập." });
  req.admin = session;
  next();
}

module.exports = {
  clearAdminCookie,
  createAdminSession,
  getAdminPassword,
  getAdminSession,
  getAdminUsername,
  getSessionSecret,
  requireAdmin,
  safeEqual,
  setAdminCookie,
};
