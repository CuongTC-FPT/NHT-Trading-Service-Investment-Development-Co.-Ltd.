const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const root = path.join(__dirname, "..");
  const target = path.join(root, "picture", "partners");
  await fs.mkdir(target, { recursive: true });
  const files = (await fs.readdir(path.join(root, "logo-contact")))
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file)).sort();
  const logos = [];
  for (const [index, file] of files.entries()) {
    const name = path.parse(file).name.replace(/-/g, " ");
    const filename = `partner-${String(index + 1).padStart(2, "0")}.webp`;
    await sharp(path.join(root, "logo-contact", file)).rotate()
      .resize(320, 160, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" }).webp({ quality: 88 })
      .toFile(path.join(target, filename));
    logos.push({ name, url: `../picture/partners/${filename}` });
  }
  await fs.writeFile(path.join(target, "logos.json"), JSON.stringify(logos, null, 2) + "\n");
  console.log(`Prepared ${logos.length} partner logos.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
