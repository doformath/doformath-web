// Cấu hình Tailwind dùng chung cho cả site.
// Sau khi thêm/sửa class Tailwind trong HTML hoặc JS, chạy:  npm run build:css
// để tạo lại assets/css/tailwind.css (chỉ chứa các class đang thực sự dùng).
module.exports = {
    // Chế độ tối bật bằng class "dark" trên <html> (xem assets/js/dfm-giao-dien.js)
    darkMode: 'class',
    content: [
        './*.html',
        './courses/**/*.html',
        './exam/**/*.html',
        './documents/**/*.html',
        './assets/js/**/*.js'
    ],
    theme: {
        extend: {
            fontFamily: {
                // Trang nào cần font khác thì đặt :root { --font-chu: "Tên font"; }
                sans: ['var(--font-chu, "Inter")', 'sans-serif'],
                math: ['KaTeX_Math', 'KaTeX_Main', 'Times New Roman', 'serif']
            },
            colors: {
                // Màu chính teal #0d9488; trang nào cần màu khác thì đặt :root { --mau-chinh: R G B; }
                primary: 'rgb(var(--mau-chinh, 13 148 136) / <alpha-value>)',
                secondary: '#facc15'
            }
        }
    }
};
