(() => {
  const section = document.querySelector("[data-partner-logos]");
  if (!section) return;
  const viewport = section.querySelector(".partner-logos__viewport");
  const track = section.querySelector(".partner-logos__track");
  async function getJSON(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      const error = new Error("Logo list unavailable");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function init() {
    let logos;
    try {
      const data = await getJSON("/api/partner-logos");
      // Empty Cloudinary lists are intentional, never resurrect demo logos after removal.
      logos = data.source === "cloudinary" ? data.logos : await getJSON("../picture/partners/logos.json");
    } catch (error) {
      // Only a missing API permits static preview fallback, never a Cloudinary outage.
      if (error.status !== 404) return;
      logos = await getJSON("../picture/partners/logos.json");
    }
    if (!Array.isArray(logos) || !logos.length) return;
    const list = document.createElement("ul");
    list.className = "partner-logos__list";
    list.setAttribute("aria-label", "Danh sách khách hàng và đối tác");
    logos.forEach(({ name, url }) => {
      const item = document.createElement("li");
      const img = document.createElement("img");
      img.src = url;
      img.alt = name;
      img.width = 320;
      img.height = 160;
      img.decoding = "async";
      img.addEventListener("error", () => { img.hidden = true; item.textContent = name; });
      item.append(img);
      list.append(item);
    });
    track.append(list);
    const copy = list.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    copy.classList.add("partner-logos__copy");
    copy.querySelectorAll("img").forEach((img) => { img.alt = ""; });
    track.append(copy);
    track.style.setProperty("--logo-duration", `${Math.max(24, logos.length * 4)}s`);
    section.hidden = false;
    const resize = () => section.classList.toggle("is-short", list.scrollWidth <= viewport.clientWidth);
    new ResizeObserver(resize).observe(viewport);
    resize();
  }
  init().catch(() => { section.hidden = true; });
})();
