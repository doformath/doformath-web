// Sidebar mục lục kéo đổi độ rộng (chỉ trên máy tính ≥ 1024px), dùng chung cho toan-10/11/12.html.
// Nhúng trong <head> (không defer) để đặt sẵn độ rộng đã lưu, tránh sidebar bị giật lúc tải trang:
//     <script src="../assets/js/dfm-sidebar.js"></script>
// Trang cần có <aside id="sidebar"> và thêm class "sb-closed" cho nó khi đóng mục lục.
// Kéo mép phải để đổi độ rộng · nhấp đúp để về mặc định · Tab tới tay nắm rồi dùng phím ←/→.
(function () {
    const KEY = 'doforMath_sidebarWidth';
    const MIN = 260, DEFAULT = 350;
    const maxW = () => Math.max(MIN, Math.min(640, window.innerWidth * 0.6));

    const st = document.createElement('style');
    st.textContent = [
        ':root { --sb-w: ' + DEFAULT + 'px; }',
        '#sidebar-resizer { display: none; position: absolute; top: 0; right: -5px; width: 10px; height: 100%;',
        '    cursor: col-resize; z-index: 50; touch-action: none; outline: none; }',
        // Trong lúc kéo: tắt hiệu ứng trượt, không cho iframe "nuốt" chuột
        '.sb-resizing, .sb-resizing * { cursor: col-resize !important; user-select: none !important; }',
        '.sb-resizing #sidebar { transition: none !important; }',
        '.sb-resizing iframe { pointer-events: none; }',
        '@media (min-width: 1024px) {',
        '    #sidebar { width: var(--sb-w); }',
        '    #sidebar.sb-closed { margin-left: calc(-1 * var(--sb-w)); }',
        '    #sidebar-resizer { display: block; }',
        '    #sidebar.sb-closed #sidebar-resizer { display: none; }',
        '}'
    ].join('\n');
    document.head.appendChild(st);

    function setW(w) {
        w = Math.round(Math.min(maxW(), Math.max(MIN, w)));
        document.documentElement.style.setProperty('--sb-w', w + 'px');
        return w;
    }
    let current = DEFAULT;
    try { current = parseInt(localStorage.getItem(KEY), 10) || DEFAULT; } catch (e) {}
    current = setW(current);
    function saveW() { try { localStorage.setItem(KEY, current); } catch (e) {} }

    document.addEventListener('DOMContentLoaded', function () {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        let handle = document.getElementById('sidebar-resizer');
        if (!handle) {
            // Vùng kéo vô hình ở mép phải mục lục (rê chuột vào sẽ đổi con trỏ)
            handle = document.createElement('div');
            handle.id = 'sidebar-resizer';
            handle.setAttribute('role', 'separator');
            handle.setAttribute('aria-orientation', 'vertical');
            handle.setAttribute('aria-label', 'Kéo để chỉnh độ rộng mục lục');
            handle.tabIndex = 0;
            sidebar.appendChild(handle);
        }

        handle.addEventListener('pointerdown', function (e) {
            if (window.innerWidth < 1024 || e.button !== 0) return;
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            document.body.classList.add('sb-resizing');
            const startX = e.clientX, startW = sidebar.getBoundingClientRect().width;

            const move = (ev) => { current = setW(startW + ev.clientX - startX); };
            const up = () => {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', up);
                handle.removeEventListener('pointercancel', up);
                document.body.classList.remove('sb-resizing');
                saveW();
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
            handle.addEventListener('pointercancel', up);
        });

        // Nhấp đúp → về độ rộng mặc định
        handle.addEventListener('dblclick', () => { current = setW(DEFAULT); saveW(); });

        // Dùng phím mũi tên khi tay nắm đang được chọn (Tab tới)
        handle.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                current = setW(current + (e.key === 'ArrowRight' ? 20 : -20));
                saveW();
            }
        });

        // Thu nhỏ cửa sổ thì sidebar tự co lại cho vừa
        window.addEventListener('resize', () => setW(current));
    });
})();
