document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("legalDocumentsList");
  const notice = document.getElementById("legalPublicNotice");
  const filters = document.getElementById("legalFilters");
  const searchInput = document.getElementById("legalSearch");
  const categorySelect = document.getElementById("legalCategory");
  const yearSelect = document.getElementById("legalYear");
  const categoryToggle = document.getElementById("legalCategoryToggle");
  const categoryMenu = document.getElementById("legalCategoryMenu");
  const categoryValue = document.getElementById("legalCategoryValue");
  const otherAgencyField = document.getElementById("legalOtherAgencyField");
  const otherAgencyInput = document.getElementById("legalOtherAgency");
  const yearToggle = document.getElementById("legalYearToggle");
  const yearMenu = document.getElementById("legalYearMenu");
  const yearValue = document.getElementById("legalYearValue");
  const loadMoreButton = document.getElementById("legalLoadMore");
  if (!list || !notice) return;

  const pageSize = 6;
  const defaultIssuingBodies = [
    "Bộ Tài chính",
    "Cục Thuế",
    "Chính phủ",
    "Quốc hội",
    "Ngân hàng Nhà nước Việt Nam",
    "Bảo hiểm xã hội Việt Nam",
    "Bộ Nội vụ",
    "Khác",
  ];
  let visibleCount = pageSize;
  let documents = [];

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
  const formatDate = (value) => value
    ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
    : "Chưa cập nhật";
  const getYear = (doc) => {
    const value = doc.effectiveDate || doc.issuedDate;
    return value ? String(new Date(value).getFullYear()) : "";
  };
  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  let dropdowns = [];
  const createDropdown = ({ select, toggle, menu, value }) => {
    const sync = () => {
      const selected = select.options[select.selectedIndex];
      value.textContent = selected?.textContent || "Tất cả";
      menu.querySelectorAll("[data-option-value]").forEach((option) => {
        const isSelected = option.dataset.optionValue === select.value;
        option.setAttribute("aria-selected", String(isSelected));
      });
    };
    const close = ({ restoreFocus = false } = {}) => {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.closest("[data-legal-select]")?.classList.remove("is-open");
      if (restoreFocus) toggle.focus();
    };
    const open = () => {
      dropdowns.forEach((dropdown) => dropdown.close());
      menu.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      toggle.closest("[data-legal-select]")?.classList.add("is-open");
      (menu.querySelector('[aria-selected="true"]') || menu.querySelector("[data-option-value]"))?.focus();
    };
    const choose = (nextValue) => {
      select.value = nextValue;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
      close({ restoreFocus: true });
    };
    const refresh = () => {
      menu.innerHTML = Array.from(select.options).map((option) => `
        <button type="button" class="legal-select__option" role="option" data-option-value="${escapeHtml(option.value)}" aria-selected="${option.selected}" tabindex="-1">
          <span>${escapeHtml(option.textContent)}</span><span class="legal-select__check" aria-hidden="true">✓</span>
        </button>`).join("");
      sync();
    };

    toggle.addEventListener("click", () => menu.hidden ? open() : close());
    toggle.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      open();
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-option-value]");
      if (option) choose(option.dataset.optionValue);
    });
    menu.addEventListener("keydown", (event) => {
      const options = Array.from(menu.querySelectorAll("[data-option-value]"));
      const index = options.indexOf(document.activeElement);
      if (event.key === "Escape") { event.preventDefault(); close({ restoreFocus: true }); return; }
      if (["Enter", " "].includes(event.key)) { event.preventDefault(); document.activeElement?.click(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowDown" ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
      options[nextIndex]?.focus();
    });
    select.addEventListener("change", sync);
    return { close, refresh };
  };

  dropdowns = [
    createDropdown({ select: categorySelect, toggle: categoryToggle, menu: categoryMenu, value: categoryValue }),
    createDropdown({ select: yearSelect, toggle: yearToggle, menu: yearMenu, value: yearValue }),
  ];
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-legal-select]")) dropdowns.forEach((dropdown) => dropdown.close());
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dropdowns.forEach((dropdown) => dropdown.close());
  });

  const cloudinaryImageUrl = (url, width, aspectRatio) => {
    const source = String(url || "");
    if (!/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(source)) return source;
    const transformation = ["f_auto", "q_auto:eco", "c_fill", "g_auto", `w_${width}`, `ar_${aspectRatio}`].join(",");
    return source.replace("/image/upload/", `/image/upload/${transformation}/`);
  };
  const responsiveCloudinaryImage = (url, alt, options = {}) => {
    const { widths = [640, 960, 1280], aspectRatio = "3:1", sizes = "100vw", eager = false } = options;
    const optimizedUrls = widths.map((width) => ({ width, url: cloudinaryImageUrl(url, width, aspectRatio) }));
    const srcset = optimizedUrls.map(({ width, url: imageUrl }) => `${escapeHtml(imageUrl)} ${width}w`).join(", ");
    const fallback = optimizedUrls[Math.min(1, optimizedUrls.length - 1)]?.url || url;
    return `<img src="${escapeHtml(fallback)}" srcset="${srcset}" sizes="${escapeHtml(sizes)}" alt="${escapeHtml(alt)}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async"`;
  };

  const renderLoading = () => {
    list.innerHTML = Array.from({ length: 6 }, () => `
      <div class="legal-document-card legal-document-card--loading" aria-hidden="true">
        <div></div><div></div><div></div><div></div>
      </div>`).join("");
  };
  const populateFilters = () => {
    const issuingBodyMap = new Map(
      [...documents.map((doc) => doc.issuingBody).filter(Boolean), ...defaultIssuingBodies]
        .map((value) => [normalize(value), value]),
    );
    const categories = [...issuingBodyMap.values()].sort((a, b) => {
      if (normalize(a) === "khac") return 1;
      if (normalize(b) === "khac") return -1;
      return a.localeCompare(b, "vi");
    });
    const currentYear = new Date().getFullYear();
    const standardYears = Array.from({ length: currentYear - 1989 }, (_, index) => String(currentYear - index));
    const years = [...new Set([...standardYears, ...documents.map(getYear).filter(Boolean)])]
      .sort((a, b) => Number(b) - Number(a));
    categorySelect.innerHTML = `<option value="">Tất cả cơ quan</option>${categories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    yearSelect.innerHTML = `<option value="">Tất cả các năm</option>${years.map((value) => `<option value="${value}">${value}</option>`).join("")}`;
    yearSelect.value = "";
    dropdowns.forEach((dropdown) => dropdown.refresh());
  };
  const syncOtherAgencyField = ({ focus = false } = {}) => {
    const isOther = normalize(categorySelect.value) === "khac";
    otherAgencyField.hidden = !isOther;
    if (!isOther) otherAgencyInput.value = "";
    if (isOther && focus) window.requestAnimationFrame(() => otherAgencyInput.focus());
  };
  const filteredDocuments = () => {
    const term = normalize(searchInput.value.trim());
    const selectedBody = normalize(categorySelect.value);
    const enteredBody = normalize(otherAgencyInput.value.trim());
    const standardBodies = new Set(defaultIssuingBodies.filter((value) => normalize(value) !== "khac").map(normalize));
    return documents.filter((doc) => {
      const haystack = normalize([doc.title, doc.documentNumber, doc.issuingBody, doc.summary].join(" "));
      const documentBody = normalize(doc.issuingBody);
      const matchesIssuingBody = selectedBody === "khac"
        ? (enteredBody ? documentBody.includes(enteredBody) : !standardBodies.has(documentBody))
        : (!selectedBody || documentBody === selectedBody);
      return (!term || haystack.includes(term))
        && matchesIssuingBody
        && (!yearSelect.value || getYear(doc) === yearSelect.value);
    });
  };
  const renderDocuments = () => {
    const matches = filteredDocuments();
    const visible = matches.slice(0, visibleCount);
    notice.textContent = matches.length
      ? `Hiển thị ${Math.min(visible.length, matches.length)} trong ${matches.length} văn bản`
      : "Không tìm thấy văn bản phù hợp";
    list.innerHTML = visible.map((doc) => `
      <article class="legal-document-card">
        <div class="legal-document-card__meta">
          <span>${escapeHtml(doc.issuingBody || "Pháp luật")}</span>
          <time datetime="${escapeHtml(doc.effectiveDate || doc.issuedDate || "")}">${escapeHtml(formatDate(doc.effectiveDate || doc.issuedDate))}</time>
        </div>
        <p class="legal-document-card__number">${escapeHtml(doc.documentNumber || "Văn bản pháp luật")}</p>
        <h3>${escapeHtml(doc.title)}</h3>
        <p class="legal-document-card__summary">${escapeHtml(doc.summary || "Nội dung văn bản đang được cập nhật.")}</p>
        <a href="thong-tu-phap-luat.html?id=${encodeURIComponent(doc.id)}">Xem chi tiết <span aria-hidden="true">→</span></a>
      </article>`).join("");
    if (!visible.length) {
      list.innerHTML = `<div class="legal-empty"><h3>Chưa có kết quả phù hợp</h3><p>Hãy thử từ khóa khác hoặc đặt lại bộ lọc.</p></div>`;
    }
    loadMoreButton.hidden = visible.length >= matches.length;
  };

  renderLoading();
  try {
    const documentId = new URLSearchParams(window.location.search).get("id");
    if (documentId) {
      const response = await fetch(`/api/legal-documents/${encodeURIComponent(documentId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tải được văn bản.");
      const doc = data.document;
      document.title = `${doc.title} | NHT`;
      filters.hidden = true;
      document.querySelector(".legal-library__hero")?.setAttribute("hidden", "");
      document.querySelector(".legal-results__heading")?.classList.add("legal-results__heading--detail");
      notice.innerHTML = `<a href="thong-tu-phap-luat.html">← Tất cả thông tư</a>`;
      list.className = "legal-document-detail";
      loadMoreButton.hidden = true;
      list.innerHTML = `
        <article>
          ${doc.imageUrl ? `${responsiveCloudinaryImage(doc.imageUrl, doc.title, { eager: true })} class="legal-document-detail__image" />` : ""}
          <p class="legal-document-card__number">${escapeHtml([doc.documentNumber, doc.issuingBody].filter(Boolean).join(" · ") || "Thông tin pháp lý")}</p>
          <h1>${escapeHtml(doc.title)}</h1>
          <p class="legal-document-detail__summary">${escapeHtml(doc.summary)}</p>
          <div class="legal-document-detail__content">${escapeHtml(doc.content)}</div>
          ${doc.sourceUrl ? `<a class="legal-document-detail__source" href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener noreferrer">Xem văn bản gốc <span aria-hidden="true">→</span></a>` : ""}
        </article>`;
      return;
    }

    const response = await fetch("/api/legal-documents");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không tải được văn bản.");
    documents = data.documents || [];
    populateFilters();
    syncOtherAgencyField();
    renderDocuments();
    searchInput.addEventListener("input", () => {
      visibleCount = pageSize;
      renderDocuments();
    });
    categorySelect.addEventListener("change", () => {
      visibleCount = pageSize;
      syncOtherAgencyField({ focus: true });
      renderDocuments();
    });
    yearSelect.addEventListener("change", () => {
      visibleCount = pageSize;
      renderDocuments();
    });
    otherAgencyInput.addEventListener("input", () => {
      visibleCount = pageSize;
      renderDocuments();
    });
    loadMoreButton.addEventListener("click", () => {
      visibleCount += pageSize;
      renderDocuments();
    });
  } catch (error) {
    notice.textContent = "Không thể tải văn bản lúc này";
    list.innerHTML = `<div class="legal-empty legal-empty--error"><h3>Đã xảy ra lỗi kết nối</h3><p>Vui lòng tải lại trang hoặc quay lại sau.</p></div>`;
    loadMoreButton.hidden = true;
  }
});
