document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const loginForm = $("adminLoginForm");
  const isDashboard = Boolean($("legalDocumentsTableBody"));
  let legalDocuments = [];

  const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const formatDate = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";
  const setNotice = (id, text, tone = "muted") => {
    const el = $(id); if (!el) return;
    el.textContent = text;
    el.className = `text-sm font-medium ${tone === "error" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-slate-500"}`;
  };
  const api = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Khong the xu ly yeu cau.");
    return data;
  };
  const checkSession = async () => { try { return (await api("/api/admin/me")).user; } catch { return null; } };
  const getAdminRedirect = () => {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    return redirect && /^admin\.html(?:#.*)?$/.test(redirect) ? redirect : "admin.html";
  };
  const formatVietnameseDate = (isoDate) => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  };
  const parseVietnameseDate = (value) => {
    const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return "";
    const [, day, month, year] = match;
    const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(`${isoDate}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getDate() === Number(day) && date.getMonth() + 1 === Number(month) ? isoDate : "";
  };
  const setupDateField = (dateId) => {
    const hidden = $(dateId); const display = $(`${dateId}Display`); const picker = document.querySelector(`[data-date-picker="${dateId}"]`);
    if (!hidden || !display) return;
    hidden.addEventListener("change", () => { display.value = formatVietnameseDate(hidden.value); });
    display.addEventListener("blur", () => { const isoDate = parseVietnameseDate(display.value); if (display.value && !isoDate) { display.setCustomValidity("Vui lòng nhập ngày theo định dạng dd/mm/yyyy."); display.reportValidity(); return; } display.setCustomValidity(""); hidden.value = isoDate; display.value = formatVietnameseDate(isoDate); });
    picker?.addEventListener("click", () => { if (typeof hidden.showPicker === "function") hidden.showPicker(); else hidden.focus(); });
  };

  const resetForm = () => {
    const form = $("legalDocumentForm");
    if (form) form.reset();
    if ($("legalIssuedDateDisplay")) $("legalIssuedDateDisplay").value = "";
    if ($("legalEffectiveDateDisplay")) $("legalEffectiveDateDisplay").value = "";
    if ($("legalDocumentId")) $("legalDocumentId").value = "";
    if ($("legalImageUrl")) $("legalImageUrl").value = "";
    if ($("legalImagePreview")) { $("legalImagePreview").src = ""; $("legalImagePreview").classList.add("hidden"); }
    if ($("saveLegalDocumentBtn")) $("saveLegalDocumentBtn").textContent = "Luu van ban";
    setNotice("legalNotice", "");
  };
  const renderLegalDocuments = () => {
    const table = $("legalDocumentsTableBody"); if (!table) return;
    if (!legalDocuments.length) { table.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-slate-500">Chua co van ban nao.</td></tr>'; return; }
    table.innerHTML = legalDocuments.map((doc) => `<tr class="align-top hover:bg-slate-50"><td class="px-5 py-4"><p class="font-bold text-navy">${escapeHtml(doc.title)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml([doc.documentNumber, doc.issuingBody].filter(Boolean).join(" · ") || "Chua co so van ban")}</p></td><td class="px-5 py-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${doc.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}">${doc.status === "published" ? "Cong khai" : "Ban nhap"}</span></td><td class="whitespace-nowrap px-5 py-4 text-slate-600">${escapeHtml(formatDate(doc.updatedAt))}</td><td class="whitespace-nowrap px-5 py-4"><button data-edit="${doc.id}" class="mr-3 font-bold text-brand hover:underline">Sua</button><button data-delete="${doc.id}" class="font-bold text-red-600 hover:underline">Xoa</button></td></tr>`).join("");
  };
  const loadLegalDocuments = async () => { legalDocuments = (await api("/api/admin/legal-documents")).documents || []; renderLegalDocuments(); };
  const redirectToLogin = () => { location.replace("admin-login.html"); };
  const ensureDashboardSession = async () => {
    const user = await checkSession();
    if (!user) redirectToLogin();
    return user;
  };
  const loadDashboard = async () => {
    try { const user = await ensureDashboardSession(); if (!user) return; $("adminUser").textContent = user.username; await loadLegalDocuments(); setNotice("adminNotice", "Du lieu da duoc cap nhat.", "success"); }
    catch (error) { setNotice("adminNotice", error.message, "error"); }
  };

  if (loginForm) {
    checkSession().then((user) => { if (user) location.href = getAdminRedirect(); });
    loginForm.addEventListener("submit", async (event) => { event.preventDefault(); const button = loginForm.querySelector("button"); button.disabled = true; try { await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: $("adminUsername").value.trim(), password: $("adminPassword").value }) }); location.href = getAdminRedirect(); } catch (error) { setNotice("adminLoginNotice", error.message, "error"); } finally { button.disabled = false; } });
  }
  if (!isDashboard) return;
  setupDateField("legalIssuedDate");
  setupDateField("legalEffectiveDate");
  loadDashboard();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) ensureDashboardSession();
  });
  $("refreshAdminBtn")?.addEventListener("click", loadDashboard);
  $("resetLegalFormBtn")?.addEventListener("click", resetForm);
  $("legalImage")?.addEventListener("change", () => { const file = $("legalImage").files[0]; if (!file) return; $("legalImagePreview").src = URL.createObjectURL(file); $("legalImagePreview").classList.remove("hidden"); });
  $("legalDocumentForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const id = $("legalDocumentId").value; try { const imageFile = $("legalImage")?.files[0]; if (imageFile) { setNotice("legalNotice", "Dang tai anh..."); const formData = new FormData(); formData.append("image", imageFile); const imageResult = await api("/api/admin/legal-documents/upload-image", { method: "POST", body: formData }); $("legalImageUrl").value = imageResult.imageUrl; } const payload = { title: $("legalTitle").value, documentNumber: $("legalDocumentNumber").value, issuingBody: $("legalIssuingBody").value, issuedDate: $("legalIssuedDate").value, effectiveDate: $("legalEffectiveDate").value, summary: $("legalSummary").value, content: $("legalContent").value, sourceUrl: $("legalSourceUrl").value, imageUrl: $("legalImageUrl").value, status: $("legalStatus").value }; await api(id ? `/api/admin/legal-documents/${id}` : "/api/admin/legal-documents", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); setNotice("legalNotice", "Da luu van ban.", "success"); resetForm(); await loadLegalDocuments(); } catch (error) { setNotice("legalNotice", error.message, "error"); } });
  $("legalDocumentsTableBody")?.addEventListener("click", async (event) => { const id = event.target.dataset.edit || event.target.dataset.delete; if (!id) return; const doc = legalDocuments.find((item) => item.id === id); if (event.target.dataset.edit && doc) { $("legalDocumentId").value = doc.id; $("legalTitle").value = doc.title || ""; $("legalDocumentNumber").value = doc.documentNumber || ""; $("legalIssuingBody").value = doc.issuingBody || ""; $("legalIssuedDate").value = doc.issuedDate || ""; $("legalEffectiveDate").value = doc.effectiveDate || ""; $("legalIssuedDateDisplay").value = formatVietnameseDate(doc.issuedDate); $("legalEffectiveDateDisplay").value = formatVietnameseDate(doc.effectiveDate); $("legalSummary").value = doc.summary || ""; $("legalContent").value = doc.content || ""; $("legalSourceUrl").value = doc.sourceUrl || ""; $("legalImageUrl").value = doc.imageUrl || ""; if (doc.imageUrl) { $("legalImagePreview").src = doc.imageUrl; $("legalImagePreview").classList.remove("hidden"); } else { $("legalImagePreview").classList.add("hidden"); } $("legalStatus").value = doc.status; $("saveLegalDocumentBtn").textContent = "Cap nhat van ban"; window.scrollTo({ top: 0, behavior: "smooth" }); } if (event.target.dataset.delete && confirm(`Xoa van ban "${doc?.title || ""}"?`)) { try { await api(`/api/admin/legal-documents/${id}`, { method: "DELETE" }); await loadLegalDocuments(); } catch (error) { setNotice("legalNotice", error.message, "error"); } } });
  $("logoutBtn")?.addEventListener("click", async () => { await fetch("/api/admin/logout", { method: "POST" }); redirectToLogin(); });
});
