document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("legalDocumentsList");
  const notice = document.getElementById("legalPublicNotice");
  const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const date = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value)) : "";
  try {
    const documentId = new URLSearchParams(window.location.search).get("id");
    if (documentId) {
      const response = await fetch(`/api/legal-documents/${encodeURIComponent(documentId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tải được văn bản.");
      const doc = data.document;
      document.title = `${doc.title} | NHT`;
      notice.innerHTML = `<a href="thong-tu-phap-luat.html" class="font-bold text-brand hover:underline">← Tất cả thông tư</a>`;
      list.className = "mt-5";
      list.innerHTML = `<article class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">${doc.imageUrl ? `<img src="${escapeHtml(doc.imageUrl)}" alt="${escapeHtml(doc.title)}" class="mb-7 h-72 w-full rounded-xl object-cover" />` : ""}<p class="text-xs font-bold uppercase tracking-wider text-brand">${escapeHtml([doc.documentNumber, doc.issuingBody].filter(Boolean).join(" · ") || "Thông tin pháp lý")}</p><h1 class="mt-3 text-3xl font-extrabold leading-tight text-navy">${escapeHtml(doc.title)}</h1><p class="mt-4 whitespace-pre-line text-lg leading-relaxed text-slate-600">${escapeHtml(doc.summary)}</p><div class="my-7 border-t border-slate-200"></div><div class="whitespace-pre-line leading-8 text-slate-700">${escapeHtml(doc.content)}</div>${doc.sourceUrl ? `<a class="mt-8 inline-flex font-bold text-brand hover:underline" href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener noreferrer">Xem văn bản gốc →</a>` : ""}</article>`;
      return;
    }
    const response = await fetch("/api/legal-documents");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không tải được văn bản.");
    const documents = data.documents || [];
    if (!documents.length) { notice.textContent = "Chưa có thông tư nào được công khai."; return; }
    notice.textContent = `${documents.length} văn bản đã được cập nhật.`;
    list.innerHTML = documents.map((doc) => `<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">${doc.imageUrl ? `<img src="${escapeHtml(doc.imageUrl)}" alt="${escapeHtml(doc.title)}" class="h-48 w-full object-cover" />` : ""}<div class="p-6"><p class="text-xs font-bold uppercase tracking-wider text-brand">${escapeHtml([doc.documentNumber, doc.issuingBody].filter(Boolean).join(" · ") || "Thông tin pháp lý")}</p><h2 class="mt-3 text-xl font-extrabold leading-snug text-navy">${escapeHtml(doc.title)}</h2><p class="mt-3 whitespace-pre-line leading-relaxed text-slate-600">${escapeHtml(doc.summary)}</p><div class="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500"><span>${doc.effectiveDate ? `Hiệu lực: ${escapeHtml(date(doc.effectiveDate))}` : ""}</span><a class="font-bold text-brand hover:underline" href="thong-tu-phap-luat.html?id=${encodeURIComponent(doc.id)}">Đọc chi tiết →</a></div></div></article>`).join("");
  } catch (error) { notice.textContent = error.message || "Có lỗi xảy ra."; notice.className = "mt-8 text-sm font-medium text-red-600"; }
});
