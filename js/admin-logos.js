document.addEventListener("DOMContentLoaded", () => {
  const section = document.getElementById("adminLogos");
  if (!section) return;
  const form = document.getElementById("partnerLogoForm");
  const list = document.getElementById("adminLogoList");
  const notice = document.getElementById("adminLogoNotice");
  const count = document.getElementById("adminLogoCount");
  const file = document.getElementById("partnerLogoFile");
  const name = document.getElementById("partnerLogoName");
  const preview = document.getElementById("partnerLogoPreview");
  const refresh = document.getElementById("refreshLogosBtn");
  let logos = [];
  let busy = false;
  let previewURL;
  const message = (text, tone = "") => { notice.textContent = text; notice.dataset.tone = tone; };
  const setBusy = (value) => {
    busy = value;
    section.setAttribute("aria-busy", String(value));
    section.querySelectorAll("button,input").forEach(el => { el.disabled = value; });
  };
  const api = async (options) => {
    const response = await fetch("/api/admin/partner-logos", { cache: "no-store", ...options });
    if (response.status === 401) {
      window.location.href = "admin-login.html?redirect=admin.html%23adminLogos";
      throw new Error("Phiên đăng nhập đã hết hạn.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    return data;
  };
  const render = () => {
    list.replaceChildren();
    count.textContent = logos.length ? `${logos.length} logo đang hiển thị trên trang chủ.` : "Chưa có logo. Thêm logo đầu tiên ở trên.";
    logos.forEach(logo => {
      const item = document.createElement("li");
      const image = document.createElement("img");
      image.src = logo.url; image.alt = logo.name; image.width = 320; image.height = 160; image.loading = "lazy";
      const title = document.createElement("p"); title.textContent = logo.name;
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Xóa logo";
      remove.dataset.deleteLogo = logo.publicId;
      remove.setAttribute("aria-label", `Xóa logo ${logo.name}`);
      item.append(image, title, remove); list.append(item);
    });
  };
  const load = async () => { logos = (await api()).logos; render(); };
  const refreshList = async () => {
    if (busy) return;
    setBusy(true); message("Đang tải danh sách logo…");
    try { await load(); message(""); } catch (error) { message(error.message, "error"); }
    finally { setBusy(false); }
  };
  const clearPreview = () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null; preview.removeAttribute("src"); preview.hidden = true;
  };
  file.addEventListener("change", () => {
    clearPreview(); file.setCustomValidity("");
    const image = file.files[0];
    if (!image) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 5 * 1024 * 1024) {
      file.setCustomValidity("Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB."); file.reportValidity(); return;
    }
    previewURL = URL.createObjectURL(image); preview.src = previewURL; preview.hidden = false;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    const body = new FormData(); body.append("name", name.value.trim()); body.append("image", file.files[0]);
    setBusy(true); message("Đang tải logo lên…");
    try {
      const result = await api({ method: "POST", body });
      logos.push(result.logo); render(); form.reset(); clearPreview();
      message("Đã thêm logo. Tải lại trang chủ để xem.", "success");
    } catch (error) { message(error.message, "error"); }
    finally { setBusy(false); }
  });
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-logo]");
    if (!button || busy) return;
    const logo = logos.find(item => item.publicId === button.dataset.deleteLogo);
    if (!logo || !window.confirm(`Xóa logo "${logo.name}" khỏi trang chủ và Cloudinary?`)) return;
    setBusy(true); message("Đang xóa logo…");
    try {
      await api({ method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicId: logo.publicId }) });
      logos = logos.filter(item => item.publicId !== logo.publicId); render();
      message("Đã xóa logo. Tải lại trang chủ để xem.", "success");
    } catch (error) { message(error.message, "error"); }
    finally { setBusy(false); refresh.focus(); }
  });
  refresh.addEventListener("click", refreshList);
  document.getElementById("refreshAdminBtn")?.addEventListener("click", refreshList);
  window.addEventListener("pagehide", clearPreview);
  refreshList();
});
