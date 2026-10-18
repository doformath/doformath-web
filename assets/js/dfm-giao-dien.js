// Giao diện sáng / tối cho cả site.
// Nhúng trong <head>, TRƯỚC link CSS và KHÔNG defer, để trang tối không bị nháy trắng lúc tải:
//     <script src="assets/js/dfm-giao-dien.js"></script>
// - Mặc định theo cài đặt sáng/tối của máy; bấm nút có thuộc tính data-doi-giao-dien thì nhớ lựa chọn.
// - Đổi ở một nơi là các tab khác và trang bài giảng trong khung (cùng tên miền) đổi theo ngay.
// - Màu tối của các class Tailwind do scripts/che-do-toi.mjs sinh khi build CSS.
(function () {
    const KHOA = 'dfm-giao-dien';                       // 'toi' | 'sang' | (không có) = theo máy
    const MAU_THANH_TREN = { sang: '#0d9488', toi: '#0f172a' };
    const mayToi = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function daChon() {
        try { return localStorage.getItem(KHOA); } catch (e) { return null; }
    }
    function laToi() {
        const chon = daChon();
        return chon ? chon === 'toi' : !!(mayToi && mayToi.matches);
    }
    function apDung() {
        const toi = laToi();
        document.documentElement.classList.toggle('dark', toi);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', toi ? MAU_THANH_TREN.toi : MAU_THANH_TREN.sang);
        document.querySelectorAll('[data-doi-giao-dien]').forEach(function (nut) {
            nut.setAttribute('aria-pressed', String(toi));
            nut.title = toi ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
        });
    }

    apDung();
    document.addEventListener('DOMContentLoaded', apDung);   // nút và thẻ meta nằm sau script này
    if (mayToi && mayToi.addEventListener) mayToi.addEventListener('change', function () { if (!daChon()) apDung(); });
    window.addEventListener('storage', function (e) { if (e.key === KHOA) apDung(); });
    document.addEventListener('click', function (e) {
        const nut = e.target.closest && e.target.closest('[data-doi-giao-dien]');
        if (!nut) return;
        try { localStorage.setItem(KHOA, laToi() ? 'sang' : 'toi'); } catch (err) {}
        apDung();
    });
})();
