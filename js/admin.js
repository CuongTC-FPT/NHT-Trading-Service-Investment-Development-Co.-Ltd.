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
    el.classList.toggle("hidden", !text);
    if (!text) return;
    el.className = `${el.dataset.noticeBase || ""} text-sm font-medium ${tone === "error" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-slate-500"}`.trim();
  };
  let adminNoticeTimer;
  const showAdminNotice = (text, tone = "success") => {
    const notice = $("adminNotice");
    if (!notice) return;
    clearTimeout(adminNoticeTimer);
    notice.textContent = text;
    notice.className = `pointer-events-none fixed left-1/2 top-20 z-50 -translate-x-1/2 translate-y-0 rounded-xl border bg-white px-5 py-3 text-sm font-bold opacity-100 shadow-xl transition-all duration-300 ${tone === "error" ? "border-red-200 text-red-600" : "border-emerald-200 text-emerald-600"}`;
    adminNoticeTimer = setTimeout(() => {
      notice.classList.remove("translate-y-0", "opacity-100");
      notice.classList.add("-translate-y-4", "opacity-0");
    }, tone === "error" ? 5000 : 2800);
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

  const legalStatusLabels = { draft: "Bản nháp", published: "Công khai" };
  const closeLegalStatusMenu = ({ restoreFocus = false } = {}) => {
    const menu = $("legalStatusMenu");
    const toggle = $("legalStatusToggle");
    if (!menu || !toggle) return;
    menu.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector("[aria-hidden]")?.classList.remove("rotate-180");
    if (restoreFocus) toggle.focus();
  };
  const syncLegalStatusControl = () => {
    const select = $("legalStatus");
    const value = $("legalStatusValue");
    if (!select || !value) return;
    value.textContent = legalStatusLabels[select.value] || legalStatusLabels.draft;
    document.querySelectorAll("[data-legal-status]").forEach((option) => {
      const selected = option.dataset.legalStatus === select.value;
      option.setAttribute("aria-selected", String(selected));
      option.classList.toggle("bg-brand/5", selected);
      option.classList.toggle("text-brand", selected);
      option.classList.toggle("text-slate-700", !selected);
      option.querySelector("[data-status-check]")?.classList.toggle("invisible", !selected);
    });
  };
  const openLegalStatusMenu = () => {
    const menu = $("legalStatusMenu");
    const toggle = $("legalStatusToggle");
    if (!menu || !toggle) return;
    menu.classList.remove("hidden");
    toggle.setAttribute("aria-expanded", "true");
    toggle.querySelector("[aria-hidden]")?.classList.add("rotate-180");
    menu.querySelector('[aria-selected="true"]')?.focus();
  };
  const selectLegalStatus = (status) => {
    const select = $("legalStatus");
    if (!select || !legalStatusLabels[status]) return;
    select.value = status;
    syncLegalStatusControl();
    closeLegalStatusMenu({ restoreFocus: true });
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
    syncLegalStatusControl();
    setNotice("legalNotice", "");
  };
  const renderLegalDocuments = () => {
    const table = $("legalDocumentsTableBody"); if (!table) return;
    if (!legalDocuments.length) { table.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-slate-500">Chua co van ban nao.</td></tr>'; return; }
    table.innerHTML = legalDocuments.map((doc) => `<tr class="align-top hover:bg-slate-50"><td class="px-5 py-4"><p class="font-bold text-navy">${escapeHtml(doc.title)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml([doc.documentNumber, doc.issuingBody].filter(Boolean).join(" · ") || "Chưa có số văn bản")}</p></td><td class="px-5 py-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${doc.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}">${doc.status === "published" ? "Công khai" : "Bản nháp"}</span></td><td class="whitespace-nowrap px-5 py-4 text-slate-600">${escapeHtml(formatDate(doc.updatedAt))}</td><td class="whitespace-nowrap px-5 py-4"><button data-edit="${doc.id}" class="mr-3 font-bold text-brand hover:underline">Sửa</button><button data-delete="${doc.id}" class="font-bold text-red-600 hover:underline">Xóa</button></td></tr>`).join("");
  };
  const loadLegalDocuments = async () => { legalDocuments = (await api("/api/admin/legal-documents")).documents || []; renderLegalDocuments(); };
  const displayValue = (value, fallback = "Không cung cấp") => String(value || "").trim() || fallback;
  const processingStatusLabel = (status) => status === "completed" ? "Đã hoàn thành" : status === "in_progress" ? "Đang xử lý" : "Mới";
  const mailStatusLabel = (status) => status === "sent" ? "Sent" : displayValue(status, "Không xác định");
  const processingStatusClass = (status) => status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "in_progress" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-sky-200 bg-sky-50 text-sky-700";
  const renderConsultationRequests = () => {
    const table = $("consultationRequestsTableBody");
    const exportButton = $("exportLeadsBtn");
    if (!table) return;
    if (exportButton) exportButton.disabled = consultationRequests.length === 0;
    if (!consultationRequests.length) {
      table.innerHTML = '<tr><td colspan="8" class="px-5 py-10 text-center text-slate-500">Chưa có yêu cầu tư vấn nào.</td></tr>';
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
        <td class="px-5 py-4"><div data-status-control class="relative inline-block"><button type="button" data-status-toggle="${lead.id}" aria-haspopup="menu" aria-expanded="false" class="inline-flex min-w-36 items-center justify-between gap-3 rounded-full border px-3.5 py-2 text-xs font-bold shadow-sm transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-brand/10 ${processingStatusClass(lead.processingStatus)}"><span>${escapeHtml(processingStatusLabel(lead.processingStatus))}</span><span aria-hidden="true" class="text-[10px] opacity-70">▼</span></button><div data-status-menu="${lead.id}" class="absolute right-0 z-30 mt-2 hidden min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" role="menu">${lead.processingStatus === "new" || !lead.processingStatus ? `<button type="button" data-set-lead-status="new" data-lead-id="${lead.id}" class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-sky-700 transition hover:bg-sky-50" role="menuitem"><span class="h-2 w-2 rounded-full bg-sky-500"></span>Mới</button>` : ""}<button type="button" data-set-lead-status="in_progress" data-lead-id="${lead.id}" class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-amber-700 transition hover:bg-amber-50" role="menuitem"><span class="h-2 w-2 rounded-full bg-amber-500"></span>Đang xử lý</button><button type="button" data-set-lead-status="completed" data-lead-id="${lead.id}" class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-emerald-700 transition hover:bg-emerald-50" role="menuitem"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>Đã hoàn thành</button></div></div><p class="mt-2 text-xs text-slate-500">${lead.completedAt ? `Hoàn thành: ${escapeHtml(formatDate(lead.completedAt))}` : "Chưa hoàn thành"}</p></td>
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
      ["Trạng thái xử lý", processingStatusLabel(lead.processingStatus)],
      ["Ngày hoàn thành", lead.completedAt ? formatDate(lead.completedAt) : "Chưa hoàn thành"],
      ["Lời nhắn", displayValue(lead.message, "Không có lời nhắn")],
      ["Email khách hàng", mailStatusLabel(lead.customerMailStatus)],
      ["Email quản trị", mailStatusLabel(lead.adminMailStatus)],
    ];
    content.innerHTML = fields.map(([label, value], index) => `<div class="${index === 9 ? "sm:col-span-2" : ""}"><p class="text-xs font-bold uppercase tracking-wider text-slate-400">${escapeHtml(label)}</p><p class="mt-1.5 whitespace-pre-wrap break-words text-sm font-semibold text-slate-700">${escapeHtml(value)}</p></div>`).join("");
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
      setNotice("consultationRequestsNotice", `Đang hiển thị ${consultationRequests.length} yêu cầu tư vấn.`, "success");
      showAdminNotice("Đã tải xuống danh sách yêu cầu tư vấn.", "success");
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
  const loadDashboard = async ({ showRefreshNotice = false } = {}) => {
    try { const user = await ensureDashboardSession(); if (!user) return; $("adminUser").textContent = user.username; await Promise.all([loadLegalDocuments(), loadConsultationRequests()]); const justLoggedIn = sessionStorage.getItem("nhtAdminLoginSuccess") === "true"; sessionStorage.removeItem("nhtAdminLoginSuccess"); if (justLoggedIn) showAdminNotice("Đăng nhập thành công.", "success"); else if (showRefreshNotice) showAdminNotice("Dữ liệu đã được cập nhật.", "success"); }
    catch (error) { showAdminNotice(error.message, "error"); }
  };

  if (loginForm) {
    checkSession().then((user) => {
      if (user) {
        location.replace(getAdminRedirect());
        return;
      }
      $("adminLoginPage")?.classList.remove("invisible");
    });
    loginForm.addEventListener("submit", async (event) => { event.preventDefault(); const button = loginForm.querySelector("button"); button.disabled = true; try { await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: $("adminUsername").value.trim(), password: $("adminPassword").value }) }); sessionStorage.setItem("nhtAdminLoginSuccess", "true"); location.href = getAdminRedirect(); } catch (error) { setNotice("adminLoginNotice", error.message, "error"); } finally { button.disabled = false; } });
  }
  if (!isDashboard) return;
  setupDateField("legalIssuedDate");
  setupDateField("legalEffectiveDate");
  syncLegalStatusControl();
  const navigationType = performance.getEntriesByType("navigation")[0]?.type;
  loadDashboard({ showRefreshNotice: navigationType === "reload" });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) ensureDashboardSession();
  });
  $("refreshAdminBtn")?.addEventListener("click", () => loadDashboard({ showRefreshNotice: true }));
  $("exportLeadsBtn")?.addEventListener("click", exportConsultationRequests);
  const closeStatusMenus = () => {
    document.querySelectorAll("[data-status-menu]").forEach((menu) => {
      menu.classList.add("hidden");
      menu.removeAttribute("style");
    });
    document.querySelectorAll("[data-status-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
  };
  $("consultationRequestsTableBody")?.addEventListener("click", async (event) => {
    const viewId = event.target.closest("[data-view-lead]")?.dataset.viewLead;
    if (viewId) { openConsultationRequest(consultationRequests.find((lead) => lead.id === viewId)); return; }

    const toggle = event.target.closest("[data-status-toggle]");
    if (toggle) {
      const menu = document.querySelector(`[data-status-menu="${toggle.dataset.statusToggle}"]`);
      const shouldOpen = menu?.classList.contains("hidden");
      closeStatusMenus();
      if (menu && shouldOpen) {
        const rect = toggle.getBoundingClientRect();
        menu.classList.remove("hidden");
        menu.style.position = "fixed";
        menu.style.top = `${rect.bottom + 8}px`;
        menu.style.left = `${Math.max(12, rect.right - menu.offsetWidth)}px`;
        menu.style.right = "auto";
        toggle.setAttribute("aria-expanded", "true");
      }
      return;
    }

    const statusButton = event.target.closest("[data-set-lead-status]");
    if (!statusButton) return;
    const lead = consultationRequests.find((item) => item.id === statusButton.dataset.leadId);
    if (!lead) return;
    const previousStatus = lead.processingStatus || "new";
    closeStatusMenus();
    statusButton.disabled = true;
    setNotice("consultationRequestsNotice", "Đang cập nhật trạng thái xử lý...");
    try {
      const result = await api(`/api/leads/${encodeURIComponent(lead.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processingStatus: statusButton.dataset.setLeadStatus }),
      });
      lead.processingStatus = result.lead.processingStatus;
      lead.completedAt = result.lead.completedAt;
      renderConsultationRequests();
      setNotice("consultationRequestsNotice", "");
    } catch (error) {
      lead.processingStatus = previousStatus;
      renderConsultationRequests();
      setNotice("consultationRequestsNotice", error.message, "error");
    }
  });
  document.addEventListener("click", (event) => { if (!event.target.closest("[data-status-control]")) closeStatusMenus(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeStatusMenus(); });
  window.addEventListener("scroll", closeStatusMenus, true);
  $("closeConsultationDialogBtn")?.addEventListener("click", () => $("consultationRequestDialog")?.close());
  $("consultationRequestDialog")?.addEventListener("click", (event) => {
    if (event.target === $("consultationRequestDialog")) $("consultationRequestDialog").close();
  });
  $("resetLegalFormBtn")?.addEventListener("click", resetForm);
  $("legalStatusToggle")?.addEventListener("click", () => {
    $("legalStatusMenu")?.classList.contains("hidden") ? openLegalStatusMenu() : closeLegalStatusMenu();
  });
  $("legalStatusToggle")?.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openLegalStatusMenu();
    }
  });
  $("legalStatusMenu")?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-legal-status]");
    if (option) selectLegalStatus(option.dataset.legalStatus);
  });
  $("legalStatusMenu")?.addEventListener("keydown", (event) => {
    const options = [...event.currentTarget.querySelectorAll("[data-legal-status]")];
    const index = options.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); closeLegalStatusMenu({ restoreFocus: true }); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); document.activeElement?.click(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowDown" ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
    options[nextIndex]?.focus();
  });
  document.addEventListener("click", (event) => { if (!event.target.closest("#legalStatusControl")) closeLegalStatusMenu(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeLegalStatusMenu(); });
  $("legalImage")?.addEventListener("change", () => { const file = $("legalImage").files[0]; if (!file) return; $("legalImagePreview").src = URL.createObjectURL(file); $("legalImagePreview").classList.remove("hidden"); });
  $("legalDocumentForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const id = $("legalDocumentId").value; try { const imageFile = $("legalImage")?.files[0]; if (imageFile) { setNotice("legalNotice", "Dang tai anh len Cloudinary..."); const formData = new FormData(); formData.append("image", imageFile); const imageResult = await api("/api/admin/legal-documents/upload-image", { method: "POST", body: formData }); $("legalImageUrl").value = imageResult.imageUrl; $("legalImagePublicId").value = imageResult.imagePublicId; } const payload = { title: $("legalTitle").value, documentNumber: $("legalDocumentNumber").value, issuingBody: $("legalIssuingBody").value, issuedDate: $("legalIssuedDate").value, effectiveDate: $("legalEffectiveDate").value, summary: $("legalSummary").value, content: $("legalContent").value, sourceUrl: $("legalSourceUrl").value, imageUrl: $("legalImageUrl").value, imagePublicId: $("legalImagePublicId").value, status: $("legalStatus").value }; await api(id ? `/api/admin/legal-documents/${id}` : "/api/admin/legal-documents", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); setNotice("legalNotice", "Da luu van ban.", "success"); resetForm(); await loadLegalDocuments(); } catch (error) { setNotice("legalNotice", error.message, "error"); } });
  $("legalDocumentsTableBody")?.addEventListener("click", async (event) => { const id = event.target.dataset.edit || event.target.dataset.delete; if (!id) return; const doc = legalDocuments.find((item) => item.id === id); if (event.target.dataset.edit && doc) { $("legalDocumentId").value = doc.id; $("legalTitle").value = doc.title || ""; $("legalDocumentNumber").value = doc.documentNumber || ""; $("legalIssuingBody").value = doc.issuingBody || ""; $("legalIssuedDate").value = doc.issuedDate || ""; $("legalEffectiveDate").value = doc.effectiveDate || ""; $("legalIssuedDateDisplay").value = formatVietnameseDate(doc.issuedDate); $("legalEffectiveDateDisplay").value = formatVietnameseDate(doc.effectiveDate); $("legalSummary").value = doc.summary || ""; $("legalContent").value = doc.content || ""; $("legalSourceUrl").value = doc.sourceUrl || ""; $("legalImageUrl").value = doc.imageUrl || ""; $("legalImagePublicId").value = doc.imagePublicId || ""; if (doc.imageUrl) { $("legalImagePreview").src = doc.imageUrl; $("legalImagePreview").classList.remove("hidden"); } else { $("legalImagePreview").classList.add("hidden"); } $("legalStatus").value = doc.status; syncLegalStatusControl(); $("saveLegalDocumentBtn").textContent = "Cập nhật văn bản"; window.scrollTo({ top: 0, behavior: "smooth" }); } if (event.target.dataset.delete && confirm(`Xóa văn bản "${doc?.title || ""}"?`)) { try { await api(`/api/admin/legal-documents/${id}`, { method: "DELETE" }); await loadLegalDocuments(); } catch (error) { setNotice("legalNotice", error.message, "error"); } } });
  $("logoutBtn")?.addEventListener("click", async () => { await fetch("/api/admin/logout", { method: "POST" }); redirectToLogin(); });
});
