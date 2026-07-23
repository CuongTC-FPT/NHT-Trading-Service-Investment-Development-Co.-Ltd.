document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("legalDocumentsList");
  const notice = document.getElementById("legalPublicNotice");
  if (!list || !notice) return;

  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
  const date = (value) => value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value))
    : "";

  const showLoading = () => {
    notice.textContent = "Đang tải văn bản...";
    list.innerHTML = Array.from({ length: 4 }, () => `
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-hidden="true">
        <div class="h-40 animate-pulse bg-slate-100"></div>
        <div class="space-y-3 p-6">
          <div class="h-3 w-1/3 animate-pulse rounded bg-slate-100"></div>
          <div class="h-6 w-4/5 animate-pulse rounded bg-slate-100"></div>
          <div class="h-4 w-full animate-pulse rounded bg-slate-100"></div>
        </div>
      </div>`).join("");
  };

  showLoading();

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
      list.innerHTML = `
        <article class="rounded-2xl border border-slate-200 bg-white p-6 shadow-premium md:p-10">
          ${doc.imageUrl ? `<img src="${escapeHtml(doc.imageUrl)}" alt="${escapeHtml(doc.title)}" class="mb-7 h-72 w-full rounded-xl object-cover" decoding="async" />` : ""}
          <p class="text-xs font-bold uppercase tracking-wider text-brand">${escapeHtml([doc.documentNumber, doc.issuingBody].filter(Boolean).join(" - ") || "Thông tin pháp lý")}</p>
          <h2 class="mt-3 text-3xl font-extrabold leading-tight text-navy">${escapeHtml(doc.title)}</h2>
          <p class="mt-4 whitespace-pre-line text-lg leading-relaxed text-slate-600">${escapeHtml(doc.summary)}</p>
          <div class="my-7 border-t border-slate-200"></div>
          <div class="whitespace-pre-line leading-8 text-slate-700">${escapeHtml(doc.content)}</div>
          ${doc.sourceUrl ? `<a class="mt-8 inline-flex font-bold text-brand hover:underline" href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener noreferrer">Xem văn bản gốc →</a>` : ""}
        </article>`;
      return;
    }

    const response = await fetch("/api/legal-documents");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không tải được văn bản.");

    const documents = data.documents || [];
    if (!documents.length) {
      notice.textContent = "Chưa có thông tư nào được công khai.";
      list.innerHTML = `
        <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center md:col-span-2">
          <h2 class="text-xl font-bold text-navy">Nội dung đang được cập nhật</h2>
          <p class="mx-auto mt-2 max-w-xl text-slate-600">Các thông tư mới sẽ được NHT đăng tại đây sau khi kiểm tra nội dung.</p>
        </div>`;
      return;
    }

    notice.textContent = `${documents.length} văn bản đã được cập nhật.`;
    list.innerHTML = documents.map((doc) => `
      <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-premium">
        ${doc.imageUrl ? `<img src="${escapeHtml(doc.imageUrl)}" alt="${escapeHtml(doc.title)}" class="h-48 w-full object-cover" loading="lazy" decoding="async" />` : ""}
        <div class="p-6">
          <p class="text-xs font-bold uppercase tracking-wider text-brand">${escapeHtml([doc.documentNumber, doc.issuingBody].filter(Boolean).join(" - ") || "Thông tin pháp lý")}</p>
          <h2 class="mt-3 text-xl font-extrabold leading-snug text-navy">${escapeHtml(doc.title)}</h2>
          <p class="mt-3 whitespace-pre-line leading-relaxed text-slate-600">${escapeHtml(doc.summary)}</p>
          <div class="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <span>${doc.effectiveDate ? `Hiệu lực: ${escapeHtml(date(doc.effectiveDate))}` : ""}</span>
            <a class="font-bold text-brand hover:underline" href="thong-tu-phap-luat.html?id=${encodeURIComponent(doc.id)}">Đọc chi tiết →</a>
          </div>
        </div>
      </article>`).join("");
  } catch (error) {
    notice.textContent = "Không thể tải văn bản lúc này.";
    notice.className = "mt-8 text-sm font-medium text-red-700";
    list.innerHTML = `
      <div class="rounded-2xl border border-red-200 bg-red-50 p-8 md:col-span-2">
        <h2 class="text-xl font-bold text-red-900">Đã xảy ra lỗi kết nối</h2>
        <p class="mt-2 text-red-800">Vui lòng tải lại trang hoặc quay lại sau.</p>
      </div>`;
  }
});
