// Service worker mínimo: hace la app instalable. Todo va a la red (el juego necesita conexión).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
