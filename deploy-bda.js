// Deploy BDA app to Supabase Storage
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://pkzdzbhykshhnipzxpeu.supabase.co';
const SERVICE_KEY = JSON.parse(fs.readFileSync(path.join(__dirname, 'config/global.json'), 'utf8')).supabaseAnonKey;
const BUCKET = 'sites';
const PREFIX = 'bda-app';
const BDA_DIR = path.join(__dirname, 'output/bda');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function getAllFiles(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      results.push(...getAllFiles(path.join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

function uploadFile(filePath, storagePath, contentType) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const url = new URL(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': contentType,
        'Content-Length': fileData.length,
        'x-upsert': 'true',
        'Cache-Control': contentType.startsWith('text/html') ? 'no-cache' : 'public, max-age=31536000',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`${res.statusCode} ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function main() {
  const files = getAllFiles(BDA_DIR);
  console.log(`Found ${files.length} files to upload\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const storagePath = PREFIX + '/' + file.replace(/\\/g, '/');
    const filePath = path.join(BDA_DIR, file);

    try {
      await uploadFile(filePath, storagePath, contentType);
      console.log(`  OK  ${file}`);
      success++;
    } catch (err) {
      console.log(`  FAIL  ${file}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} uploaded, ${failed} failed`);
  console.log(`\nURL: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}/index.html`);
}

main().catch(console.error);
