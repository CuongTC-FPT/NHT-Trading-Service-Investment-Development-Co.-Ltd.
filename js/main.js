document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  const notice = document.getElementById("formNotice");
  const yearEl = document.getElementById("currentYear");
  const header = document.getElementById("main-header");
  const internalLinks = document.querySelectorAll('a[href$=".html"]');
  const body = document.body;
  let isLeaving = false;

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

  const handleNavScroll = () => {
    if (!header) return;
    if (window.scrollY > 20) {
      header.classList.add("bg-white/95", "shadow-sm", "border-slate-200/80");
      header.classList.remove("bg-white/80", "border-slate-100/80");
    } else {
      header.classList.remove("bg-white/95", "shadow-sm", "border-slate-200/80");
      header.classList.add("bg-white/80", "border-slate-100/80");
    }
  };

  handleNavScroll();
  window.addEventListener("scroll", handleNavScroll);

  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const closeMenuBtn = document.getElementById("close-menu-btn");
  const mobileMenuDrawer = document.getElementById("mobile-menu-drawer");
  const drawerBackdrop = document.getElementById("drawer-backdrop");

  const openDrawer = () => {
    if (mobileMenuDrawer) {
      mobileMenuDrawer.classList.remove("translate-x-full");
      body.style.overflow = "hidden";
    }
  };

  const closeDrawer = () => {
    if (mobileMenuDrawer) {
      mobileMenuDrawer.classList.add("translate-x-full");
      body.style.overflow = "";
    }
  };

  if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openDrawer);
  if (closeMenuBtn) closeMenuBtn.addEventListener("click", closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer);

  const drawerLinks = mobileMenuDrawer ? mobileMenuDrawer.querySelectorAll("nav a") : [];
  drawerLinks.forEach((link) => {
    link.addEventListener("click", closeDrawer);
  });

  if (!form || !notice) return;

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
      setNotice("Vui long dien day du email va so dien thoai.", "error");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Dang gui...</span>`;
    }

    notice.textContent = "";
    notice.className = "text-sm text-slate-500 mt-3";

    const selectedService = document.getElementById("service")?.value.trim() || "";
    const payload = {
      email: document.getElementById("email")?.value.trim(),
      phone: document.getElementById("phone")?.value.trim(),
      name: document.getElementById("name")?.value.trim(),
      company: document.getElementById("company")?.value.trim(),
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
        setNotice(data.error || "Co loi xay ra. Vui long thu lai.", "error");
        return;
      }

      if (data.warning === "no_smtp") {
        setNotice(
          "Da luu thong tin, nhung SMTP chua cau hinh nen chua gui email tu dong.",
          "warning"
        );
      } else if (data.warning === "customer_mail_failed") {
        setNotice(
          "Da luu lead, nhung email xac nhan cho khach chua gui duoc. Vui long kiem tra SMTP.",
          "warning"
        );
      } else if (data.warning === "admin_mail_failed") {
        setNotice(
          "Da gui email xac nhan cho khach, nhung email thong bao noi bo chua gui duoc.",
          "warning"
        );
      } else {
        setNotice("Gui thanh cong! Chung toi da luu thong tin va gui email tu dong.", "success");
      }

      form.reset();
    } catch {
      setNotice(
        "Khong ket noi duoc may chu. Vui long lien he truc tiep qua Hotline hoac Zalo.",
        "error"
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Gui yeu cau</span>`;
      }
    }
  });
});
