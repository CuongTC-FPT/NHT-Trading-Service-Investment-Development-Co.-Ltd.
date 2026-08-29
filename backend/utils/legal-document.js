function normalizeLegalDocument(input) {
  const value = (key, max = 0) => {
    const result = String(input[key] || "").trim();
    return max ? result.slice(0, max) : result;
  };
  return {
    title: value("title", 250),
    summary: value("summary", 600),
    content: value("content", 30000),
    documentNumber: value("documentNumber", 100),
    issuingBody: value("issuingBody", 200),
    issuedDate: value("issuedDate", 10),
    effectiveDate: value("effectiveDate", 10),
    sourceUrl: value("sourceUrl", 2000),
    imageUrl: value("imageUrl", 500),
    imagePublicId: value("imagePublicId", 300),
    status: value("status") === "published" ? "published" : "draft",
  };
}

function validateLegalDocument(document) {
  if (!document.title) return "Vui lòng nhập tiêu đề.";
  if (!document.summary && !document.content) return "Vui lòng nhập tóm tắt hoặc nội dung.";
  if (document.sourceUrl && !/^https?:\/\//i.test(document.sourceUrl)) return "Đường dẫn văn bản gốc phải bắt đầu bằng http:// hoặc https://.";
  if (document.imageUrl && !/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(document.imageUrl)) return "Đường dẫn ảnh không hợp lệ.";
  if (document.imagePublicId && !/^nht\/legal-documents\/[a-z0-9_-]+$/i.test(document.imagePublicId)) return "Mã ảnh Cloudinary không hợp lệ.";
  if (Boolean(document.imageUrl) !== Boolean(document.imagePublicId)) return "Thông tin ảnh không đầy đủ.";
  for (const date of [document.issuedDate, document.effectiveDate]) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Ngày không đúng định dạng.";
  }
  return null;
}

module.exports = { normalizeLegalDocument, validateLegalDocument };
