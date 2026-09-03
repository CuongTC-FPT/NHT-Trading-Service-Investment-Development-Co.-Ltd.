const fs = require("fs");
const path = require("path");

const htmlRoot = path.join(__dirname, "..", "HTML");
const missing = [];

for (const filename of fs.readdirSync(htmlRoot).filter((name) => name.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(htmlRoot, filename), "utf8");
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = match[1].split("?")[0];
    if (!url || /^(?:https?:|mailto:|tel:|#|data:)/i.test(url)) continue;
    const target = path.resolve(htmlRoot, url);
    if (!fs.existsSync(target)) missing.push(`${filename}: ${url}`);
  }
}

if (missing.length) {
  console.error(`Missing local assets or pages:\n${missing.join("\n")}`);
  process.exit(1);
}

console.log("All local HTML assets and links exist.");
