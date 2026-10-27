const { test } = require("node:test");
const assert = require("node:assert/strict");
const codec = require("../js/legal-content");
const { normalizeLegalDocument, validateLegalDocument } = require("../backend/utils/legal-document");
const url = "https://res.cloudinary.com/demo/image/upload/v1/nht/legal-documents/test.png";

test("images stay between paragraphs and preserve Vietnamese alt text", () => {
  const content = `Đoạn đầu\n\n${codec.imageToken(url, "Ảnh thông tư.png")}\n\nĐoạn cuối`;
  const parts = codec.parse(content);
  assert.equal(parts[0].text, "Đoạn đầu\n\n");
  assert.equal(parts[1].url, url);
  assert.equal(parts[1].alt, "Ảnh thông tư.png");
  assert.equal(parts[2].text, "\n\nĐoạn cuối");
  const normalized = normalizeLegalDocument({ title: "Thông tư", content });
  assert.equal(normalized.content, content);
  assert.equal(validateLegalDocument(normalized), null);
});

test("existing text and untrusted HTML remain escaped text", () => {
  assert.equal(codec.parse("Nội dung cũ\nDòng 2")[0].text, "Nội dung cũ\nDòng 2");
  const result = codec.render('<script>alert(1)</script>\n![x](javascript:alert(1))\n![x](https://example.com/a.png)');
  assert.ok(!result.includes("<script>"));
  assert.ok(!result.includes("<img"));
  assert.throws(() => codec.imageToken('https://res.cloudinary.com/demo/image/upload/x.png" onerror="x'));
});

test("multiple images, malformed labels, and length limit", () => {
  const content = `${codec.imageToken(url, 'a] "<b>"')}\nText\n![%broken](${url})`;
  assert.equal(codec.parse(content).filter((p) => p.type === "image").length, 2);
  assert.ok(!codec.render(content).includes("<b>"));
  const oversized = normalizeLegalDocument({ title: "Test", content: "x".repeat(30001) });
  assert.equal(oversized.content.length, 30001);
  assert.ok(validateLegalDocument(oversized));
});
