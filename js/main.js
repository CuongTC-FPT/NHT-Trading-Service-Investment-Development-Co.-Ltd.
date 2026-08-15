document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  const notice = document.getElementById("formNotice");
  const yearEl = document.getElementById("currentYear");
  const header = document.getElementById("main-header");
  const internalLinks = document.querySelectorAll('a[href$=".html"]');
  const body = document.body;
  const termsModal = document.getElementById("termsModal");
  const termsDialog = termsModal?.querySelector(".terms-modal__dialog");
  const termsConsent = document.getElementById("termsConsent");
  const termsConfirmBtn = document.getElementById("termsConfirmBtn");
  const termsConsentError = document.getElementById("termsConsentError");
  let isLeaving = false;
  let termsConfirmed = false;
  let lastFocusedElement = null;

  if (notice) {
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
  }

  const main = document.querySelector("main");
  if (main && !main.id) main.id = "main-content";
  if (main) main.tabIndex = -1;
  if (main && !document.querySelector(".skip-link")) {
    const skipLink = document.createElement("a");
    skipLink.className = "skip-link";
    skipLink.href = "#main-content";
    skipLink.textContent = "Bỏ qua đến nội dung chính";
    body.prepend(skipLink);
  }

  body.classList.add("page-transition");
  requestAnimationFrame(() => {
    body.classList.add("page-ready");
  });

  // Khi người dùng bấm Back, trình duyệt có thể phục hồi nguyên trang từ
  // bfcache, gồm cả lớp page-leaving đã làm body trong suốt.
  window.addEventListener("pageshow", () => {
    isLeaving = false;
    body.classList.remove("page-leaving");
    body.classList.add("page-ready");
  });

  internalLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === "_blank" ||
        isLeaving
      ) {
        return;
      }

      const nextUrl = link.getAttribute("href");
      if (!nextUrl) return;

      event.preventDefault();
      isLeaving = true;
      body.classList.add("page-leaving");

      window.setTimeout(() => {
        window.location.href = nextUrl;
      }, 230);
    });
  });

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const setHeaderState = (isCompact) => {
    if (!header) return;
    if (isCompact) {
      header.classList.add("bg-white/95", "shadow-sm", "border-slate-200/80");
      header.classList.remove("bg-white/80", "border-slate-100/80");
    } else {
      header.classList.remove("bg-white/95", "shadow-sm", "border-slate-200/80");
      header.classList.add("bg-white/80", "border-slate-100/80");
    }
  };

  if (header) {
    const navSentinel = document.createElement("span");
    navSentinel.setAttribute("aria-hidden", "true");
    navSentinel.style.cssText = "position:absolute;top:20px;width:1px;height:1px;pointer-events:none";
    body.prepend(navSentinel);
    const headerObserver = new IntersectionObserver(([entry]) => {
      setHeaderState(!entry.isIntersecting);
    });
    headerObserver.observe(navSentinel);
  }

  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const closeMenuBtn = document.getElementById("close-menu-btn");
  const mobileMenuDrawer = document.getElementById("mobile-menu-drawer");
  const drawerBackdrop = document.getElementById("drawer-backdrop");

  if (mobileMenuBtn) {
    mobileMenuBtn.setAttribute("aria-expanded", "false");
    mobileMenuBtn.setAttribute("aria-controls", "mobile-menu-drawer");
    mobileMenuBtn.setAttribute("aria-label", "Mở menu");
  }
  if (closeMenuBtn) closeMenuBtn.setAttribute("aria-label", "Đóng menu");

  const contentImages = Array.from(document.querySelectorAll("main img"));
  contentImages.forEach((image, index) => {
    image.decoding = "async";
    if (index === 0) {
      image.fetchPriority = "high";
    } else {
      image.loading = "lazy";
    }
  });

  const openDrawer = () => {
    if (mobileMenuDrawer) {
      mobileMenuDrawer.classList.remove("translate-x-full");
      mobileMenuDrawer.setAttribute("aria-hidden", "false");
      mobileMenuBtn?.setAttribute("aria-expanded", "true");
      body.style.overflow = "hidden";
      closeMenuBtn?.focus();
    }
  };

  const closeDrawer = () => {
    if (mobileMenuDrawer) {
      mobileMenuDrawer.classList.add("translate-x-full");
      mobileMenuDrawer.setAttribute("aria-hidden", "true");
      mobileMenuBtn?.setAttribute("aria-expanded", "false");
      body.style.overflow = "";
    }
  };

  if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openDrawer);
  if (closeMenuBtn) closeMenuBtn.addEventListener("click", closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileMenuDrawer?.getAttribute("aria-hidden") === "false") {
      closeDrawer();
      mobileMenuBtn?.focus();
    }
  });

  const drawerLinks = mobileMenuDrawer ? mobileMenuDrawer.querySelectorAll("nav a") : [];
  drawerLinks.forEach((link) => {
    link.addEventListener("click", closeDrawer);
  });

  if (!form || !notice) return;

  const closeTermsModal = () => {
    if (!termsModal) return;
    termsModal.classList.remove("is-open");
    termsModal.setAttribute("aria-hidden", "true");
    body.classList.remove("terms-modal-open");
    if (termsConsent) termsConsent.checked = false;
    if (termsConfirmBtn) termsConfirmBtn.disabled = true;
    if (termsConsentError) termsConsentError.hidden = true;
    lastFocusedElement?.focus();
  };

  const openTermsModal = () => {
    if (!termsModal) return;
    lastFocusedElement = document.activeElement;
    termsModal.classList.add("is-open");
    termsModal.setAttribute("aria-hidden", "false");
    body.classList.add("terms-modal-open");
    window.requestAnimationFrame(() => termsConsent?.focus());
  };

  termsConsent?.addEventListener("change", () => {
    if (termsConfirmBtn) termsConfirmBtn.disabled = !termsConsent.checked;
    if (termsConsentError) termsConsentError.hidden = termsConsent.checked;
  });

  termsModal?.querySelectorAll("[data-terms-close]").forEach((control) => {
    control.addEventListener("click", closeTermsModal);
  });

  termsConfirmBtn?.addEventListener("click", () => {
    if (!termsConsent?.checked) {
      if (termsConsentError) termsConsentError.hidden = false;
      termsConsent?.focus();
      return;
    }
    termsConfirmed = true;
    closeTermsModal();
    form.requestSubmit();
  });

  termsModal?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTermsModal();
      return;
    }
    if (event.key !== "Tab" || !termsDialog) return;
    const focusable = Array.from(termsDialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const setNotice = (text, tone) => {
    const toneClass =
      tone === "error"
        ? "text-red-600"
        : tone === "warning"
          ? "text-amber-600"
          : "text-emerald-600";
    notice.textContent = text;
    notice.className = `text-sm font-medium mt-3 ${toneClass}`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const requiredFields = form.querySelectorAll("[required]");
    const isInvalid = Array.from(requiredFields).some((field) => !field.value.trim());
    if (isInvalid) {
      setNotice("Vui lòng điền đầy đủ các thông tin bắt buộc.", "error");
      return;
    }

    if (!termsConfirmed) {
      openTermsModal();
      return;
    }
    termsConfirmed = false;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Đang gửi...</span>`;
    }

    notice.textContent = "";
    notice.className = "text-sm text-slate-500 mt-3";

    const selectedService = document.getElementById("service")?.value.trim() || "";
    const payload = {
      email: document.getElementById("email")?.value.trim(),
      phone: document.getElementById("phone")?.value.trim(),
      name: document.getElementById("name")?.value.trim(),
      company: document.getElementById("company")?.value.trim(),
      taxCode: document.getElementById("taxCode")?.value.trim(),
      service: selectedService === "Dịch vụ quan tâm" ? "" : selectedService,
      message: document.getElementById("message")?.value.trim(),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setNotice(data.error || "Có lỗi xảy ra. Vui lòng thử lại.", "error");
        return;
      }

      if (data.warning === "no_smtp") {
        setNotice(
          "Đã lưu thông tin. Hệ thống email tự động hiện chưa được cấu hình.",
          "warning"
        );
      } else if (data.warning === "customer_mail_failed") {
        setNotice(
          "Đã lưu yêu cầu, nhưng chưa gửi được email xác nhận. NHT sẽ liên hệ trực tiếp với bạn.",
          "warning"
        );
      } else if (data.warning === "admin_mail_failed") {
        setNotice(
          "Đã gửi email xác nhận. Thông báo nội bộ đang được xử lý.",
          "warning"
        );
      } else {
        setNotice("Gửi thành công. NHT đã nhận được yêu cầu của bạn.", "success");
      }

      form.reset();
    } catch {
      setNotice(
        "Không kết nối được máy chủ. Vui lòng liên hệ trực tiếp qua hotline hoặc Zalo.",
        "error"
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Gửi yêu cầu</span>`;
      }
    }
  });
});
