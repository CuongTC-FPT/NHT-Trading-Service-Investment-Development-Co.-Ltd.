const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const EMAIL_LOGO_PATH = path.join(__dirname, "..", "..", "picture", "logo-transparent.webp");
const CUSTOMER_TEMPLATE = path.join(__dirname, "..", "uploads", "Customer Email", "code.html");
const ADMIN_TEMPLATE = path.join(__dirname, "..", "uploads", "Admin email", "code.html");

function isTruthyEnv(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTemplate(templatePath, values) {
  const template = fs.readFileSync(templatePath, "utf8");
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) =>
    escapeHtml(values[key] ?? "")
  );
}

function createTransporter() {
  const host = String(process.env.SMTP_HOST || "").trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const options = {
    host,
    port,
    secure: isTruthyEnv(process.env.SMTP_SECURE) || port === 465,
  };
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  if (user && pass) options.auth = { user, pass };
  return nodemailer.createTransport(options);
}

function getFromAddress() {
  return String(process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
}

function isMailConfigured() {
  return Boolean(createTransporter() && getFromAddress());
}

async function sendSafely(transporter, options) {
  try {
    return { ok: true, info: await transporter.sendMail(options) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

async function sendLeadEmails(lead) {
  const transporter = createTransporter();
  const fromAddr = getFromAddress();
  if (!transporter || !fromAddr) return { configured: false };

  const displayName = lead.name || "Quý khách";
  const now = new Date();
  const attachment = { filename: "nht-logo.webp", path: EMAIL_LOGO_PATH, cid: "nht-logo" };
  const customerResult = await sendSafely(transporter, {
    from: `"NHT" <${fromAddr}>`,
    to: lead.email,
    subject: process.env.MAIL_CUSTOMER_SUBJECT || "Đã nhận thông tin liên hệ - NHT",
    replyTo: fromAddr,
    text: `Cảm ơn khách hàng ${displayName} đã tin tưởng NHT\n\nThông tin quý khách cung cấp đã được bộ phận chuyên môn tiếp nhận và xử lý. Công ty TNHH Dịch vụ Tư vấn NHT sẽ chủ động liên hệ và phản hồi đến khách hàng trong vòng 24 giờ làm việc.\n\nĐây là email tự động, quý khách vui lòng không phản hồi email này.\n\nTrân trọng,\nĐội ngũ NHT`,
    html: renderTemplate(CUSTOMER_TEMPLATE, {
      name: displayName,
      date: new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(now),
      year: now.getFullYear(),
    }),
    attachments: [attachment],
  });

  const adminTo = String(process.env.ADMIN_EMAIL || "").trim();
  const adminResult = adminTo
    ? await sendSafely(transporter, {
        from: `"Website NHT" <${fromAddr}>`,
        to: adminTo,
        subject: "Yêu cầu tư vấn từ khách hàng",
        text: JSON.stringify(lead, null, 2),
        replyTo: lead.email,
        attachments: [attachment],
        html: renderTemplate(ADMIN_TEMPLATE, {
          name: lead.name || "Không cung cấp",
          email: lead.email,
          phone: lead.phone,
          company: lead.company || "Không cung cấp",
          taxCode: lead.taxCode,
          service: lead.service || "Không cung cấp",
          message: lead.message || "Không có lời nhắn",
          submittedAt: new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Ho_Chi_Minh",
          }).format(now),
          leadId: lead.id,
        }),
      })
    : { ok: true };

  return { configured: true, customerResult, adminResult, hasAdminRecipient: Boolean(adminTo) };
}

module.exports = { isMailConfigured, sendLeadEmails };
