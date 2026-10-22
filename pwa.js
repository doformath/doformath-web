// Đăng ký Service Worker cho DoforMath.
// File này nằm ở thư mục gốc; mọi đường dẫn được tính từ vị trí của chính nó
// nên các trang ở thư mục con chỉ cần nhúng đúng đường dẫn tương đối tới pwa.js.
(function () {
    const script = document.currentScript;
    const root = new URL('./', script ? script.src : location.href);

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register(new URL('sw.js', root), { scope: root.pathname })
                .catch((err) => console.warn('Không đăng ký được Service Worker:', err));
        });
    }
})();
