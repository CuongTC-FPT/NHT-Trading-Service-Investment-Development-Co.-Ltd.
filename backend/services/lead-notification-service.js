const { sendLeadEmails } = require("./mail-service");

// An atomic lease prevents concurrent admin retries from sending the same email.
// Expired leases can be retried if a process stopped during SMTP delivery.
async function notifyLead(database, lead) {
  const { rows } = await database.query(
    `UPDATE contact_leads SET mail_attempt_started_at = NOW()
     WHERE id = $1
       AND (mail_attempt_started_at IS NULL OR mail_attempt_started_at < NOW() - INTERVAL '10 minutes')
       AND (customer_mail_status <> 'sent' OR admin_mail_status <> 'sent')
     RETURNING customer_mail_status AS "customerMailStatus", admin_mail_status AS "adminMailStatus"`,
    [lead.id]
  );
  if (!rows.length) return { warning: "mail_pending" };
  const previous = rows[0];
  let customerStatus = previous.customerMailStatus;
  let adminStatus = previous.adminMailStatus;
  try {
    const mail = await sendLeadEmails(lead, {
      customer: customerStatus !== "sent", admin: adminStatus !== "sent",
    });
    if (!mail.configured) {
      if (customerStatus !== "sent") customerStatus = "not_configured";
      if (adminStatus !== "sent") adminStatus = "not_configured";
    } else {
      if (customerStatus !== "sent") customerStatus = mail.customerResult.ok ? "sent" : "failed";
      if (adminStatus !== "sent") adminStatus = !mail.hasAdminRecipient ? "not_configured" : mail.adminResult.ok ? "sent" : "failed";
    }
  } catch (error) {
    console.error("Lead email delivery failed:", error.message);
    if (customerStatus !== "sent") customerStatus = "failed";
    if (adminStatus !== "sent") adminStatus = "failed";
  }
  await database.query(
    `UPDATE contact_leads SET customer_mail_status = $1, admin_mail_status = $2,
     mail_attempt_started_at = NULL WHERE id = $3`,
    [customerStatus, adminStatus, lead.id]
  );
  return { customerMailStatus: customerStatus, adminMailStatus: adminStatus,
    ...(customerStatus !== "sent" || adminStatus !== "sent" ? { warning: "mail_pending" } : {}) };
}

module.exports = { notifyLead };
