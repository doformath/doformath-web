// Build lại CSS Tailwind cho cả site:  npm run build:css
// 1. Quét mọi trang HTML và file JS, tạo assets/css/tailwind.css chỉ gồm các class đang dùng,
//    kèm bản màu tối cho các class màu (chế độ tối, xem scripts/che-do-toi.mjs).
// 2. Gắn mã phiên bản mới (?v=...) vào link CSS trong mọi trang, để trình duyệt và PWA
//    không dùng lại bản CSS cũ đã lưu.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chenCheDoToi } from './che-do-toi.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'assets/css/tailwind.css';
const BO_QUA = new Set(['.git', 'node_modules', 'doformath-web']);

execFileSync('npx', ['--yes', 'tailwindcss@3.4.17', '-c', 'tailwind.config.js', '-i', 'assets/css/tailwind.src.css', '-o', OUT, '--minify'],
    { cwd: ROOT, stdio: 'inherit' });

const { css, soLuat } = chenCheDoToi(readFileSync(join(ROOT, OUT), 'utf8'));
writeFileSync(join(ROOT, OUT), css);

const phienBan = createHash('sha1').update(readFileSync(join(ROOT, OUT))).digest('hex').slice(0, 8);

function cacTrangHtml(thuMuc) {
    return readdirSync(thuMuc, { withFileTypes: true }).flatMap((m) => {
        if (BO_QUA.has(m.name)) return [];
        const duongDan = join(thuMuc, m.name);
        if (m.isDirectory()) return cacTrangHtml(duongDan);
        return m.name.endsWith('.html') ? [duongDan] : [];
    });
}

let soTrang = 0;
for (const file of cacTrangHtml(ROOT)) {
    const cu = readFileSync(file, 'utf8');
    const moi = cu.replace(/(assets\/css\/tailwind\.css)\?v=\w*/g, `$1?v=${phienBan}`);
    if (moi !== cu) { writeFileSync(file, moi); soTrang++; }
}
const kb = (readFileSync(join(ROOT, OUT)).length / 1024).toFixed(1);
console.log(`Đã tạo ${OUT} (${kb} KB, phiên bản ${phienBan}, ${soLuat} luật màu tối), cập nhật link ở ${soTrang} trang.`);
