// Đăng ký Service Worker và hiển thị nút "Cài ứng dụng" cho DoforMath.
// File này nằm ở thư mục gốc; mọi đường dẫn được tính từ vị trí của chính nó
// nên các trang ở thư mục con chỉ cần nhúng đúng đường dẫn tương đối tới pwa.js.
(function () {
    const script = document.currentScript;
    const root = new URL('./', script ? script.src : location.href);
    const DISMISS_KEY = 'doformath-install-dismissed';

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register(new URL('sw.js', root), { scope: root.pathname })
                .catch((err) => console.warn('Không đăng ký được Service Worker:', err));
        });
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (isStandalone) return;

    function wasDismissed() {
        try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
    }
    function rememberDismiss() {
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* bỏ qua */ }
    }

    function showBanner(message, actionLabel, onAction) {
        if (wasDismissed() || document.getElementById('dfm-install')) return;

        const box = document.createElement('div');
        box.id = 'dfm-install';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', 'Cài ứng dụng DoforMath');
        box.style.cssText = [
            'position:fixed', 'right:16px', 'bottom:16px', 'z-index:9999',
            'max-width:min(340px, calc(100vw - 32px))', 'display:flex', 'align-items:center', 'gap:12px',
            'padding:12px 14px', 'background:#fff', 'color:#1f2937', 'border-radius:16px',
            'box-shadow:0 10px 30px rgba(0,0,0,.15)', 'border:1px solid #ccfbf1',
            'font:500 14px/1.4 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
        ].join(';');

        const icon = document.createElement('img');
        icon.src = new URL('assets/icons/icon-192.png', root).href;
        icon.alt = '';
        icon.style.cssText = 'width:40px;height:40px;flex-shrink:0';

        const text = document.createElement('div');
        text.style.cssText = 'flex:1';
        text.innerHTML = message;

        const close = document.createElement('button');
        close.type = 'button';
        close.setAttribute('aria-label', 'Đóng');
        close.textContent = '×';
        close.style.cssText = 'border:0;background:none;color:#9ca3af;font-size:22px;line-height:1;cursor:pointer;padding:0 4px';
        close.onclick = () => { rememberDismiss(); box.remove(); };

        box.append(icon, text);
        if (actionLabel) {
            const action = document.createElement('button');
            action.type = 'button';
            action.textContent = actionLabel;
            action.style.cssText = 'border:0;border-radius:999px;background:#0d9488;color:#fff;font:inherit;font-weight:600;padding:8px 14px;cursor:pointer;white-space:nowrap';
            action.onclick = () => onAction(box);
            box.append(action);
        }
        box.append(close);
        document.body.appendChild(box);
    }

    // Android / Chrome / Edge: trình duyệt báo có thể cài đặt
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showBanner('<strong>Cài DoforMath</strong><br>Mở nhanh từ màn hình chính', 'Cài đặt', async (box) => {
            box.remove();
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome !== 'accepted') rememberDismiss();
            deferredPrompt = null;
        });
    });
    window.addEventListener('appinstalled', () => {
        rememberDismiss();
        const box = document.getElementById('dfm-install');
        if (box) box.remove();
    });

    // iPhone / iPad (Safari): không có nút cài tự động, chỉ hướng dẫn thủ công
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS && isSafari) {
        window.addEventListener('load', () => {
            showBanner('<strong>Cài DoforMath</strong><br>Nhấn <b>Chia sẻ</b> rồi chọn <b>Thêm vào MH chính</b>');
        });
    }
})();
