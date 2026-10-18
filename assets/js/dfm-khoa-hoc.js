// Dùng chung cho các trang khóa học (toan-10/11/12.html), gọi sau khi học sinh được xác nhận có quyền:
//     dfmKhoaHoc.batDau(db, user, currentCourse);
// 1. Chèn các bài học thêm từ trang Admin (Firestore: bai_hoc_them) vào đúng chương trong mục lục.
// 2. Nhớ bài đang học (cho thẻ "Tiếp tục học" ở trang chủ) và mở thẳng bài qua địa chỉ ?bai=...
// 3. Ghi lại hoạt động học tập (Firestore: hoc_sinh/{uid} và hoc_sinh/{uid}/hoat_dong) để Admin theo dõi.
window.dfmKhoaHoc = (function () {
    const ADMIN_EMAIL = 'thanhdo@dfm.com';
    const GIAY_TOI_DA_MOI_DOAN = 60 * 60;   // Tab để mở quá lâu (quên tắt) chỉ tính tối đa 1 giờ mỗi lần
    const GIAY_TOI_THIEU = 5;               // Bỏ qua các lần lướt qua dưới 5 giây
    const NGAY_LA_BAI_MOI = 14;             // Bài thêm trong 14 ngày gần đây có nhãn "Mới"

    // ---------- Tiện ích ----------
    function ngayHomNay() {
        // Ngày theo giờ máy học sinh, dạng 2026-10-17
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // Đổi URL bài học thành khóa ngắn, an toàn để làm tên trường trong Firestore
    function maBai(url) {
        let h = 5381;
        for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
        return 'b' + h.toString(36);
    }

    function chu(el) {
        return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    // Chữ hiển thị của một tiêu đề: bỏ bản MathML ẩn của KaTeX (tránh lặp ký tự) và nhãn "Mới"
    function chuHienThi(el) {
        if (!el) return '';
        const ban = el.cloneNode(true);
        ban.querySelectorAll('.katex-mathml, [data-nhan-moi]').forEach((n) => n.remove());
        return chu(ban).replace(/∘/g, '°');   // ^\circ của KaTeX khi thành chữ thường: 0∘ → 0°
    }

    function thongTinBai(link) {
        const khoiBai = link.closest('[x-data*="openLesson"]');
        const khoiChuong = link.closest('[x-data*="openChapter"]');
        const tenBai = chuHienThi(khoiBai && khoiBai.querySelector('h5'));
        const muc = chuHienThi(link);
        return {
            url: link.getAttribute('href'),
            ten: tenBai ? tenBai + ' — ' + muc : muc,
            tenBai: tenBai,
            muc: muc,
            chuong: chuHienThi(khoiChuong && khoiChuong.querySelector('h4 span'))
        };
    }

    function laLinkBai(link) {
        const href = link && link.getAttribute('href');
        return !!href && href !== 'about:blank';
    }

    // So khớp địa chỉ bài, bỏ qua tham số title (link mặc định của iframe có thể ghi tiêu đề khác mục lục)
    function boTitle(url) {
        return String(url || '').replace(/([?&])title=[^&]*&?/, '$1').replace(/[?&]$/, '');
    }

    // ---------- 1. Bài học thêm từ Admin ----------
    const LOAI_MUC = {
        video: { icon: 'fa-solid fa-circle-play' },
        'tai-lieu': { icon: 'fa-solid fa-folder' },
        link: { icon: 'fa-regular fa-file-lines' }
    };

    function taoHref(muc, tieuDe) {
        const t = encodeURIComponent(tieuDe);
        const v = String(muc.giaTri || '').trim();
        if (muc.loai === 'video' && /^[\w-]{6,20}$/.test(v)) return 'xem-video.html?id=' + v + '&title=' + t;
        if (muc.loai === 'tai-lieu' && /^[\w-]+$/.test(v)) return 'xem-tai-lieu.html?folder=' + v + '&title=' + t;
        // Link: chỉ nhận https:// hoặc đường dẫn trong site (chặn javascript: và các kiểu lạ)
        if (muc.loai === 'link' && (/^https:\/\//i.test(v) || /^[\w\-./]+(\?[^:]*)?$/.test(v))) return v;
        return null;
    }

    function el(tag, className, attrs) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        for (const k in (attrs || {})) e.setAttribute(k, attrs[k]);
        return e;
    }

    function taoTheBai(bai) {
        const the = el('div', 'bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-4 hover:border-teal-300 hover:shadow-md transition-all shadow-sm group/lesson', {
            'x-data': '{ openLesson: false }', 'data-dfm-bai-them': bai.id
        });
        const dau = el('div', 'flex justify-between items-center cursor-pointer', { 'x-on:click': 'openLesson = !openLesson' });
        const h5 = el('h5', 'font-semibold text-slate-800 text-sm group-hover/lesson:text-teal-700 transition-colors pr-2 leading-relaxed');
        h5.textContent = bai.ten;
        const taoLuc = bai.taoLuc && bai.taoLuc.toMillis ? bai.taoLuc.toMillis() : 0;
        if (taoLuc && Date.now() - taoLuc < NGAY_LA_BAI_MOI * 86400000) {
            const moi = el('span', 'ml-2 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded', { 'data-nhan-moi': '' });
            moi.textContent = 'Mới';
            h5.appendChild(moi);
        }
        const mui = el('i', 'fa-solid fa-chevron-down text-slate-400 text-sm transition-transform duration-300 group-hover/lesson:text-teal-500', {
            'x-bind:class': "openLesson ? 'rotate-180 text-teal-500' : ''"
        });
        dau.append(h5, mui);

        const ds = el('ul', 'relative border-l-[3px] border-slate-200 ml-2 mt-4 space-y-5 pb-1', { 'x-show': 'openLesson', 'x-transition': '' });
        (bai.muc || []).forEach(function (muc) {
            const href = taoHref(muc, bai.ten);
            if (!href) return;
            const li = el('li', 'relative pl-6');
            li.appendChild(el('div', 'absolute w-4 h-4 rounded-full border-[3px] bg-white border-teal-400 -left-[9.5px] top-0.5 shadow-sm'));
            const a = el('a', 'group/link font-medium text-sm flex items-center gap-3 text-slate-600 hover:text-teal-600 transition-colors', {
                href: href, target: 'lesson-frame', 'x-on:click': 'window.innerWidth < 1024 ? sidebarOpen = false : null'
            });
            const icon = el('i', (LOAI_MUC[muc.loai] || LOAI_MUC.link).icon + ' text-slate-400 group-hover/link:text-teal-600 transition-colors text-base');
            a.append(icon, document.createTextNode(' ' + (muc.ten || 'Xem')));
            li.appendChild(a);
            ds.appendChild(li);
        });
        the.append(dau, ds);
        return the;
    }

    function taoChuong(ten) {
        const khoi = el('div', 'mb-4', { 'x-data': '{ openChapter: false }' });
        const h4 = el('h4', 'text-sm font-bold text-teal-800 p-3 bg-gradient-to-r from-teal-50/80 to-transparent rounded-2xl flex items-center justify-between cursor-pointer hover:from-teal-100 transition-colors group mb-3', {
            'x-on:click': 'openChapter = !openChapter'
        });
        const trai = el('div', 'flex items-center gap-3');
        const o = el('div', 'bg-white text-teal-500 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm border border-teal-100 shrink-0 group-hover:scale-110 transition-transform');
        o.appendChild(el('i', 'fa-solid fa-cube text-base'));
        const span = el('span', 'leading-snug line-clamp-2');
        span.textContent = ten;
        trai.append(o, span);
        const phai = el('div', 'w-8 h-8 rounded-full flex items-center justify-center bg-teal-100/50 text-teal-600 group-hover:bg-teal-200 transition-colors shrink-0 ml-2');
        phai.appendChild(el('i', 'fa-solid fa-chevron-down text-sm transition-transform duration-300', { 'x-bind:class': "openChapter ? 'rotate-180' : ''" }));
        h4.append(trai, phai);
        const than = el('div', 'space-y-4 pl-1 pr-1 mb-6', { 'x-show': 'openChapter', 'x-transition': '' });
        khoi.append(h4, than);
        return khoi;
    }

    function chenBaiHocThem(db, khoa) {
        return db.collection('bai_hoc_them').where('khoa', '==', khoa).get().then(function (snap) {
            const dsBai = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
                .filter(function (b) { return !b.an && b.ten && b.chuong; })
                .sort(function (a, b) { return (a.thuTu || 0) - (b.thuTu || 0); });
            if (!dsBai.length) return;

            const cacChuong = Array.from(document.querySelectorAll('[x-data*="openChapter"]'));
            const theoTen = new Map(cacChuong.map(function (c) { return [chu(c.querySelector('h4 span')), c]; }));
            const noiThemChuong = cacChuong.length ? cacChuong[cacChuong.length - 1].parentElement : null;
            if (!noiThemChuong) return;

            dsBai.forEach(function (bai) {
                let chuong = theoTen.get(bai.chuong);
                if (!chuong) {
                    chuong = taoChuong(bai.chuong);
                    noiThemChuong.appendChild(chuong);
                    theoTen.set(bai.chuong, chuong);
                }
                chuong.querySelector('[x-show="openChapter"]').appendChild(taoTheBai(bai));
            });

            // Ghi nhớ / mở lại bài cuối cùng cho cả bài học thêm (giống các bài có sẵn)
            const khoaLuu = 'doforMath_lastLesson_' + khoa.replace('-', '');
            const iframe = document.getElementById('lesson-frame');
            const linkThem = document.querySelectorAll('[data-dfm-bai-them] a[target="lesson-frame"]');
            let daLuu = null;
            try { daLuu = localStorage.getItem(khoaLuu); } catch (e) {}
            linkThem.forEach(function (a) {
                a.addEventListener('click', function () {
                    try { localStorage.setItem(khoaLuu, a.getAttribute('href')); } catch (e) {}
                });
                if (iframe && daLuu && a.getAttribute('href') === daLuu && iframe.getAttribute('src') !== daLuu) {
                    iframe.src = daLuu;
                }
            });
        }).catch(function (err) {
            console.warn('Không tải được bài học thêm:', err);
        });
    }

    // ---------- 2. Học tiếp ----------
    // Nhớ bài đang học trên máy này để trang chủ hiện thẻ "Tiếp tục học"
    const KHOA_HOC_TIEP = 'dfm_hocTiep';
    function luuHocTiep(user, khoa, link) {
        const info = thongTinBai(link);
        try {
            localStorage.setItem(KHOA_HOC_TIEP, JSON.stringify({
                email: user.email, khoa: khoa, url: info.url, tenBai: info.tenBai, muc: info.muc, chuong: info.chuong, luc: Date.now()
            }));
        } catch (e) {}
    }
    function ghiNhoHocTiep(user, khoa) {
        const iframe = document.getElementById('lesson-frame');
        if (iframe) {
            const src = boTitle(iframe.getAttribute('src'));
            const linkDau = Array.from(document.querySelectorAll('a[target="lesson-frame"]'))
                .find(function (a) { return boTitle(a.getAttribute('href')) === src; });
            if (laLinkBai(linkDau)) luuHocTiep(user, khoa, linkDau);
        }
        document.addEventListener('click', function (e) {
            const link = e.target.closest && e.target.closest('a[target="lesson-frame"]');
            if (laLinkBai(link)) luuHocTiep(user, khoa, link);
        }, true);
    }

    // Mở thẳng một bài khi vào trang bằng địa chỉ ...toan-12.html?bai=<link bài> (từ nút "Tiếp tục học")
    function moBaiTheoDiaChi(khoa) {
        const bai = new URLSearchParams(location.search).get('bai');
        if (!bai) return;
        history.replaceState(null, '', location.pathname);   // giữ địa chỉ gọn; tải lại trang thì mở như bình thường
        const iframe = document.getElementById('lesson-frame');
        // Chỉ mở link có thật trong mục lục (không mở link lạ chèn vào địa chỉ)
        const link = Array.from(document.querySelectorAll('a[target="lesson-frame"]')).find(function (a) { return a.getAttribute('href') === bai; });
        if (!iframe || !laLinkBai(link)) return;
        iframe.src = bai;
        try { localStorage.setItem('doforMath_lastLesson_' + khoa.replace('-', ''), bai); } catch (e) {}
        // Mở chương + bài chứa mục này trong mục lục, tô sáng và cuộn tới
        try {
            const chuong = link.closest('[x-data*="openChapter"]'), khoiBai = link.closest('[x-data*="openLesson"]');
            if (window.Alpine && chuong) Alpine.$data(chuong).openChapter = true;
            if (window.Alpine && khoiBai) Alpine.$data(khoiBai).openLesson = true;
        } catch (e) {}
        link.classList.add('text-teal-600', 'font-semibold');
        setTimeout(function () { link.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 400);
    }

    // ---------- 3. Theo dõi học tập ----------
    function batDauTheoDoi(db, user, khoa) {
        const FV = firebase.firestore.FieldValue;
        const ref = db.collection('hoc_sinh').doc(user.uid);
        const nhatKy = ref.collection('hoat_dong');
        const iframe = document.getElementById('lesson-frame');

        function ghi(duLieu) {
            return ref.set(duLieu, { merge: true }).catch(function (err) { console.warn('Không ghi được hoạt động:', err); });
        }
        function ghiNhatKy(duLieu) {
            duLieu.luc = FV.serverTimestamp();
            return nhatKy.add(duLieu).catch(function () {});
        }

        // Vào khóa học
        const homNay = ngayHomNay();
        ghi({
            email: user.email,
            lanCuoi: FV.serverTimestamp(),
            luotVao: FV.increment(1),
            ngay: { [homNay]: FV.increment(1) },
            khoa: { [khoa]: { luotVao: FV.increment(1), lanCuoi: FV.serverTimestamp() } }
        });
        ghiNhatKy({ loai: 'vao_khoa', khoa: khoa });

        // Bài đang xem + thời gian xem (chỉ tính lúc trang đang hiện trên màn hình)
        let baiHienTai = null;
        let batDauLuc = document.visibilityState === 'visible' ? Date.now() : null;

        function chotThoiGian() {
            if (!baiHienTai || batDauLuc === null) return;
            const giay = Math.min(Math.round((Date.now() - batDauLuc) / 1000), GIAY_TOI_DA_MOI_DOAN);
            batDauLuc = document.visibilityState === 'visible' ? Date.now() : null;
            if (giay < GIAY_TOI_THIEU) return;
            ghi({
                thoiGianHoc: FV.increment(giay),
                khoa: { [khoa]: { giay: FV.increment(giay) } },
                bai: { [maBai(baiHienTai.url)]: { giay: FV.increment(giay) } }
            });
        }

        function moBai(info) {
            chotThoiGian();
            baiHienTai = info;
            batDauLuc = document.visibilityState === 'visible' ? Date.now() : null;
            const ngay = ngayHomNay();
            ghi({
                lanCuoi: FV.serverTimestamp(),
                soLanMoBai: FV.increment(1),
                ngay: { [ngay]: FV.increment(1) },
                baiCuoi: { ten: info.ten, khoa: khoa, url: info.url, luc: FV.serverTimestamp() },
                bai: {
                    [maBai(info.url)]: {
                        ten: info.ten, chuong: info.chuong, khoa: khoa, url: info.url,
                        luotMo: FV.increment(1), lanCuoi: FV.serverTimestamp()
                    }
                }
            });
            ghiNhatKy({ loai: 'mo_bai', khoa: khoa, ten: info.ten, chuong: info.chuong, url: info.url });
        }

        // Bài đang mở sẵn khi vào trang (bài mặc định hoặc bài cuối lần trước)
        if (iframe) {
            const src = boTitle(iframe.getAttribute('src'));
            const linkDau = Array.from(document.querySelectorAll('a[target="lesson-frame"]'))
                .find(function (a) { return boTitle(a.getAttribute('href')) === src; });
            if (laLinkBai(linkDau)) moBai(thongTinBai(linkDau));
        }

        document.addEventListener('click', function (e) {
            const link = e.target.closest && e.target.closest('a[target="lesson-frame"]');
            if (laLinkBai(link)) moBai(thongTinBai(link));
        }, true);

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') chotThoiGian();
            else batDauLuc = Date.now();
        });
        window.addEventListener('pagehide', chotThoiGian);
    }

    return {
        // Không bao giờ ném lỗi ra ngoài: lỗi ở đây không được làm hỏng trang học
        batDau: function (db, user, khoa) {
            try {
                if (!db || !user) return;
                chenBaiHocThem(db, khoa).then(function () {
                    moBaiTheoDiaChi(khoa);
                    ghiNhoHocTiep(user, khoa);
                    if (user.email !== ADMIN_EMAIL) batDauTheoDoi(db, user, khoa);
                }).catch(function (err) { console.warn('Lỗi theo dõi học tập:', err); });
            } catch (err) {
                console.warn('Lỗi theo dõi học tập:', err);
            }
        }
    };
})();
