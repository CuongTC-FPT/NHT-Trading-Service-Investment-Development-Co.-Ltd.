(function (root) {
  "use strict";
  const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // Only uploaded Cloudinary images are interpreted; all other content stays text.
  const imageUrlPattern = /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\/[^\s<>"'()]+$/i;
  const imageToken = (url, alt = "Ảnh minh họa") => {
    if (!imageUrlPattern.test(url)) throw new Error("Đường dẫn ảnh không hợp lệ.");
    return `![${encodeURIComponent(alt)}](${url})`;
  };
  const parse = (content) => {
    const parts = [];
    const pattern = /^!\[([^\]\r\n]*)\]\((https:\/\/res\.cloudinary\.com\/[^\s()]+)\)\r?$/gm;
    let offset = 0;
    for (const match of String(content || "").matchAll(pattern)) {
      if (!imageUrlPattern.test(match[2])) continue;
      parts.push({ type: "text", text: content.slice(offset, match.index) });
      let alt;
      try { alt = decodeURIComponent(match[1]); } catch { alt = match[1]; }
      parts.push({ type: "image", url: match[2], alt });
      offset = match.index + match[0].length;
    }
    parts.push({ type: "text", text: String(content || "").slice(offset) });
    return parts;
  };
  const render = (content) => parse(content).map((part) => part.type === "text"
    ? `<span class="legal-content-text">${escapeHtml(part.text)}</span>`
    : `<figure class="legal-inline-image"><img src="${escapeHtml(part.url)}" alt="${escapeHtml(part.alt)}" loading="lazy" decoding="async" /></figure>`).join("");
  const api = { parse, render, imageToken };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NHTLegalContent = api;
})(typeof window !== "undefined" ? window : globalThis);
