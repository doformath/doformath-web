// Tạo bản màu tối cho mọi class màu Tailwind đang dùng trong site (gọi từ build-css.mjs).
// Ý tưởng: không phải thêm dark: cho từng phần tử. Với mỗi class màu (bg-white, text-gray-900,
// hover:bg-teal-50, md:border-slate-200/80, ...) sinh thêm luật ".dark <class>" dùng màu tối tương ứng,
// theo bộ màu của khối đếm ngược ở trang chủ: nền slate-900, thẻ slate-800, viền slate-700,
// chữ slate-100..400, nhấn teal-300/400, ô nhấn nền ánh màu đậm.
// Các luật này được chèn TRƯỚC phần utilities nên class dark: viết tay (cùng độ ưu tiên, đứng sau) vẫn thắng.

const SLATE = { 50: [248, 250, 252], 100: [241, 245, 249], 200: [226, 232, 240], 300: [203, 213, 225], 400: [148, 163, 184], 500: [100, 116, 139], 600: [71, 85, 105], 700: [51, 65, 85], 800: [30, 41, 59], 900: [15, 23, 42] };
const XAM = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone']);

// Bảng màu Tailwind v3 (các sắc độ cần để tạo màu tối) — dạng hex
const BANG = {
    red: { 100: 'fee2e2', 200: 'fecaca', 300: 'fca5a5', 400: 'f87171', 800: '991b1b', 900: '7f1d1d' },
    orange: { 100: 'ffedd5', 200: 'fed7aa', 300: 'fdba74', 400: 'fb923c', 800: '9a3412', 900: '7c2d12' },
    amber: { 100: 'fef3c7', 200: 'fde68a', 300: 'fcd34d', 400: 'fbbf24', 800: '92400e', 900: '78350f' },
    yellow: { 100: 'fef9c3', 200: 'fef08a', 300: 'fde047', 400: 'facc15', 800: '854d0e', 900: '713f12' },
    lime: { 100: 'ecfccb', 200: 'd9f99d', 300: 'bef264', 400: 'a3e635', 800: '3f6212', 900: '365314' },
    green: { 100: 'dcfce7', 200: 'bbf7d0', 300: '86efac', 400: '4ade80', 800: '166534', 900: '14532d' },
    emerald: { 100: 'd1fae5', 200: 'a7f3d0', 300: '6ee7b7', 400: '34d399', 800: '065f46', 900: '064e3b' },
    teal: { 100: 'ccfbf1', 200: '99f6e4', 300: '5eead4', 400: '2dd4bf', 800: '115e59', 900: '134e4a' },
    cyan: { 100: 'cffafe', 200: 'a5f3fc', 300: '67e8f9', 400: '22d3ee', 800: '155e75', 900: '164e63' },
    sky: { 100: 'e0f2fe', 200: 'bae6fd', 300: '7dd3fc', 400: '38bdf8', 800: '075985', 900: '0c4a6e' },
    blue: { 100: 'dbeafe', 200: 'bfdbfe', 300: '93c5fd', 400: '60a5fa', 800: '1e40af', 900: '1e3a8a' },
    indigo: { 100: 'e0e7ff', 200: 'c7d2fe', 300: 'a5b4fc', 400: '818cf8', 800: '3730a3', 900: '312e81' },
    violet: { 100: 'ede9fe', 200: 'ddd6fe', 300: 'c4b5fd', 400: 'a78bfa', 800: '5b21b6', 900: '4c1d95' },
    purple: { 100: 'f3e8ff', 200: 'e9d5ff', 300: 'd8b4fe', 400: 'c084fc', 800: '6b21a8', 900: '581c87' },
    fuchsia: { 100: 'fae8ff', 200: 'f5d0fe', 300: 'f0abfc', 400: 'e879f9', 800: '86198f', 900: '701a75' },
    pink: { 100: 'fce7f3', 200: 'fbcfe8', 300: 'f9a8d4', 400: 'f472b6', 800: '9d174d', 900: '831843' },
    rose: { 100: 'ffe4e6', 200: 'fecdd3', 300: 'fda4af', 400: 'fb7185', 800: '9f1239', 900: '881337' }
};
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const tron = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const mau = (fam, s) => hex(BANG[fam][s]);

// Màu tối cho một class: loai = nen | chu | vien | bong; tra về [r, g, b] hoặc null (giữ nguyên)
function mauToi(loai, ten, sacDo, rgbSang) {
    if (ten === 'primary') return loai === 'chu' ? mau('teal', 400) : null;
    if (ten === 'white') {
        if (loai === 'nen') return SLATE[800];
        if (loai === 'vien') return SLATE[800];
        return null;                                   // chữ trắng (trên nút màu) giữ nguyên
    }
    if (ten === 'black') return loai === 'chu' ? SLATE[100] : null;
    if (ten === 'arbitrary') {                          // màu tự đặt, vd bg-[#EAF4F8]: dựa vào độ sáng
        const sang = (0.2126 * rgbSang[0] + 0.7152 * rgbSang[1] + 0.0722 * rgbSang[2]) / 255;
        if (loai === 'nen' && sang > 0.8) return SLATE[900];
        if (loai === 'chu' && sang < 0.3) return SLATE[200];
        if (loai === 'vien' && sang > 0.8) return SLATE[700];
        return null;
    }
    if (XAM.has(ten)) {
        if (loai === 'nen') return { 50: SLATE[900], 100: SLATE[700], 200: SLATE[700], 300: SLATE[600] }[sacDo] || null;
        if (loai === 'chu') return { 500: SLATE[400], 600: SLATE[300], 700: SLATE[200], 800: SLATE[100], 900: SLATE[50], 950: SLATE[50] }[sacDo] || null;
        if (loai === 'vien') return { 50: [41, 53, 72], 100: SLATE[700], 200: SLATE[700], 300: SLATE[600] }[sacDo] || null;
        if (loai === 'bong') return [0, 0, 0];
        return null;
    }
    if (!BANG[ten]) return null;
    if (loai === 'nen') {                               // ô nhấn nhạt → nền ánh màu đậm trên thẻ slate-800
        const k = { 50: 0.35, 100: 0.5, 200: 0.7 }[sacDo];
        if (k) return tron(SLATE[800], mau(ten, 900), k);
        return sacDo === 300 ? mau(ten, 800) : null;
    }
    if (loai === 'chu') return { 600: mau(ten, 400), 700: mau(ten, 300), 800: mau(ten, 200), 900: mau(ten, 100), 950: mau(ten, 100) }[sacDo] || null;
    if (loai === 'vien') {
        const k = { 50: 0.25, 100: 0.35, 200: 0.5, 300: 0.65 }[sacDo];
        return k ? tron(SLATE[700], mau(ten, 800), k) : null;
    }
    if (loai === 'bong') return mau(ten, 900);
    return null;
}

const LOAI = {
    bg: 'nen', from: 'nen', via: 'nen', to: 'nen',
    text: 'chu', placeholder: 'chu', fill: 'chu', stroke: 'chu', caret: 'chu', accent: 'chu', decoration: 'chu',
    border: 'vien', 'border-t': 'vien', 'border-b': 'vien', 'border-l': 'vien', 'border-r': 'vien', 'border-x': 'vien', 'border-y': 'vien',
    divide: 'vien', ring: 'vien', 'ring-offset': 'vien', outline: 'vien',
    shadow: 'bong'
};
const HO_MAU = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RE_TIEN_ICH = new RegExp('^-?(' + Object.keys(LOAI).sort((a, b) => b.length - a.length).join('|') + ')-' +
    '(white|black|primary|(' + HO_MAU + ')-(\\d{2,3})|\\[#([0-9a-fA-F]{3,6})\\])(?:\\/[\\w.\\[\\]]+)?$');

// ---- Đọc CSS (đã minify) thành cây luật / @media ----
function phanTich(css) {
    const nut = [];
    let i = 0;
    while (i < css.length) {
        if (css.startsWith('/*', i)) { const j = css.indexOf('*/', i); nut.push({ text: css.slice(i, j + 2) }); i = j + 2; continue; }
        const mo = timNgoac(css, i, '{');
        if (mo < 0) { if (css.slice(i).trim()) nut.push({ text: css.slice(i) }); break; }
        const dau = css.slice(i, mo).trim();
        const dong = timDong(css, mo);
        const than = css.slice(mo + 1, dong);
        if (dau.startsWith('@media') || dau.startsWith('@supports')) nut.push({ at: dau, con: phanTich(than) });
        else nut.push({ sel: dau, than: than });
        i = dong + 1;
    }
    return nut;
}
// Bỏ qua ký tự thoát (vd selector bg-\[url\(\'...\'\)\] có dấu nháy thoát) và nội dung trong chuỗi
function timNgoac(s, i, kt) {
    let q = null;
    for (; i < s.length; i++) {
        const c = s[i];
        if (c === '\\') { i++; continue; }
        if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === kt) return i;
    }
    return -1;
}
function timDong(s, mo) {
    let sau = 0, q = null;
    for (let i = mo; i < s.length; i++) {
        const c = s[i];
        if (c === '\\') { i++; continue; }
        if (q) { if (c === q) q = null; continue; }
        if (c === '"' || c === "'") q = c; else if (c === '{') sau++; else if (c === '}' && --sau === 0) return i;
    }
    return s.length;
}

// Tên class (bỏ ký tự thoát) của một selector, vd ".hover\:bg-gray-100:hover" → "hover:bg-gray-100"
// Lấy class cuối cùng: với ".group:hover .group-hover\:text-teal-700" thì class tiện ích nằm cuối
function tenClass(sel) {
    const ds = sel.match(/\.((?:\\.|[\w-])+)/g);
    return ds ? ds[ds.length - 1].slice(1).replace(/\\(.)/g, '$1') : null;
}
function tienIch(ten) {
    let sau = 0, cat = 0;            // tách biến thể (hover:, md:, group-hover/x:) khỏi tên tiện ích
    for (let i = 0; i < ten.length; i++) { const c = ten[i]; if (c === '[') sau++; else if (c === ']') sau--; else if (c === ':' && !sau) cat = i + 1; }
    return ten.slice(cat).replace(/^!/, '');
}
// Màu trong luật Tailwind có thể là rgb(R G B/..), rgba(R,G,B,a), #hex hoặc rgb(var(--mau-chinh,R G B)/..)
function docRgb(than) {
    let m = than.match(/rgba?\((?:var\(--mau-chinh,)?(\d+)[ ,](\d+)[ ,](\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    // Khi nén, trắng/đen có độ trong suốt được viết dạng hsla(0,0%,100%,.8)
    m = than.match(/hsla?\(0,0%,(100|0)%/);
    if (m) return m[1] === '100' ? [255, 255, 255] : [0, 0, 0];
    m = than.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
    if (!m) return null;
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return hex(h);
}

function luatToi(n) {
    if (n.sel.includes('.dark')) return null;                       // class dark: viết tay: giữ nguyên
    const ds = n.sel.split(',');
    const ten = tenClass(ds[0]);
    if (!ten) return null;
    const m = tienIch(ten).match(RE_TIEN_ICH);
    if (!m) return null;
    const loai = LOAI[m[1]];
    // bg-white/10 … /40 là lớp phủ mờ trên nền màu (vd menu teal), không phải nền khối: giữ nguyên
    const doTrong = ten.match(/\/(\d+)$/);
    if ((m[2] === 'white' || m[2] === 'black') && doTrong && +doTrong[1] < 50) return null;
    const goc = docRgb(n.than);
    if (!goc) return null;
    const hoMau = m[3] ? m[3] : m[5] ? 'arbitrary' : m[2];
    const toi = mauToi(loai, hoMau, m[4] ? +m[4] : null, goc);
    if (!toi) return null;
    const moi = n.than
        .replace(/var\(--mau-chinh,\d+ \d+ \d+\)/g, toi.join(' '))
        .replace(/rgba\(\d+,\d+,\d+,/g, 'rgba(' + toi.join(',') + ',')
        .replace(/rgb\(\d+ \d+ \d+/g, 'rgb(' + toi.join(' '))
        .replace(/hsla?\(0,0%,(?:100|0)%(,[\d.]+)?\)/g, (_, a) => (a ? 'rgba(' + toi.join(',') + a + ')' : 'rgb(' + toi.join(' ') + ')'))
        .replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, 'rgb(' + toi.join(' ') + ')');
    return ds.map((s) => '.dark ' + s.trim()).join(',') + '{' + moi + '}';
}

function sinh(nut) {
    let out = '';
    for (const n of nut) {
        if (n.con) { const ben = sinh(n.con); if (ben) out += n.at + '{' + ben + '}'; }
        else if (n.sel) { const l = luatToi(n); if (l) out += l; }
    }
    return out;
}

export function chenCheDoToi(css) {
    const MOC = /\.dfm-moc-che-do-toi\{--dfm-moc:1\}/;
    if (!MOC.test(css)) throw new Error('Không tìm thấy mốc .dfm-moc-che-do-toi trong CSS');
    const luat = sinh(phanTich(css));
    return { css: css.replace(MOC, luat), soLuat: (luat.match(/\{/g) || []).length };
}
