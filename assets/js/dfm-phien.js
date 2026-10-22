// Phiên đăng nhập nhớ trên máy, để các trang cần đăng nhập hiện ngay thay vì chờ Firebase (khoảng 0,5–1,5 giây).
// Nhúng ở cuối <body>, TRƯỚC các thẻ <script> Firebase (để chạy được ngay khi SDK còn đang tải):
//     <script src="assets/js/dfm-phien.js"></script>
// - Nhớ { email, uid, quyen } sau khi Firebase xác nhận; đăng xuất / đổi tài khoản thì tự xóa, kèm dữ liệu đệm.
// - Header (tên học sinh, nút đăng nhập / đăng xuất) hiện ngay theo phiên đã nhớ.
// - Dữ liệu đệm (dfmPhien.docDem / ghiDem): trang vẽ ngay dữ liệu lần trước rồi cập nhật khi có dữ liệu mới.
// Phiên đã nhớ chỉ để hiện nhanh: Firebase vẫn kiểm tra lại như cũ, quyền thật do Firestore Rules giữ.
window.dfmPhien = (function () {
    const KHOA = 'dfm_phien';
    const TIEN_TO_DEM = 'dfm_dem_';
    const ADMIN_EMAIL = 'thanhdo@dfm.com';
    const DEM_TOI_DA = 1500000;   // ký tự; dữ liệu đệm lớn hơn thì thôi không lưu (localStorage chỉ khoảng 5 MB)

    function doc() {
        try { return JSON.parse(localStorage.getItem(KHOA)) || null; } catch (e) { return null; }
    }
    function ghi(p) {
        try { localStorage.setItem(KHOA, JSON.stringify(p)); } catch (e) {}
    }
    function xoa() {
        try {
            Object.keys(localStorage).forEach(function (k) { if (k === KHOA || k.indexOf(TIEN_TO_DEM) === 0) localStorage.removeItem(k); });
        } catch (e) {}
    }

    // Firebase đã xác nhận tài khoản: đổi tài khoản thì bỏ quyền + dữ liệu đệm của tài khoản cũ
    function luuNguoiDung(user) {
        const p = doc();
        if (p && p.uid === user.uid) {
            if (p.email !== user.email) { p.email = user.email; ghi(p); }
            return;
        }
        xoa();
        ghi({ email: user.email, uid: user.uid });
    }
    function luuQuyen(user, quyen) {
        luuNguoiDung(user);
        const p = doc();
        p.quyen = quyen || {};
        ghi(p);
    }
    function coQuyen(khoa) {
        const p = doc();
        return !!(p && p.quyen && p.quyen[khoa] === true);
    }

    // Dữ liệu đệm của tài khoản đang nhớ (ten: tên ngắn, vd 'phong-thi')
    function docDem(ten, uid) {
        const p = doc();
        if (!p || (uid && p.uid !== uid)) return null;
        try {
            const v = JSON.parse(localStorage.getItem(TIEN_TO_DEM + ten));
            return v && v.uid === p.uid ? v.duLieu : null;
        } catch (e) { return null; }
    }
    function ghiDem(ten, uid, duLieu) {
        const p = doc();
        if (!p || p.uid !== uid) return;
        try {
            const chuoi = JSON.stringify({ uid: uid, luc: Date.now(), duLieu: duLieu });
            if (chuoi.length <= DEM_TOI_DA) localStorage.setItem(TIEN_TO_DEM + ten, chuoi);
            else localStorage.removeItem(TIEN_TO_DEM + ten);
        } catch (e) {}
    }

    // Header dùng chung (index, courses, phong-thi, goc-hoc-tap, tai-lieu-mien-phi): hiện ngay theo phiên đã nhớ.
    // Trang chưa có phiên thì giữ nguyên, chờ Firebase như cũ.
    function hienHeader(p) {
        const $ = function (id) { return document.getElementById(id); };
        if (!p || !$('auth-container')) return;
        if ($('khu-vuc-dang-nhap')) $('khu-vuc-dang-nhap').style.display = 'none';
        if ($('khu-vuc-user')) $('khu-vuc-user').style.display = 'flex';
        if ($('nutDangXuatMobile')) $('nutDangXuatMobile').style.display = 'flex';
        if ($('ten-user')) $('ten-user').innerText = String(p.email || '').split('@')[0];
        document.querySelectorAll('[data-admin-link]').forEach(function (a) { a.style.display = p.email === ADMIN_EMAIL ? '' : 'none'; });
        $('auth-container').style.opacity = '1';
    }
    hienHeader(doc());

    // Theo dõi đăng nhập: cập nhật / xóa phiên. Chờ sau DOMContentLoaded một nhịp vì có trang (index.html)
    // tải SDK kiểu defer và gọi initializeApp ngay trong trình nghe DOMContentLoaded của trang
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
            try {
                if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
                firebase.auth().onAuthStateChanged(function (user) {
                    if (user) luuNguoiDung(user); else xoa();
                });
            } catch (e) {}
        }, 0);
    });

    return { doc: doc, xoa: xoa, luuNguoiDung: luuNguoiDung, luuQuyen: luuQuyen, coQuyen: coQuyen, docDem: docDem, ghiDem: ghiDem };
})();
