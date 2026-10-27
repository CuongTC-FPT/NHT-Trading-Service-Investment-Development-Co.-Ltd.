const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.join(__dirname, "..");
const envPath = path.join(root, "backend", ".env");
require("../backend/node_modules/dotenv").config({ path: envPath, quiet: true });
require("../backend/services/cloudinary-service");
const cloudinary = require("../backend/node_modules/cloudinary").v2;

async function main() {
  for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
    if (!process.env[key] || /^(replace_|THAY_BANG_)/.test(process.env[key])) {
      throw new Error(`Missing configuration: ${key}`);
    }
  }
  const files = (await fs.readdir(path.join(root, "logo-contact")))
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file)).sort();
  if (!files.length) throw new Error("No partner logos found.");
  const expected = [];
  for (const [index, file] of files.entries()) {
    const stem = path.parse(file).name;
    const slug = stem.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const publicId = `nht/partner-logos/${String(index + 1).padStart(2, "0")}-${slug}`;
    const asset = await cloudinary.uploader.upload(path.join(root, "logo-contact", file), {
      public_id: publicId, resource_type: "image", type: "upload",
      overwrite: false, tags: ["logo-contact"],
      context: { alt: stem.replace(/-/g, " ") }, timeout: 60000,
    });
    if (asset.public_id !== publicId) throw new Error(`Unexpected asset ID for ${file}`);
    // Ensures a rerun also restores the required tag without overwriting the image.
    if (asset.existing) await cloudinary.uploader.add_tag("logo-contact", [publicId]);
    expected.push(publicId);
    console.log(`${index + 1}/${files.length}: ${file} ${asset.existing ? "already uploaded" : "uploaded"}`);
  }
  const found = new Set();
  let cursor;
  do {
    const page = await cloudinary.api.resources_by_tag("logo-contact", {
      resource_type: "image", type: "upload", max_results: 500, next_cursor: cursor,
    });
    page.resources.forEach((asset) => found.add(asset.public_id));
    cursor = page.next_cursor;
  } while (cursor);
  if (expected.some((id) => !found.has(id))) throw new Error("Cloudinary tag verification failed.");
  console.log(`Verified all ${expected.length} logos on Cloudinary with tag logo-contact.`);
  if (process.argv.includes("--activate")) {
    let env = await fs.readFile(envPath, "utf8");
    if (/^\s*CLOUDINARY_LOGO_TAG\s*=/m.test(env)) {
      env = env.replace(/^\s*CLOUDINARY_LOGO_TAG\s*=.*$/m, "CLOUDINARY_LOGO_TAG=logo-contact");
    } else {
      env += "\nCLOUDINARY_LOGO_TAG=logo-contact\n";
    }
    await fs.writeFile(envPath, env);
    console.log("Local Cloudinary logo source enabled. Restart backend to apply.");
  }
}

main().catch((error) => {
  console.error("Partner logo upload failed:", error.message || error.error?.message || error.code || "Unknown Cloudinary error");
  process.exitCode = 1;
});
