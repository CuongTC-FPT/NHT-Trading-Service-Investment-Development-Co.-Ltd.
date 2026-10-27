document.addEventListener("DOMContentLoaded", () => {
  const editor = document.getElementById("legalContentEditor");
  if (!editor) return;
  const field = document.getElementById("legalContent");
  const picker = document.getElementById("legalInlineImage");
  const insertButton = document.getElementById("insertLegalImageBtn");
  const notice = document.getElementById("legalEditorNotice");
  const codec = window.NHTLegalContent;
  let savedRange = null;
  let uploading = false;
  const serialize = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.matches("figure")) {
      const image = node.querySelector("img");
      return image ? `\u0000${codec.imageToken(image.getAttribute("src"), image.alt)}\u0000` : "";
    }
    if (node.matches("br")) return "\n";
    const text = [...node.childNodes].map(serialize).join("");
    return /^(DIV|P)$/.test(node.tagName) && node !== editor ? `\n${text}` : text;
  };
  const getValue = () => serialize(editor).replace(/\n*\u0000([^\u0000]*)\u0000\n*/g, "\n\n$1\n\n").replace(/\u00a0/g, " ").trim();
  const sync = () => {
    field.value = getValue();
    notice.textContent = field.value.length > 30000 ? "Nội dung vượt quá 30.000 ký tự. Vui lòng rút ngắn trước khi lưu." : "";
  };
  const decorate = () => editor.querySelectorAll("figure").forEach((figure) => {
    if (figure.querySelector("button")) return;
    figure.contentEditable = "false";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Xóa ảnh";
    button.className = "legal-remove-image";
    button.setAttribute("aria-label", "Xóa ảnh khỏi nội dung");
    figure.appendChild(button);
  });
  const setValue = (value) => {
    editor.innerHTML = codec.render(value);
    decorate();
    savedRange = null;
    sync();
  };
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) savedRange = selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    editor.focus();
    const selection = window.getSelection();
    const range = savedRange && editor.contains(savedRange.commonAncestorContainer) ? savedRange : document.createRange();
    if (range !== savedRange) { range.selectNodeContents(editor); range.collapse(false); }
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
  };
  const insertText = (text) => {
    const range = restoreSelection();
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    rememberSelection();
    sync();
  };
  const uploadImages = async (files) => {
    if (uploading || insertButton.disabled || !files.length) return;
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      notice.textContent = "Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.";
      return;
    }
    const range = restoreSelection();
    // Bookmark the exact position before the asynchronous upload starts.
    const bookmark = document.createTextNode("");
    range.collapse(false);
    range.insertNode(bookmark);
    uploading = true;
    insertButton.disabled = true;
    editor.contentEditable = "false";
    document.getElementById("saveLegalDocumentBtn").disabled = true;
    document.getElementById("resetLegalFormBtn").disabled = true;
    try {
      for (const file of files) {
        notice.textContent = `Đang tải ảnh ${file.name || "minh họa"}…`;
        const body = new FormData();
        body.append("image", file);
        const response = await fetch("/api/admin/legal-documents/upload-image", { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Không tải được ảnh. Vui lòng thử lại.");
        const template = document.createElement("template");
        template.innerHTML = codec.render(codec.imageToken(result.imageUrl, file.name || "Ảnh minh họa"));
        const figure = template.content.querySelector("figure");
        bookmark.before(document.createTextNode("\n"), figure, document.createTextNode("\n"));
      }
      notice.textContent = "Đã chèn ảnh. Anh/chị có thể viết tiếp bên dưới ảnh.";
    } catch (error) {
      notice.textContent = error.message;
    } finally {
      decorate();
      uploading = false;
      editor.contentEditable = "true";
      insertButton.disabled = false;
      document.getElementById("saveLegalDocumentBtn").disabled = false;
      document.getElementById("resetLegalFormBtn").disabled = false;
      const nextRange = document.createRange();
      nextRange.setStartBefore(bookmark);
      nextRange.collapse(true);
      savedRange = nextRange;
      restoreSelection();
      bookmark.remove();
      field.value = getValue();
      picker.value = "";
    }
  };
  editor.addEventListener("input", sync);
  document.addEventListener("selectionchange", rememberSelection);
  insertButton.addEventListener("click", () => { rememberSelection(); picker.click(); });
  picker.addEventListener("change", () => uploadImages([...picker.files]));
  editor.addEventListener("click", (event) => {
    if (event.target.closest(".legal-remove-image") && editor.contentEditable === "true" && !uploading) { event.target.closest("figure").remove(); sync(); }
  });
  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    if (uploading) return;
    rememberSelection();
    const files = [...event.clipboardData.files];
    const text = event.clipboardData.getData("text/plain");
    if (text) insertText(text);
    if (files.length) uploadImages(files);
    // Word's embedded images are not always exposed as clipboard files.
    else if (/<img\b/i.test(event.clipboardData.getData("text/html"))) notice.textContent = "Đã dán phần chữ. Dùng Chèn ảnh vào nội dung để thêm các ảnh từ Word đúng vị trí.";
  });
  editor.addEventListener("dragover", (event) => event.preventDefault());
  editor.addEventListener("drop", (event) => {
    event.preventDefault();
    notice.textContent = "Đặt con trỏ vào vị trí cần chèn rồi chọn Chèn ảnh vào nội dung.";
  });
  window.NHTLegalEditor = { setValue, getValue, isUploading: () => uploading };
  setValue(field.value);
});
