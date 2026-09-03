const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const output = path.join(root, "fonts");
const files = [];

for (const weight of [400, 500, 600, 700]) {
  for (const subset of ["latin", "vietnamese"]) {
    files.push(["lora", `lora-${subset}-${weight}-normal.woff2`]);
  }
}
for (const weight of [400, 600]) {
  for (const subset of ["latin", "vietnamese"]) {
    files.push(["lora", `lora-${subset}-${weight}-italic.woff2`]);
  }
}
for (const weight of [400, 500, 600, 700, 800]) {
  for (const subset of ["latin", "vietnamese"]) {
    files.push(["montserrat", `montserrat-${subset}-${weight}-normal.woff2`]);
  }
}

fs.mkdirSync(output, { recursive: true });
for (const [family, filename] of files) {
  fs.copyFileSync(path.join(root, "node_modules", "@fontsource", family, "files", filename), path.join(output, filename));
}
console.log(`Copied ${files.length} self-hosted font files.`);
