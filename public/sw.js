// Service worker: hace la app instalable y evita que la app instalada se quede con una versión vieja.
// La página (index.html) se pide siempre al servidor sin tirar de la caché del navegador; el resto
// (JS, CSS, imágenes) lleva el nombre cambiado en cada versión, así que puede ir de caché sin problema.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).catch(() => fetch(e.request)));
});
