// Dùng chung cho các trang khóa học (toan-10/11/12.html), gọi sau khi học sinh được xác nhận có quyền:
//     dfmKhoaHoc.batDau(db, user, currentCourse);
// 1. Chèn các bài học thêm từ trang Admin (Firestore: bai_hoc_them) vào đúng chương trong mục lục.
// 2. Nhớ bài đang học (cho thẻ "Tiếp tục học" ở trang chủ) và mở thẳng bài qua địa chỉ ?bai=...
// 3. Ghi lại hoạt động học tập (Firestore: hoc_sinh/{uid} và hoc_sinh/{uid}/hoat_dong) để Admin theo dõi.
// 4. Tìm bài nhanh: ô tìm kiếm (gõ không dấu) ở đầu mục lục, tự mở đúng chương/bài đang học,
//    thanh "Bài trước / Bài tiếp" trên khung bài học, làm mờ các mục chưa có nội dung (about:blank).
// Trang chủ dùng dfmKhoaHoc.docBaiMoi(db, cacKhoa) để thông báo bài mới đăng.
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

    // Lúc học sinh bắt đầu thấy bài: lúc Admin hiện bài (congBoLuc), bài cũ chưa có trường này thì lấy lúc tạo
    function mocCongBo(bai) {
        const t = bai.congBoLuc || bai.taoLuc;
        return t && t.toMillis ? t.toMillis() : 0;
    }
    function laBaiMoi(bai) {
        const moc = mocCongBo(bai);
        return !!moc && Date.now() - moc < NGAY_LA_BAI_MOI * 86400000;
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
        if (laBaiMoi(bai)) {
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

    // Bài mới đăng trong 14 ngày gần đây của các khóa học sinh được học (thông báo ở trang chủ), mới nhất trước.
    // href là đúng link trong mục lục khóa học, để mở thẳng bài bằng ...toan-12.html?bai=<href>
    function docBaiMoi(db, cacKhoa) {
        if (!cacKhoa.length) return Promise.resolve([]);
        return db.collection('bai_hoc_them').where('khoa', 'in', cacKhoa).get().then(function (snap) {
            return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
                .filter(function (b) { return !b.an && b.ten && b.chuong && laBaiMoi(b); })
                .map(function (b) {
                    const href = (b.muc || []).map(function (m) { return taoHref(m, b.ten); }).find(Boolean);
                    return { id: b.id, khoa: b.khoa, ten: b.ten, chuong: b.chuong, luc: mocCongBo(b), href: href };
                })
                .filter(function (b) { return b.href; })
                .sort(function (a, b) { return b.luc - a.luc; });
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
        hienTrongMucLuc(link);
    }

    // Mở chương + bài chứa mục này trong mục lục, tô sáng và cuộn tới
    function hienTrongMucLuc(link) {
        try {
            const chuong = link.closest('[x-data*="openChapter"]'), khoiBai = link.closest('[x-data*="openLesson"]');
            if (window.Alpine && chuong) Alpine.$data(chuong).openChapter = true;
            if (window.Alpine && khoiBai) Alpine.$data(khoiBai).openLesson = true;
        } catch (e) {}
        danhDauDangHoc(link);
        setTimeout(function () { link.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 400);
    }

    // ---------- 4. Tìm bài nhanh ----------
    let capNhatThanhChuyenBai = function () {};   // gán lại khi đã tạo thanh "Bài trước / Bài tiếp"

    // Mục đang học (chỉ một mục tại một thời điểm): dòng nền teal nhạt bo góc, chữ + icon teal,
    // chấm tròn tô đặc có quầng sáng. Mỗi cặp [lớp thường, lớp đang học] được đổi qua lại cho nhau
    // (không chỉ thêm lớp, vì lớp màu đứng sau trong CSS sẽ thắng, vd. bg-white thắng bg-teal-500).
    // Lề âm bù cho phần đệm để chữ không bị xê dịch khi có nền; dòng <li> thành flow-root để lề âm
    // không bị gộp với khoảng cách giữa các dòng (nếu gộp, chữ tụt xuống lệch khỏi chấm tròn).
    const DANG_HOC = {
        dong: [['', 'flow-root']],
        link: [['text-slate-600', 'text-teal-700 font-semibold bg-teal-50 rounded-lg -mx-2.5 px-2.5 -my-1.5 py-1.5']],
        icon: [['text-slate-400', 'text-teal-600']],
        cham: [['bg-white border-teal-400', 'bg-teal-500 border-teal-500 ring-4 ring-teal-100']]
    };
    function doiLop(e, cacCap, batLen) {
        if (!e) return;
        cacCap.forEach(function (cap) {
            e.classList.remove.apply(e.classList, cap[batLen ? 0 : 1].split(' ').filter(Boolean));
            e.classList.add.apply(e.classList, cap[batLen ? 1 : 0].split(' ').filter(Boolean));
        });
    }
    function toMauDangHoc(a, batLen) {
        doiLop(a, DANG_HOC.link, batLen);
        doiLop(a.querySelector('i'), DANG_HOC.icon, batLen);
        doiLop(a.parentElement, DANG_HOC.dong, batLen);
        doiLop(a.parentElement && a.parentElement.querySelector(':scope > div'), DANG_HOC.cham, batLen);
    }
    function danhDauDangHoc(link) {
        document.querySelectorAll('[data-dfm-dang-hoc]').forEach(function (a) {
            a.removeAttribute('data-dfm-dang-hoc');
            a.removeAttribute('aria-current');
            toMauDangHoc(a, false);
        });
        if (!link) return capNhatThanhChuyenBai();
        link.setAttribute('data-dfm-dang-hoc', '');
        link.setAttribute('aria-current', 'page');
        toMauDangHoc(link, true);
        capNhatThanhChuyenBai();
    }

    // Các mục bài học có nội dung, theo đúng thứ tự trong mục lục (gồm cả bài học thêm từ Admin)
    function cacMucCoNoiDung() {
        return Array.from(document.querySelectorAll('#sidebar a[target="lesson-frame"]')).filter(laLinkBai);
    }

    // Mục ứng với bài đang mở trong khung: khớp đúng địa chỉ trước, không có thì bỏ qua tham số title
    function mucDangMo() {
        const iframe = document.getElementById('lesson-frame');
        const src = iframe && iframe.getAttribute('src');
        if (!src) return null;
        const ds = cacMucCoNoiDung();
        return ds.find(function (a) { return a.getAttribute('href') === src; })
            || ds.find(function (a) { return boTitle(a.getAttribute('href')) === boTitle(src); }) || null;
    }

    // Mở một mục như học sinh tự bấm (để các phần ghi nhớ / theo dõi vẫn chạy), rồi hiện nó trong mục lục
    function moMuc(link) {
        link.click();
        hienTrongMucLuc(link);
    }

    // Mục chưa có nội dung: làm mờ, gắn nhãn "Sắp có", không bấm được
    function lamMoMucTrong() {
        document.querySelectorAll('#sidebar a[target="lesson-frame"][href="about:blank"]').forEach(function (a) {
            if (a.hasAttribute('data-dfm-sap-co')) return;
            a.setAttribute('data-dfm-sap-co', '');
            a.setAttribute('aria-disabled', 'true');
            a.setAttribute('tabindex', '-1');
            a.classList.add('opacity-50', 'pointer-events-none');
            const nhan = el('span', 'ml-auto text-[10px] leading-4 font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded');
            nhan.textContent = 'Sắp có';
            a.appendChild(nhan);
        });
    }

    // Bỏ dấu tiếng Việt để tìm "tiem can" vẫn ra "Tiệm cận"
    function khongDau(s) {
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    }

    function taoOTimKiem() {
        const sidebar = document.getElementById('sidebar');
        const vungCuon = sidebar && sidebar.querySelector('.overflow-y-auto');
        if (!vungCuon || document.getElementById('dfm-tim-bai')) return;

        // Ô nhập nằm ở phần đầu mục lục (dưới dòng "Lộ trình học tập chi tiết")
        const khung = el('div', 'relative mt-3');
        khung.appendChild(el('i', 'fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none'));
        const o = el('input', 'w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition', {
            id: 'dfm-tim-bai', type: 'text', enterkeyhint: 'search', placeholder: 'Tìm bài… (vd: tiem can, xac suat)', autocomplete: 'off', 'aria-label': 'Tìm bài học'
        });
        const xoa = el('button', 'hidden absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50', { type: 'button', 'aria-label': 'Xóa tìm kiếm' });
        xoa.appendChild(el('i', 'fa-solid fa-xmark'));
        khung.append(o, xoa);
        vungCuon.previousElementSibling.appendChild(khung);

        const ketQua = el('div', 'space-y-2', { role: 'listbox', 'aria-label': 'Kết quả tìm bài' });
        ketQua.hidden = true;   // dùng thuộc tính hidden để space-y của mục lục không chừa khoảng trống phía trên
        vungCuon.prepend(ketQua);

        // Tạo lại mỗi lần gõ (vài trăm mục, rất nhanh): luôn gồm cả bài học thêm từ Admin chèn vào sau
        function taoChiMuc() {
            return cacMucCoNoiDung().map(function (a) {
                const info = thongTinBai(a);
                return { link: a, info: info, tenBai: khongDau(info.tenBai), chuoi: khongDau(info.ten + ' ' + info.chuong) };
            });
        }

        function veKetQua() {
            const tu = khongDau(o.value).split(/\s+/).filter(Boolean);
            xoa.classList.toggle('hidden', !o.value);
            Array.from(vungCuon.children).forEach(function (c) { if (c !== ketQua) c.classList.toggle('hidden', tu.length > 0); });
            ketQua.hidden = !tu.length;
            ketQua.textContent = '';
            if (!tu.length) return;

            const khop = taoChiMuc()
                .filter(function (m) { return tu.every(function (t) { return m.chuoi.includes(t); }); })
                // Khớp ngay trong tên bài lên trước
                .map(function (m, i) { return { m: m, diem: (tu.every(function (t) { return m.tenBai.includes(t); }) ? 0 : 1), i: i }; })
                .sort(function (a, b) { return a.diem - b.diem || a.i - b.i; })
                .slice(0, 40);

            if (!khop.length) {
                const rong = el('p', 'text-sm text-slate-500 text-center px-4 py-8');
                rong.textContent = 'Không tìm thấy bài nào. Thử gõ từ khác nhé!';
                ketQua.appendChild(rong);
                return;
            }
            khop.forEach(function (k) {
                const m = k.m;
                const nut = el('button', 'w-full text-left flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50 transition-colors', { type: 'button', role: 'option' });
                const icon = m.link.querySelector('i');
                const lopIcon = icon ? icon.className.split(/\s+/).filter(function (c) { return /^fa-/.test(c); }).join(' ') : 'fa-regular fa-file-lines';
                nut.appendChild(el('i', lopIcon + ' text-teal-600 mt-0.5 shrink-0'));
                const chu = el('div', 'min-w-0');
                const dong1 = el('div', 'text-sm font-semibold text-slate-800 leading-snug line-clamp-2');
                dong1.textContent = m.info.ten;
                const dong2 = el('div', 'text-xs text-slate-500 mt-0.5 truncate');
                dong2.textContent = m.info.chuong;
                chu.append(dong1, dong2);
                nut.appendChild(chu);
                nut.addEventListener('click', function () { chonKetQua(m.link); });
                ketQua.appendChild(nut);
            });
        }

        function chonKetQua(link) {
            o.value = '';
            veKetQua();
            moMuc(link);
        }

        o.addEventListener('input', veKetQua);
        o.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                const dau = ketQua.querySelector('button');
                if (dau) { e.preventDefault(); dau.click(); }
            } else if (e.key === 'Escape') {
                o.value = '';
                veKetQua();
            }
        });
        xoa.addEventListener('click', function () { o.value = ''; veKetQua(); o.focus(); });
    }

    // Thanh "Bài trước / Bài tiếp" ở đầu khung bài học; bấm tên bài ở giữa để mở mục lục
    function taoThanhChuyenBai() {
        const iframe = document.getElementById('lesson-frame');
        if (!iframe || document.getElementById('dfm-chuyen-bai')) return;
        const CAO = 44;
        const thanh = el('div', 'absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-2 bg-white border-b border-slate-200', { id: 'dfm-chuyen-bai' });
        thanh.style.height = CAO + 'px';
        const lopNut = 'shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-teal-50 hover:text-teal-600 transition-colors disabled:opacity-40 disabled:pointer-events-none';
        const truoc = el('button', lopNut, { type: 'button', 'aria-label': 'Bài trước' });
        truoc.innerHTML = '<i class="fa-solid fa-chevron-left text-xs"></i><span class="hidden sm:inline">Bài trước</span>';
        const tiep = el('button', lopNut, { type: 'button', 'aria-label': 'Bài tiếp' });
        tiep.innerHTML = '<span class="hidden sm:inline">Bài tiếp</span><i class="fa-solid fa-chevron-right text-xs"></i>';
        const giua = el('button', 'flex-1 min-w-0 text-center text-sm font-semibold text-slate-700 truncate hover:text-teal-600 transition-colors', { type: 'button', title: 'Mở mục lục' });
        thanh.append(truoc, giua, tiep);
        iframe.parentElement.prepend(thanh);
        iframe.style.top = CAO + 'px';
        iframe.style.height = 'calc(100% - ' + CAO + 'px)';

        giua.addEventListener('click', function () {
            const khoi = document.getElementById('course-content');
            try { if (window.Alpine && khoi) Alpine.$data(khoi).sidebarOpen = true; } catch (e) {}
            const link = document.querySelector('[data-dfm-dang-hoc]');
            if (link) hienTrongMucLuc(link);
        });

        function canhBen(buoc) {
            const ds = cacMucCoNoiDung();
            const i = ds.indexOf(document.querySelector('[data-dfm-dang-hoc]'));
            return i < 0 ? null : ds[i + buoc] || null;
        }
        truoc.addEventListener('click', function () { const m = canhBen(-1); if (m) moMuc(m); });
        tiep.addEventListener('click', function () { const m = canhBen(1); if (m) moMuc(m); });

        capNhatThanhChuyenBai = function () {
            const link = document.querySelector('[data-dfm-dang-hoc]');
            const info = link ? thongTinBai(link) : null;
            giua.textContent = info ? info.ten : 'Mục lục';
            const t = canhBen(-1), s = canhBen(1);
            truoc.disabled = !t;
            tiep.disabled = !s;
            truoc.title = t ? 'Bài trước: ' + thongTinBai(t).ten : '';
            tiep.title = s ? 'Bài tiếp: ' + thongTinBai(s).ten : '';
        };
    }

    // Dựng một lần (gọi được sớm, trước khi Firebase xác nhận); gọi lại thì chỉ đồng bộ mục đang học,
    // vd sau khi chèn bài học thêm từ Admin (bài cuối có thể là một bài như vậy)
    let daDungTimBai = false;
    function batDauTimBaiNhanh(khoa) {
        if (daDungTimBai) return dongBoDangHoc();
        daDungTimBai = true;
        lamMoMucTrong();
        taoOTimKiem();
        taoThanhChuyenBai();

        // Mở lại bài học lần trước (nếu trang chưa tự mở) và bung đúng chương/bài đó trong mục lục
        const iframe = document.getElementById('lesson-frame');
        const khoaLuu = 'doforMath_lastLesson_' + khoa.replace('-', '');
        let daLuu = null;
        try { daLuu = localStorage.getItem(khoaLuu); } catch (e) {}
        const linkLuu = daLuu && cacMucCoNoiDung().find(function (a) { return a.getAttribute('href') === daLuu; });
        if (iframe && linkLuu && iframe.getAttribute('src') !== daLuu) iframe.src = daLuu;
        dongBoDangHoc();

        document.addEventListener('click', function (e) {
            const link = e.target.closest && e.target.closest('#sidebar a[target="lesson-frame"]');
            if (!laLinkBai(link)) return;
            try { localStorage.setItem(khoaLuu, link.getAttribute('href')); } catch (err) {}
            danhDauDangHoc(link);
        });
    }

    function dongBoDangHoc() {
        const dangMo = mucDangMo();
        if (!dangMo) return capNhatThanhChuyenBai();
        if (!dangMo.hasAttribute('data-dfm-dang-hoc')) hienTrongMucLuc(dangMo);
    }

    // Chạy sau khi trang tải xong và các trình nghe DOMContentLoaded khác (Alpine, mở lại bài cuối) đã chạy
    function sauKhiTaiTrang(viec) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(viec, 0); });
        else setTimeout(viec, 0);
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
        docBaiMoi: docBaiMoi,
        // Dựng phần giao diện không cần Firebase (tìm bài, bài trước / tiếp, mục đang học) ngay khi trang mở,
        // dùng khi đã nhớ quyền khóa học trên máy (dfm-phien.js); batDau gọi lại sau vẫn an toàn
        batDauGiaoDien: function (khoa) {
            sauKhiTaiTrang(function () {
                try { batDauTimBaiNhanh(khoa); } catch (err) { console.warn('Lỗi tìm bài nhanh:', err); }
            });
        },
        // Không bao giờ ném lỗi ra ngoài: lỗi ở đây không được làm hỏng trang học
        batDau: function (db, user, khoa) {
            try {
                if (!db || !user) return;
                chenBaiHocThem(db, khoa).then(function () {
                    // Đợi trang tải xong (Alpine đã chạy, iframe đã mở bài cuối) rồi mới dựng các phần tìm bài
                    return new Promise(sauKhiTaiTrang);
                }).then(function () {
                    try { batDauTimBaiNhanh(khoa); } catch (err) { console.warn('Lỗi tìm bài nhanh:', err); }
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
