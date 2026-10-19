// Tài khoản học sinh DoforMath (dùng chung cho trang đăng nhập, khóa học, Góc học tập)
// 1. Đăng nhập / liên kết Google: thử cửa sổ bật lên, bị chặn (hay gặp trên iPhone) thì chuyển trang.
// 2. Đọc quyền khóa học (phan_quyen/{email}). Học sinh vừa đổi email do thầy cấp (@dfm.com) sang email thật
//    thì tự chuyển quyền từ email cũ sang email mới (Firestore Rules chỉ cho phép khi email mới đã xác minh
//    và đúng với yêu cầu đổi email học sinh ghi lại trước đó ở doi_email/{uid}).
window.dfmTaiKhoan = (function () {
    const DUOI_EMAIL_CAP = '@dfm.com';

    function laEmailCap(email) { return String(email || '').toLowerCase().endsWith(DUOI_EMAIL_CAP); }
    function coGoogle(user) { return !!(user && user.providerData.some(function (p) { return p.providerId === 'google.com'; })); }
    function emailGoogle(user) {
        const p = user && user.providerData.find(function (x) { return x.providerId === 'google.com'; });
        return p ? p.email : '';
    }
    function coMatKhau(user) { return !!(user && user.providerData.some(function (p) { return p.providerId === 'password'; })); }
    // App cài trên màn hình chính iPhone (PWA): cửa sổ bật lên của Google thường không quay lại được app
    function laAppIphone() { return window.navigator.standalone === true; }

    function nhaCungCapGoogle() {
        const p = new firebase.auth.GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account' });
        return p;
    }
    const CAN_CHUYEN_TRANG = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'];

    async function dangNhapGoogle() {
        firebase.auth().languageCode = 'vi';
        try {
            return await firebase.auth().signInWithPopup(nhaCungCapGoogle());
        } catch (err) {
            if (CAN_CHUYEN_TRANG.includes(err.code)) { await firebase.auth().signInWithRedirect(nhaCungCapGoogle()); return null; }
            throw err;
        }
    }
    async function lienKetGoogle(user) {
        firebase.auth().languageCode = 'vi';
        try {
            return await user.linkWithPopup(nhaCungCapGoogle());
        } catch (err) {
            if (CAN_CHUYEN_TRANG.includes(err.code)) { await user.linkWithRedirect(nhaCungCapGoogle()); return null; }
            throw err;
        }
    }
    // Lỗi đăng nhập / liên kết Google bằng tiếng Việt
    function loiGoogle(err) {
        const ma = err && err.code;
        if (ma === 'auth/popup-closed-by-user' || ma === 'auth/cancelled-popup-request' || ma === 'auth/user-cancelled') return '';
        if (ma === 'auth/credential-already-in-use' || ma === 'auth/email-already-in-use')
            return 'Tài khoản Google này đã gắn với một tài khoản DoforMath khác. Hãy chọn tài khoản Google khác.';
        if (ma === 'auth/account-exists-with-different-credential')
            return 'Email này đã có tài khoản đăng nhập bằng mật khẩu. Hãy đăng nhập bằng mật khẩu rồi vào Góc học tập để liên kết Google.';
        if (ma === 'auth/provider-already-linked') return 'Tài khoản đã liên kết Google từ trước.';
        if (ma === 'auth/unauthorized-domain') return 'Tên miền web chưa được cho phép đăng nhập Google (thầy cần thêm trong Firebase Console).';
        if (ma === 'auth/operation-not-allowed') return 'Đăng nhập Google chưa được bật (thầy cần bật trong Firebase Console).';
        if (ma === 'auth/network-request-failed') return 'Không có mạng. Kiểm tra kết nối rồi thử lại.';
        return 'Không đăng nhập được bằng Google (' + (ma || (err && err.message)) + ').' +
            (laAppIphone() ? ' Trên app iPhone, hãy mở web bằng Safari rồi thử lại.' : '');
    }

    // Học sinh vừa đổi sang email thật (đã xác minh): chuyển quyền khóa học + hồ sơ học tập sang email mới
    async function chuyenQuyenNeuCan(db, user) {
        if (!user || !user.emailVerified) return false;
        let yc;
        try {
            const s = await db.collection('doi_email').doc(user.uid).get();
            if (!s.exists) return false;
            yc = s.data();
        } catch (e) { return false; }
        if (!yc || yc.emailMoi !== user.email || yc.emailCu === user.email) return false;
        const cu = db.collection('phan_quyen').doc(yc.emailCu);
        const moi = db.collection('phan_quyen').doc(user.email);
        const [sCu, sMoi] = await Promise.all([cu.get().catch(function () { return null; }), moi.get().catch(function () { return null; })]);
        const lo = db.batch();
        if (sCu && sCu.exists) {
            if (!(sMoi && sMoi.exists)) lo.set(moi, sCu.data());
            lo.delete(cu);   // email cũ không còn quyền: tránh người khác đăng ký lại email @dfm.com đó để vào học
        }
        lo.delete(db.collection('doi_email').doc(user.uid));
        await lo.commit();
        try { await db.collection('hoc_sinh').doc(user.uid).set({ email: user.email }, { merge: true }); } catch (e) {}
        return true;
    }

    // Quyền khóa học của học sinh: { 'toan-12': true, ... } hoặc {} nếu chưa có
    async function docQuyen(db, user) {
        const s = await db.collection('phan_quyen').doc(user.email).get();
        if (s.exists) return s.data() || {};
        if (await chuyenQuyenNeuCan(db, user).catch(function () { return false; })) {
            const s2 = await db.collection('phan_quyen').doc(user.email).get();
            return s2.exists ? s2.data() || {} : {};
        }
        return {};
    }

    return {
        laEmailCap: laEmailCap, coGoogle: coGoogle, emailGoogle: emailGoogle, coMatKhau: coMatKhau, laAppIphone: laAppIphone,
        dangNhapGoogle: dangNhapGoogle, lienKetGoogle: lienKetGoogle, loiGoogle: loiGoogle,
        chuyenQuyenNeuCan: chuyenQuyenNeuCan, docQuyen: docQuyen
    };
})();
