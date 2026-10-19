// Đề thi từ file TeX (gói ex_test): chuyển TeX → câu hỏi HTML, chấm điểm, hiển thị công thức và hình.
// Dùng chung cho trang Quản trị (tải đề lên, xem trước) và trang làm bài exam/lam-bai.html.
//
// Các dạng câu nhận diện được (trong \begin{ex} ... \end{ex}):
//   Phần I   — nhiều lựa chọn: \choice{..}{\True ..}{..}{..}
//   Phần II  — đúng/sai:       \choiceTF{\True ..}{..}{\True ..}{..}
//   Phần III — trả lời ngắn:   \shortans[oly]{2,5}
// Lời giải: \loigiai{...}. Hình: tikzpicture (kể cả trong \immini{chữ}{hình}) hoặc \includegraphics.
// Câu không thuộc 3 dạng trên (tự luận) được bỏ qua.
window.dfmDeThi = (function () {
    'use strict';

    // ---------- Hiển thị công thức (KaTeX) ----------
    const MACRO = {
        '\\heva': '\\left\\{\\begin{aligned}#1\\end{aligned}\\right.',
        '\\hoac': '\\left[\\begin{aligned}#1\\end{aligned}\\right.',
        '\\R': '\\mathbb{R}', '\\N': '\\mathbb{N}', '\\Z': '\\mathbb{Z}', '\\Q': '\\mathbb{Q}',
        '\\degree': '^{\\circ}'
    };
    function veToan(el) {
        if (!el || !window.renderMathInElement) return;
        window.renderMathInElement(el, {
            delimiters: [
                { left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true },
                { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }
            ],
            macros: Object.assign({}, MACRO), throwOnError: false, strict: 'ignore',
            ignoredClasses: ['dfm-khong-toan']
        });
    }

    // Gắn hình đã vẽ (SVG từ TikZ) hoặc ảnh tải lên vào các chỗ <span class="dfm-hinh" data-hinh="k">
    function ganHinh(el, hinh) {
        if (!el) return;
        el.querySelectorAll('.dfm-hinh[data-hinh]').forEach(function (o) {
            const h = (hinh || [])[+o.getAttribute('data-hinh')];
            o.classList.toggle('dfm-hinh-phai', !!(h && h.benPhai));
            if (!h) return;
            if (h.url) o.innerHTML = '<img src="' + h.url.replace(/"/g, '&quot;') + '" alt="Hình minh họa">';
            else if (h.svg) o.innerHTML = h.svg;
            else o.innerHTML = '<span class="dfm-hinh-thieu">[Hình chưa có]</span>';
        });
    }

    // ---------- Đọc cấu trúc TeX ----------
    function boGhiChu(s) {
        return s.split('\n').map(function (dong) {
            for (let i = 0; i < dong.length; i++) {
                if (dong[i] === '\\') { i++; continue; }
                if (dong[i] === '%') return dong.slice(0, i);
            }
            return dong;
        }).join('\n');
    }

    // Nhóm {…} bắt đầu tại i (bỏ qua khoảng trắng trước): { noiDung, ket } hoặc null
    function docNhom(s, i) {
        while (i < s.length && /\s/.test(s[i])) i++;
        if (s[i] !== '{') return null;
        let sau = 0;
        for (let j = i; j < s.length; j++) {
            const c = s[j];
            if (c === '\\') { j++; continue; }
            if (c === '{') sau++;
            else if (c === '}' && --sau === 0) return { noiDung: s.slice(i + 1, j), ket: j + 1 };
        }
        return null;
    }
    // Đối số tùy chọn […] ngay sau lệnh: trả về vị trí sau nó (hoặc i nếu không có)
    function boTuyChon(s, i) {
        let k = i;
        while (k < s.length && /[ \t]/.test(s[k])) k++;
        if (s[k] !== '[') return i;
        let sau = 0;
        for (let j = k; j < s.length; j++) {
            const c = s[j];
            if (c === '\\') { j++; continue; }
            if (c === '{') sau++; else if (c === '}') sau--;
            else if (c === ']' && sau === 0) return j + 1;
        }
        return i;
    }
    function timLenh(s, ten, tu) {
        const re = new RegExp('\\\\' + ten + '(?![A-Za-z])', 'g');
        re.lastIndex = tu || 0;
        const m = re.exec(s);
        return m ? { dau: m.index, sau: m.index + m[0].length } : null;
    }
    // Lấy lệnh \ten[..]{..}{..}… (tối đa toiDa nhóm) ra khỏi s
    function layLenh(s, ten, toiDa) {
        const l = timLenh(s, ten);
        if (!l) return null;
        let i = boTuyChon(s, l.sau);
        const nhom = [];
        while (nhom.length < toiDa) {
            const g = docNhom(s, i);
            if (!g) break;
            nhom.push(g.noiDung);
            i = g.ket;
        }
        return { nhom: nhom, conLai: s.slice(0, l.dau) + ' ' + s.slice(i) };
    }

    // Tách hình: thay bằng \DFMHINH{k}, thông tin hình đưa vào mảng hinh
    function themHinh(tex, hinh, benPhai) {
        const tikz = tex.match(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/);
        const anh = tex.match(/\\includegraphics\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/);
        if (!tikz && !anh) return null;
        hinh.push({ tikz: tikz ? tikz[0] : '', tenAnh: !tikz && anh ? anh[1] : '', benPhai: !!benPhai });
        return hinh.length - 1;
    }
    function tachHinh(s, hinh) {
        let l;
        // \immini[..]{chữ}{hình}: hình đặt TRƯỚC chữ để nổi sang phải cạnh phần chữ
        while ((l = timLenh(s, 'immini'))) {
            const a = docNhom(s, boTuyChon(s, l.sau));
            const b = a && docNhom(s, a.ket);
            if (!b) { s = s.slice(0, l.dau) + s.slice(l.sau); continue; }
            const k = themHinh(b.noiDung, hinh, true);
            s = s.slice(0, l.dau) + (k !== null ? '\\DFMHINH{' + k + '} ' : '') + a.noiDung + s.slice(b.ket);
        }
        s = s.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, function (m) { return '\\DFMHINH{' + themHinh(m, hinh, false) + '}'; });
        s = s.replace(/\\includegraphics\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, function (m) { return '\\DFMHINH{' + themHinh(m, hinh, false) + '}'; });
        return s;
    }

    const RE_TRUE = /\\True(?![A-Za-z])/;

    function phanTich(tex) {
        const kq = { cauHoi: [], dapAn: {}, hinh: [], canhBao: [], boQua: 0 };
        const s = boGhiChu(String(tex || '')).replace(/\r\n?/g, '\n');
        const reEx = /\\begin\{ex\}(?:\s*\[[^\]]*\])?([\s\S]*?)\\end\{ex\}/g;
        let m, stt = 0;
        while ((m = reEx.exec(s))) {
            stt++;
            let than = tachHinh(m[1], kq.hinh);
            let loiGiai = '';
            const lg = layLenh(than, 'loigiai', 1);
            if (lg) { loiGiai = lg.nhom[0] || ''; than = lg.conLai; }

            let loai = null, luaChon = [], dung = null;
            const tf = layLenh(than, 'choiceTF', 6);
            const mc = !tf && layLenh(than, 'choice', 6);
            const sa = !tf && !mc && layLenh(than, 'shortans', 1);
            if (tf) {
                loai = 'tf'; than = tf.conLai;
                dung = tf.nhom.map(function (g) { return RE_TRUE.test(g); });
                luaChon = tf.nhom.map(function (g, i) { return { key: 'abcdef'[i], html: texSangHtml(g.replace(RE_TRUE, '')) }; });
                if (tf.nhom.length !== 4) kq.canhBao.push('Câu ' + stt + ' (đúng/sai) có ' + tf.nhom.length + ' ý (thường là 4).');
            } else if (mc) {
                loai = 'mc'; than = mc.conLai;
                const iDung = mc.nhom.findIndex(function (g) { return RE_TRUE.test(g); });
                dung = iDung >= 0 ? 'ABCDEF'[iDung] : null;
                luaChon = mc.nhom.map(function (g, i) { return { key: 'ABCDEF'[i], html: texSangHtml(g.replace(RE_TRUE, '')) }; });
                if (!dung) kq.canhBao.push('Câu ' + stt + ' (trắc nghiệm) chưa đánh dấu đáp án đúng bằng \\True.');
            } else if (sa) {
                loai = 'sa'; than = sa.conLai;
                // 10{,}5 (cách gõ dấu phẩy thập phân trong TeX) → 10,5
                dung = String(sa.nhom[0] || '').replace(/[${}]/g, '').replace(/\s+/g, '').trim();
                if (!dung) kq.canhBao.push('Câu ' + stt + ' (trả lời ngắn) chưa có đáp án trong \\shortans{...}.');
                else if (soChuan(dung) === null) kq.canhBao.push('Câu ' + stt + ': đáp án "' + dung + '" không phải số, học sinh khó nhập đúng bằng bàn phím số.');
                else if (dung.length > 4) kq.canhBao.push('Câu ' + stt + ': đáp án "' + dung + '" dài hơn 4 ký tự, phiếu tô chỉ có 4 ô.');
            } else {
                kq.boQua++;
                continue;
            }
            const id = 'c' + (kq.cauHoi.length + 1);
            kq.cauHoi.push({ id: id, loai: loai, noiDung: texSangHtml(than), luaChon: luaChon, stt: stt });
            kq.dapAn[id] = { dung: dung, loiGiai: texSangHtml(loiGiai) };
        }
        // Sắp theo phần I → II → III (giữ thứ tự trong từng phần)
        const thuTu = { mc: 0, tf: 1, sa: 2 };
        kq.cauHoi.sort(function (a, b) { return thuTu[a.loai] - thuTu[b.loai] || a.stt - b.stt; });
        kq.cauHoi.forEach(function (q) { delete q.stt; });
        if (!stt) kq.canhBao.push('Không tìm thấy câu hỏi nào (\\begin{ex} ... \\end{ex}).');

        // Bỏ hình của các câu đã bỏ qua (tự luận) và đánh lại số thứ tự hình
        const cacHtml = [];
        kq.cauHoi.forEach(function (q) {
            cacHtml.push([q, 'noiDung']);
            q.luaChon.forEach(function (o) { cacHtml.push([o, 'html']); });
            cacHtml.push([kq.dapAn[q.id], 'loiGiai']);
        });
        const dangDung = new Set();
        cacHtml.forEach(function (x) { (x[0][x[1]] || '').replace(/data-hinh="(\d+)"/g, function (_, k) { dangDung.add(+k); return _; }); });
        const soMoi = {}, hinhMoi = [];
        kq.hinh.forEach(function (h, i) { if (dangDung.has(i)) { soMoi[i] = hinhMoi.length; hinhMoi.push(h); } });
        cacHtml.forEach(function (x) { x[0][x[1]] = (x[0][x[1]] || '').replace(/data-hinh="(\d+)"/g, function (_, k) { return 'data-hinh="' + soMoi[k] + '"'; }); });
        kq.hinh = hinhMoi;
        return kq;
    }

    // ---------- Chuyển chữ TeX → HTML (công thức giữ nguyên để KaTeX vẽ) ----------
    function thoatHtml(x) {
        return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function texSangHtml(src) {
        if (!src || !String(src).trim()) return '';
        const giu = [];
        const datHtml = function (x) { return '\u0000' + (giu.push(x) - 1) + '\u0000'; };
        const datToan = function (x) { return datHtml(thoatHtml(x)); };
        let s = String(src);

        s = s.replace(/\\\$/g, function () { return datHtml('<span class="dfm-khong-toan">$</span>'); });
        // Môi trường toán đứng riêng → $$...$$ (align → aligned cho KaTeX)
        s = s.replace(/\\begin\{(align|equation|gather|eqnarray)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g, function (_, env, sao, nd) {
            return datToan('$$' + (env === 'equation' ? nd : '\\begin{aligned}' + nd + '\\end{aligned}') + '$$');
        });
        s = s.replace(/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?:\\.|[^$\\])+?\$/g, datToan);
        s = s.replace(/\\DFMHINH\{(\d+)\}/g, function (_, k) { return datHtml('<span class="dfm-hinh" data-hinh="' + k + '"></span>'); });

        // Từ đây chỉ còn chữ thường
        s = thoatHtml(s);
        s = s.replace(/\\&amp;/g, function () { return datHtml('&amp;'); });

        // Định dạng chữ (lặp để xử lý lồng nhau)
        let truoc;
        do {
            truoc = s;
            s = s.replace(/\\(?:textcolor|colorbox)\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, '$1')
                .replace(/\\(textbf|textit|emph|underline|uline)\s*\{([^{}]*)\}/g, function (_, l, nd) {
                    return { textbf: '<strong>', textit: '<em>', emph: '<em>', underline: '<u>', uline: '<u>' }[l] + nd +
                        { textbf: '</strong>', textit: '</em>', emph: '</em>', underline: '</u>', uline: '</u>' }[l];
                });
        } while (s !== truoc);

        // Bảng tabular → <table>
        s = s.replace(/\\begin\{tabular\}\s*(?:\{(?:[^{}]|\{[^{}]*\})*\})?([\s\S]*?)\\end\{tabular\}/g, function (_, nd) {
            const hang = nd.split(/\\\\(?:\s*\[[^\]]*\])?/)
                .map(function (h) { return h.replace(/\\(?:hline|toprule|midrule|bottomrule)(?![A-Za-z])|\\cline\{[^}]*\}/g, '').trim(); })
                .filter(Boolean);
            return datHtml('<table class="dfm-bang">' + hang.map(function (h) {
                return '<tr>' + h.split('&amp;').map(function (o) {
                    o = o.replace(/\\multicolumn\{(\d+)\}\{[^}]*\}\{([^{}]*)\}/, '$2');
                    return '<td>' + o.trim() + '</td>';
                }).join('') + '</tr>';
            }).join('') + '</table>');
        });

        // Danh sách
        s = s.replace(/\\begin\{(?:itemize|itemchoice)\}(?:\s*\[[^\]]*\])?/g, '<ul class="dfm-ds">')
            .replace(/\\end\{(?:itemize|itemchoice)\}/g, '</ul>')
            .replace(/\\begin\{enumerate\}(?:\s*\[([^\]]*)\])?/g, function (_, nhan) {
                return '<ol class="dfm-ds-so' + (nhan && /[aA]/.test(nhan) ? ' dfm-ds-chu' : '') + '">';
            })
            .replace(/\\end\{enumerate\}/g, '</ol>')
            .replace(/\\item(?:ch)?(?![A-Za-z])(?:\s*\[[^\]]*\])?/g, '<li>');
        s = s.replace(/\\begin\{center\}/g, '<div class="text-center">').replace(/\\end\{center\}/g, '</div>');
        s = s.replace(/\\(?:begin|end)\{[A-Za-z*]+\}(?:\{[^{}]*\})?/g, '');

        // Ký hiệu, xuống dòng
        s = s.replace(/\\\\(?:\s*\[[^\]]*\])?|\\newline(?![A-Za-z])/g, '<br>')
            .replace(/\\\n/g, '<br>')
            .replace(/\\(?:ldots|dots)(?![A-Za-z])/g, '…')
            .replace(/\\%/g, '%').replace(/\\#/g, '#').replace(/\\_/g, '_').replace(/\\\{/g, '{').replace(/\\\}/g, '}')
            .replace(/---/g, '—').replace(/--/g, '–').replace(/``/g, '“').replace(/''/g, '”').replace(/~/g, '&nbsp;')
            .replace(/\\(?:,|;|quad|qquad|\s)/g, ' ');
        s = s.replace(/\\(?:vspace|hspace|vskip|hskip|setlength|addtolength|label|ref)\*?\s*\{[^{}]*\}/g, '');
        // Lệnh còn lại: \lenh{x} → x, \lenh → bỏ
        do { truoc = s; s = s.replace(/\\[A-Za-z]+\*?\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g, '$1'); } while (s !== truoc);
        s = s.replace(/\\[A-Za-z]+\*?/g, '');

        // Đoạn văn
        s = s.replace(/\n\s*\n+/g, '<br>').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ');
        s = s.replace(/(?:\s*<br>){3,}/g, '<br><br>').replace(/^(?:\s*<br>)+|(?:<br>\s*)+$/g, '').trim();

        // Trả lại phần đã giữ (có thể lồng nhau, vd công thức trong ô bảng)
        while (/\u0000\d+\u0000/.test(s)) s = s.replace(/\u0000(\d+)\u0000/g, function (_, k) { return giu[k]; });
        return s;
    }

    // ---------- Chấm điểm (thang THPT 2025) ----------
    // Phần I: 0,25 điểm/câu. Phần II: mỗi câu tối đa 1 điểm — đúng 1 ý 0,1; 2 ý 0,25; 3 ý 0,5; 4 ý 1.
    // Phần III: 0,5 điểm/câu. Điểm quy về thang 10 theo tỉ lệ (đề đủ 12 + 4 + 6 câu thì đúng bằng thang 10).

    function soChuan(x) {
        if (x === null || x === undefined) return null;
        const t = String(x).replace(/\s+/g, '').replace(',', '.');
        if (!/^-?\d*\.?\d+$/.test(t)) return null;
        return Number(t);
    }
    function tlnDung(traLoi, dapAn) {
        if (!traLoi) return false;
        const a = soChuan(traLoi), b = soChuan(dapAn);
        if (a !== null && b !== null) return Math.abs(a - b) < 1e-9;
        return String(traLoi).trim().toLowerCase() === String(dapAn).trim().toLowerCase();
    }

    // ----- Chia điểm (Admin chỉnh cho từng đề) -----
    // thangDiem = { mc, tf, sa: tổng điểm của mỗi loại câu (chia đều cho các câu cùng loại),
    //               ds: [% điểm khi đúng 1, 2, 3, 4 ý] của câu đúng/sai }
    // Đề chưa chia điểm dùng mặc định THPT 2025: 0,25 / 1 / 0,5 điểm mỗi câu; đúng/sai 10-25-50-100%.
    const DIEM_CAU_THPT = { mc: 0.25, tf: 1, sa: 0.5 };
    const DS_THPT = [10, 25, 50, 100];
    const lamTron = function (x, n) { const k = Math.pow(10, n == null ? 2 : n); return Math.round((x || 0) * k) / k; };
    function chuanThangDiem(td, soCau) {
        td = td || {};
        const tong = {}, moiCau = {};
        ['mc', 'tf', 'sa'].forEach(function (l) {
            const n = soCau[l] || 0;
            const v = Number(td[l]);
            tong[l] = n ? (Number.isFinite(v) && v >= 0 ? v : lamTron(DIEM_CAU_THPT[l] * n, 4)) : 0;
            moiCau[l] = n ? tong[l] / n : 0;
        });
        const ds = Array.isArray(td.ds) && td.ds.length === 4 && td.ds.every(function (x) { return Number.isFinite(Number(x)); })
            ? td.ds.map(Number) : DS_THPT.slice();
        return { tong: tong, moiCau: moiCau, ds: ds, toiDa: lamTron(tong.mc + tong.tf + tong.sa, 4) };
    }
    // Số kiểu Việt Nam: 0,25 ; tối đa n chữ số thập phân
    function dinhDangSo(x, n) { return lamTron(x, n == null ? 2 : n).toString().replace('.', ','); }

    function chamDiem(cauHoi, dapAn, traLoi, thangDiem) {
        traLoi = traLoi || {};
        const td = chuanThangDiem(thangDiem, soCauTheoLoai(cauHoi));
        const kq = { tong: 0, toiDa: td.toiDa, chiTiet: {}, phan: {} };
        ['mc', 'tf', 'sa'].forEach(function (l) { kq.phan[l] = { dung: 0, so: 0, diem: 0, toiDa: td.tong[l] }; });
        cauHoi.forEach(function (q) {
            const da = (dapAn[q.id] || {}).dung;
            const tl = traLoi[q.id];
            const toiDa = td.moiCau[q.loai] || 0;
            let diem = 0, dung = false, soYDung = 0, soY = 0;
            if (q.loai === 'mc') {
                dung = !!tl && tl === da; diem = dung ? toiDa : 0;
            } else if (q.loai === 'tf') {
                soY = (da || []).length;
                soYDung = (da || []).filter(function (v, i) { return Array.isArray(tl) && tl[i] === v; }).length;
                diem = soY === 4 ? (soYDung ? toiDa * td.ds[soYDung - 1] / 100 : 0) : (soY ? toiDa * soYDung / soY : 0);
                dung = soY > 0 && soYDung === soY;
            } else {
                dung = tlnDung(tl, da); diem = dung ? toiDa : 0;
            }
            kq.phan[q.loai].so++;
            kq.phan[q.loai].diem += diem;
            if (dung) kq.phan[q.loai].dung++;
            kq.tong += diem;
            kq.chiTiet[q.id] = { diem: diem, toiDa: toiDa, dung: dung, soYDung: soYDung, soY: soY };
        });
        ['mc', 'tf', 'sa'].forEach(function (l) { kq.phan[l].diem = lamTron(kq.phan[l].diem, 4); });
        kq.tong = lamTron(kq.tong, 2);
        kq.thang10 = kq.toiDa ? lamTron(kq.tong / kq.toiDa * 10, 2) : 0;
        return kq;
    }

    function soCauTheoLoai(cauHoi) {
        const d = { mc: 0, tf: 0, sa: 0 };
        (cauHoi || []).forEach(function (q) { d[q.loai] = (d[q.loai] || 0) + 1; });
        return d;
    }

    // Mức công bố kết quả cho học sinh (Admin đổi được bất kỳ lúc nào):
    // 'an' = chưa công bố, 'diem' = chỉ điểm, 'chi-tiet' = điểm + đúng/sai từng câu (không hiện đáp án),
    // 'day-du' = điểm + đáp án + lời giải.
    // Đề tạo trước khi có tuỳ chọn này dùng cờ cũ hienLoiGiai.
    const CONG_BO = {
        an: { ten: 'Chưa công bố', moTa: 'Học sinh chỉ thấy “đã nộp bài”', icon: 'fa-eye-slash' },
        diem: { ten: 'Chỉ điểm', moTa: 'Học sinh xem được điểm', icon: 'fa-star-half-stroke' },
        'chi-tiet': { ten: 'Đúng/sai từng câu', moTa: 'Học sinh xem điểm và biết câu nào đúng, câu nào sai (chưa hiện đáp án)', icon: 'fa-list-check' },
        'day-du': { ten: 'Điểm + đáp án', moTa: 'Học sinh xem điểm, đáp án và lời giải', icon: 'fa-lightbulb' }
    };
    function congBoCua(de) {
        if (de && CONG_BO[de.congBo]) return de.congBo;
        return de && de.hienLoiGiai ? 'day-du' : 'diem';
    }

    return {
        congBoCua: congBoCua, CONG_BO: CONG_BO,
        chuanThangDiem: chuanThangDiem, dinhDangSo: dinhDangSo, lamTron: lamTron, DIEM_CAU_THPT: DIEM_CAU_THPT, DS_THPT: DS_THPT,
        phanTich: phanTich, texSangHtml: texSangHtml, chamDiem: chamDiem, tlnDung: tlnDung, soChuan: soChuan,
        veToan: veToan, ganHinh: ganHinh, soCauTheoLoai: soCauTheoLoai, MACRO: MACRO,
        TEN_LOAI: { mc: 'Trắc nghiệm', tf: 'Đúng/Sai', sa: 'Trả lời ngắn' },
        PHAN: { mc: 'I', tf: 'II', sa: 'III' }
    };
})();
