// Compress team photos: resize to max 600px wide, convert to JPEG quality 80
// Overwrites the output and public folders in-place

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TEAM_DIR = path.join(__dirname, 'output/bda/images/team');
const PUBLIC_TEAM_DIR = path.join(__dirname, 'public/bda/images/team');
const MAX_WIDTH = 600;
const JPEG_QUALITY = 82;

async function compressDir(dir) {
  const files = fs.readdirSync(dir);
  let total = 0, saved = 0;
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
    const src = path.join(dir, file);
    const sizeBefore = fs.statSync(src).size;
    // Write to a temp file then replace
    const tmp = src + '.tmp.jpg';
    try {
      await sharp(src)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toFile(tmp);
      const sizeAfter = fs.statSync(tmp).size;
      // Replace original with compressed JPEG (keep original filename)
      const outPath = src.replace(/\.(png|PNG|jpeg|JPEG)$/, '.jpg');
      fs.renameSync(tmp, outPath);
      // Remove original PNG if filename changed
      if (outPath !== src) fs.unlinkSync(src);
      total += sizeBefore;
      saved += sizeBefore - sizeAfter;
      console.log(`  ${file} → ${path.basename(outPath)}  ${(sizeBefore/1024).toFixed(0)}KB → ${(sizeAfter/1024).toFixed(0)}KB`);
    } catch (e) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      console.warn(`  SKIP ${file}: ${e.message}`);
    }
  }
  return { total, saved };
}

(async () => {
  console.log('=== Compressing output/bda/images/team ===');
  const r1 = await compressDir(TEAM_DIR);

  // Sync compressed files to public/
  console.log('\n=== Syncing to public/bda/images/team ===');
  const files = fs.readdirSync(TEAM_DIR);
  for (const f of files) {
    fs.copyFileSync(path.join(TEAM_DIR, f), path.join(PUBLIC_TEAM_DIR, f));
    process.stdout.write('  ' + f + '\n');
  }

  const pct = r1.total > 0 ? ((r1.saved / r1.total) * 100).toFixed(1) : 0;
  console.log(`\nDone. Saved ${(r1.saved/1024).toFixed(0)}KB / ${(r1.total/1024).toFixed(0)}KB total (${pct}% reduction)`);
})();
