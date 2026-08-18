document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const loginForm = $("adminLoginForm");
  const isDashboard = Boolean($("legalDocumentsTableBody"));
  let legalDocuments = [];
  let consultationRequests = [];

  const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const formatDate = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";
  const setNotice = (id, text, tone = "muted") => {
    const el = $(id); if (!el) return;
    el.textContent = text;
    el.className = `${el.dataset.noticeBase || ""} text-sm font-medium ${tone === "error" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-slate-500"}`.trim();
  };
  const api = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Không thể xử lý yêu cầu.");
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
    if ($("legalImagePublicId")) $("legalImagePublicId").value = "";
    if ($("legalImagePreview")) { $("legalImagePreview").src = ""; $("legalImagePreview").classList.add("hidden"); }
    if ($("saveLegalDocumentBtn")) $("saveLegalDocumentBtn").textContent = "Lưu văn bản";
    setNotice("legalNotice", "");
  };
  const renderLegalDocuments = () => {
    const table = $("legalDocumentsTableBody"); if (!table) return;
    if (!legalDocuments.length) { table.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-slate-500">Chua co van ban nao.</td></tr>'; return; }
    table.innerHTML = legalDocuments.map((doc) => `<tr class="align-top hover:bg-slate-50"><td class="px-5 py-4"><p class="font-bold text-navy">${escapeHtml(doc.title)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml([doc.documentNumber, doc.issuingBody].filter(Boolean).join(" · ") || "Chua co so van ban")}</p></td><td class="px-5 py-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${doc.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}">${doc.status === "published" ? "Cong khai" : "Ban nhap"}</span></td><td class="whitespace-nowrap px-5 py-4 text-slate-600">${escapeHtml(formatDate(doc.updatedAt))}</td><td class="whitespace-nowrap px-5 py-4"><button data-edit="${doc.id}" class="mr-3 font-bold text-brand hover:underline">Sua</button><button data-delete="${doc.id}" class="font-bold text-red-600 hover:underline">Xoa</button></td></tr>`).join("");
  };
  const loadLegalDocuments = async () => { legalDocuments = (await api("/api/admin/legal-documents")).documents || []; renderLegalDocuments(); };
  const displayValue = (value, fallback = "Không cung cấp") => String(value || "").trim() || fallback;
  const renderConsultationRequests = () => {
    const table = $("consultationRequestsTableBody");
    const count = $("consultationRequestCount");
    const exportButton = $("exportLeadsBtn");
    if (!table) return;
    if (count) count.textContent = `${consultationRequests.length} yêu cầu`;
    if (exportButton) exportButton.disabled = consultationRequests.length === 0;
    if (!consultationRequests.length) {
      table.innerHTML = '<tr><td colspan="7" class="px-5 py-10 text-center text-slate-500">Chưa có yêu cầu tư vấn nào.</td></tr>';
      setNotice("consultationRequestsNotice", "");
      return;
    }
    table.innerHTML = consultationRequests.map((lead) => {
      const message = displayValue(lead.message, "Không có lời nhắn");
      return `<tr class="align-top transition hover:bg-slate-50/80">
        <td class="whitespace-nowrap px-5 py-4 text-slate-600">${escapeHtml(formatDate(lead.createdAt))}</td>
        <td class="px-5 py-4"><p class="font-bold text-navy">${escapeHtml(displayValue(lead.name))}</p></td>
        <td class="px-5 py-4"><p class="font-semibold text-slate-700">${escapeHtml(displayValue(lead.phone))}</p><p class="mt-1 max-w-[230px] break-all text-xs text-slate-500">${escapeHtml(displayValue(lead.email))}</p></td>
        <td class="px-5 py-4"><p class="font-semibold text-slate-700">${escapeHtml(displayValue(lead.company))}</p><p class="mt-1 text-xs text-slate-500">MST/CCCD: ${escapeHtml(displayValue(lead.taxCode))}</p></td>
        <td class="px-5 py-4 text-slate-600">${escapeHtml(displayValue(lead.service))}</td>
        <td class="max-w-[280px] px-5 py-4 text-slate-600"><p class="line-clamp-2" title="${escapeHtml(message)}">${escapeHtml(message)}</p></td>
        <td class="whitespace-nowrap px-5 py-4 text-right"><button type="button" data-view-lead="${lead.id}" class="font-bold text-brand hover:underline">Xem đầy đủ</button></td>
      </tr>`;
    }).join("");
    setNotice("consultationRequestsNotice", `Đang hiển thị ${consultationRequests.length} yêu cầu tư vấn.`, "success");
  };
  const loadConsultationRequests = async () => {
    consultationRequests = (await api("/api/leads")).leads || [];
    renderConsultationRequests();
  };
  const openConsultationRequest = (lead) => {
    const dialog = $("consultationRequestDialog");
    const content = $("consultationDialogContent");
    if (!dialog || !content || !lead) return;
    const fields = [
      ["Thời gian gửi", formatDate(lead.createdAt)],
      ["Họ và tên", displayValue(lead.name)],
      ["Số điện thoại", displayValue(lead.phone)],
      ["Email", displayValue(lead.email)],
      ["Tên công ty", displayValue(lead.company)],
      ["Mã số thuế/CCCD", displayValue(lead.taxCode)],
      ["Dịch vụ quan tâm", displayValue(lead.service)],
      ["Lời nhắn", displayValue(lead.message, "Không có lời nhắn")],
      ["Email khách hàng", displayValue(lead.customerMailStatus, "Không xác định")],
      ["Email quản trị", displayValue(lead.adminMailStatus, "Không xác định")],
    ];
    content.innerHTML = fields.map(([label, value], index) => `<div class="${index === 7 ? "sm:col-span-2" : ""}"><p class="text-xs font-bold uppercase tracking-wider text-slate-400">${escapeHtml(label)}</p><p class="mt-1.5 whitespace-pre-wrap break-words text-sm font-semibold text-slate-700">${escapeHtml(value)}</p></div>`).join("");
    $("consultationDialogTitle").textContent = displayValue(lead.name, "Chi tiết khách hàng");
    dialog.showModal();
  };
  const exportConsultationRequests = async () => {
    const button = $("exportLeadsBtn");
    if (!button || button.disabled) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Đang tạo file...";
    setNotice("consultationRequestsNotice", "Đang chuẩn bị file Excel...");
    try {
      const response = await fetch("/api/leads/export");
      if (response.status === 401) { redirectToLogin(); return; }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Không thể tạo file Excel.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "yeu-cau-tu-van-NHT.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("consultationRequestsNotice", "Đã tải xuống danh sách yêu cầu tư vấn.", "success");
    } catch (error) {
      setNotice("consultationRequestsNotice", error.message, "error");
    } finally {
      button.disabled = consultationRequests.length === 0;
      button.textContent = originalText;
    }
  };
  const redirectToLogin = () => { location.replace("admin-login.html"); };
  const ensureDashboardSession = async () => {
    const user = await checkSession();
    if (!user) redirectToLogin();
    return user;
  };
  const loadDashboard = async () => {
    try { const user = await ensureDashboardSession(); if (!user) return; $("adminUser").textContent = user.username; await Promise.all([loadLegalDocuments(), loadConsultationRequests()]); setNotice("adminNotice", "Dữ liệu đã được cập nhật.", "success"); }
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
  $("exportLeadsBtn")?.addEventListener("click", exportConsultationRequests);
  $("consultationRequestsTableBody")?.addEventListener("click", (event) => {
    const id = event.target.closest("[data-view-lead]")?.dataset.viewLead;
    if (id) openConsultationRequest(consultationRequests.find((lead) => lead.id === id));
  });
  $("closeConsultationDialogBtn")?.addEventListener("click", () => $("consultationRequestDialog")?.close());
  $("consultationRequestDialog")?.addEventListener("click", (event) => {
    if (event.target === $("consultationRequestDialog")) $("consultationRequestDialog").close();
  });
  $("resetLegalFormBtn")?.addEventListener("click", resetForm);
  $("legalImage")?.addEventListener("change", () => { const file = $("legalImage").files[0]; if (!file) return; $("legalImagePreview").src = URL.createObjectURL(file); $("legalImagePreview").classList.remove("hidden"); });
  $("legalDocumentForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const id = $("legalDocumentId").value; try { const imageFile = $("legalImage")?.files[0]; if (imageFile) { setNotice("legalNotice", "Dang tai anh len Cloudinary..."); const formData = new FormData(); formData.append("image", imageFile); const imageResult = await api("/api/admin/legal-documents/upload-image", { method: "POST", body: formData }); $("legalImageUrl").value = imageResult.imageUrl; $("legalImagePublicId").value = imageResult.imagePublicId; } const payload = { title: $("legalTitle").value, documentNumber: $("legalDocumentNumber").value, issuingBody: $("legalIssuingBody").value, issuedDate: $("legalIssuedDate").value, effectiveDate: $("legalEffectiveDate").value, summary: $("legalSummary").value, content: $("legalContent").value, sourceUrl: $("legalSourceUrl").value, imageUrl: $("legalImageUrl").value, imagePublicId: $("legalImagePublicId").value, status: $("legalStatus").value }; await api(id ? `/api/admin/legal-documents/${id}` : "/api/admin/legal-documents", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); setNotice("legalNotice", "Da luu van ban.", "success"); resetForm(); await loadLegalDocuments(); } catch (error) { setNotice("legalNotice", error.message, "error"); } });
  $("legalDocumentsTableBody")?.addEventListener("click", async (event) => { const id = event.target.dataset.edit || event.target.dataset.delete; if (!id) return; const doc = legalDocuments.find((item) => item.id === id); if (event.target.dataset.edit && doc) { $("legalDocumentId").value = doc.id; $("legalTitle").value = doc.title || ""; $("legalDocumentNumber").value = doc.documentNumber || ""; $("legalIssuingBody").value = doc.issuingBody || ""; $("legalIssuedDate").value = doc.issuedDate || ""; $("legalEffectiveDate").value = doc.effectiveDate || ""; $("legalIssuedDateDisplay").value = formatVietnameseDate(doc.issuedDate); $("legalEffectiveDateDisplay").value = formatVietnameseDate(doc.effectiveDate); $("legalSummary").value = doc.summary || ""; $("legalContent").value = doc.content || ""; $("legalSourceUrl").value = doc.sourceUrl || ""; $("legalImageUrl").value = doc.imageUrl || ""; $("legalImagePublicId").value = doc.imagePublicId || ""; if (doc.imageUrl) { $("legalImagePreview").src = doc.imageUrl; $("legalImagePreview").classList.remove("hidden"); } else { $("legalImagePreview").classList.add("hidden"); } $("legalStatus").value = doc.status; $("saveLegalDocumentBtn").textContent = "Cap nhat van ban"; window.scrollTo({ top: 0, behavior: "smooth" }); } if (event.target.dataset.delete && confirm(`Xoa van ban "${doc?.title || ""}"?`)) { try { await api(`/api/admin/legal-documents/${id}`, { method: "DELETE" }); await loadLegalDocuments(); } catch (error) { setNotice("legalNotice", error.message, "error"); } } });
  $("logoutBtn")?.addEventListener("click", async () => { await fetch("/api/admin/logout", { method: "POST" }); redirectToLogin(); });
});
