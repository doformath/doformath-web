// Service Worker của DoforMath
// - Trang HTML: ưu tiên mạng (luôn lấy bản mới nhất), mất mạng thì dùng bản đã lưu hoặc trang offline.
// - Ảnh, SVG, CSS/JS, font, thư viện CDN: dùng bản đã lưu ngay rồi cập nhật ngầm (stale-while-revalidate).
// - Firebase (đăng nhập, Firestore), YouTube, Cloudinary... không bị can thiệp.
// Khi đổi danh sách PRECACHE hoặc logic trong file này, tăng VERSION để xoá cache cũ.

const VERSION = 'v15';
const PAGE_CACHE = `doformath-pages-${VERSION}`;
const ASSET_CACHE = `doformath-assets-${VERSION}`;
const OFFLINE_URL = 'offline.html';

const PRECACHE = [
  './',
  'index.html',
  OFFLINE_URL,
  'manifest.webmanifest',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-192.png',
  'assets/icons/logo-tron-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
];

// Thư viện ngoài được phép lưu cache (đều là file tĩnh có phiên bản cố định)
const CDN_RULES = [
  (u) => u.hostname === 'cdn.jsdelivr.net',
  (u) => u.hostname === 'cdnjs.cloudflare.com',
  (u) => u.hostname === 'fonts.googleapis.com',
  (u) => u.hostname === 'fonts.gstatic.com',
  (u) => u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/'),
];

// Số giây chờ mạng cho trang HTML trước khi trả bản đã lưu (mạng chậm)
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [PAGE_CACHE, ASSET_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('doformath-') && !keep.includes(k)).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    if (sameOrigin) event.respondWith(handlePage(event));
    return;
  }

  if (sameOrigin) {
    // PDF thường nặng, để trình duyệt tải trực tiếp
    if (url.pathname.endsWith('.pdf')) return;
    event.respondWith(staleWhileRevalidate(event, ASSET_CACHE));
    return;
  }

  if (CDN_RULES.some((rule) => rule(url))) {
    event.respondWith(staleWhileRevalidate(event, ASSET_CACHE));
  }
});

async function handlePage(event) {
  const { request } = event;
  const cache = await caches.open(PAGE_CACHE);

  const network = (async () => {
    const preloaded = await event.preloadResponse;
    const response = preloaded || await fetch(request);
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  })();
  event.waitUntil(network.catch(() => {}));

  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    // Mạng chậm: có bản đã lưu thì trả luôn, bản mới vẫn được cập nhật ngầm
    const cached = await cache.match(request);
    return cached || await network;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || await cache.match(OFFLINE_URL) || Response.error();
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request).then((response) => {
    // response.type === 'opaque' là file CDN tải không kèm CORS (vd: Tailwind), vẫn dùng được
    if (response.ok || response.type === 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  });

  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}
