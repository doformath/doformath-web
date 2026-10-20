// Tài liệu miễn phí (dùng chung cho tai-lieu-mien-phi.html, doc-tai-lieu.html và admin.html).
// Firestore:
//   tai_lieu/{id}          thông tin: tieuDe, moTa, danhMuc, lop, loai ('html' | 'anh'), thuMuc, thuTu, an, taoLuc, capNhatLuc
//   tai_lieu_noi_dung/{id} { html }: nội dung của tài liệu dạng trang HTML (tách riêng để trang danh sách không phải tải)
// Tài liệu loại 'anh' là PDF đã cắt thành ảnh trên Cloudinary (<thuMuc>-1, -2, ...), mở bằng courses/xem-tai-lieu.html.
window.dfmTaiLieu = (function () {
    const DANH_MUC = {
        'ly-thuyet': { ten: 'Lý thuyết', icon: 'fa-solid fa-book-open', nen: 'from-teal-500 to-emerald-600', cham: 'bg-teal-500' },
        'casio': { ten: 'Thủ thuật Casio', icon: 'fa-solid fa-calculator', nen: 'from-teal-600 to-slate-800', cham: 'bg-red-500' },
        'cong-thuc': { ten: 'Công thức', icon: 'fa-solid fa-square-root-variable', nen: 'from-sky-500 to-indigo-600', cham: 'bg-sky-500' },
        'chuyen-de': { ten: 'Chuyên đề', icon: 'fa-solid fa-layer-group', nen: 'from-purple-500 to-fuchsia-600', cham: 'bg-purple-500' }
    };
    const LOP = { 'toan-10': 'Toán 10', 'toan-11': 'Toán 11', 'toan-12': 'Toán 12' };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Bỏ mọi thứ có thể chạy mã trong nội dung HTML (script, khung nhúng, thuộc tính on..., link javascript:)
    function lamSach(goc) {
        goc.querySelectorAll('script, iframe, frame, object, embed, link, meta, base, form, noscript').forEach(function (n) { n.remove(); });
        goc.querySelectorAll('*').forEach(function (el) {
            Array.from(el.attributes).forEach(function (a) {
                const ten = a.name.toLowerCase();
                if (ten.startsWith('on') || (/^(href|src|xlink:href|action|formaction)$/.test(ten) && /^\s*(javascript|vbscript|data:text)/i.test(a.value))) {
                    el.removeAttribute(a.name);
                }
            });
        });
        return goc;
    }

    function duongDan(tl, goc) {
        goc = goc || '';
        return tl.loai === 'anh'
            ? goc + 'courses/xem-tai-lieu.html?folder=' + encodeURIComponent(tl.thuMuc || '') + '&title=' + encodeURIComponent(tl.tieuDe || '')
            : goc + 'doc-tai-lieu.html?id=' + encodeURIComponent(tl.id);
    }

    function ngay(t) {
        const d = t && t.toDate ? t.toDate() : null;
        return d ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    }

    // Thẻ tài liệu ở trang Tài liệu miễn phí
    function taoThe(tl) {
        const dm = DANH_MUC[tl.danhMuc] || DANH_MUC['ly-thuyet'];
        const a = document.createElement('a');
        a.href = duongDan(tl);
        a.className = 'bg-white rounded-3xl overflow-hidden shadow-md shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 border border-slate-100 group flex flex-col cursor-pointer block';
        a.innerHTML =
            '<div class="relative h-48 bg-slate-100 overflow-hidden">' +
                '<div class="absolute inset-0 bg-gradient-to-br ' + dm.nen + ' group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">' +
                    '<i class="' + dm.icon + ' text-white/20 text-7xl"></i></div>' +
                '<span class="absolute top-4 left-4 bg-white/95 backdrop-blur-sm text-slate-800 text-xs font-bold px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1.5">' +
                    '<div class="w-2 h-2 rounded-full ' + dm.cham + '"></div> ' + esc(dm.ten) + '</span>' +
                (LOP[tl.lop] ? '<span class="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-teal-700 text-xs font-bold px-3 py-1.5 rounded-md shadow-sm">' + esc(LOP[tl.lop]) + '</span>' : '') +
            '</div>' +
            '<div class="p-6 flex-1 flex flex-col">' +
                '<span class="text-sm text-slate-400 font-medium mb-2">' + esc([ngay(tl.taoLuc), tl.loai === 'anh' ? 'Tài liệu PDF' : 'Đọc trực tuyến'].filter(Boolean).join(' • ')) + '</span>' +
                '<h3 class="text-xl font-bold text-slate-800 mb-3 group-hover:text-teal-600 transition-colors leading-snug">' + esc(tl.tieuDe) + '</h3>' +
                '<p class="text-slate-500 text-sm mb-6 line-clamp-3">' + esc(tl.moTa) + '</p>' +
                '<div class="mt-auto pt-4 border-t border-slate-100 flex items-center text-teal-600 font-semibold text-sm group-hover:text-teal-700">' +
                    'Xem tài liệu <i class="fa-solid fa-arrow-right ml-2 transform group-hover:translate-x-1 transition-transform"></i></div>' +
            '</div>';
        return a;
    }

    // CSS của site chỉ gồm các class Tailwind có trong code (npm run build:css). Nội dung lấy từ Firestore
    // có thể dùng class chưa có: khi đó nạp thêm Tailwind bản trình duyệt để tạo nốt các class còn thiếu.
    function boSungTailwind(goc) {
        const co = new Set();
        function quet(ds) {
            Array.from(ds || []).forEach(function (r) {
                if (r.selectorText) {
                    (r.selectorText.match(/\.(?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-])+/g) || []).forEach(function (x) {
                        co.add(x.slice(1).replace(/\\([0-9a-fA-F]{1,6})\s?/g, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); }).replace(/\\(.)/g, '$1'));
                    });
                }
                if (r.cssRules) quet(r.cssRules);
            });
        }
        Array.from(document.styleSheets).forEach(function (sh) {
            try { quet(sh.cssRules); } catch (e) { /* CSS ở tên miền khác (Font Awesome...) không đọc được */ }
        });
        const thieu = new Set();
        goc.querySelectorAll('[class]').forEach(function (el) {
            el.classList.forEach(function (c) {
                if (!co.has(c) && !/^(group|peer)(\/|$)/.test(c) && !/^fa(-|$)/.test(c)) thieu.add(c);
            });
        });
        if (!thieu.size) return;
        console.info('Nạp Tailwind bổ sung cho các class:', Array.from(thieu).join(' '));
        const s = document.createElement('script');
        s.src = 'https://cdn.tailwindcss.com/3.4.17';
        s.onload = function () {
            window.tailwind.config = {
                darkMode: 'class',
                corePlugins: { preflight: false },
                theme: { extend: { colors: { primary: 'rgb(var(--mau-chinh, 13 148 136) / <alpha-value>)' } } }
            };
        };
        document.head.appendChild(s);
    }

    return { DANH_MUC: DANH_MUC, LOP: LOP, lamSach: lamSach, duongDan: duongDan, ngay: ngay, taoThe: taoThe, boSungTailwind: boSungTailwind };
})();
