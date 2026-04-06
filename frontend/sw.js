const CACHE = "saju-mbti-v1";
const ASSETS = ["/", "/index.html", "/app.js", "/firebase-config.js"];

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  // 테스트 단계에서는 모든 요청을 네트워크 우선으로 처리
  return;
});
