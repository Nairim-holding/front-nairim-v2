// Remove only caches previously created by next-pwa for dynamic responses.
// These may contain authenticated HTML, API data or signed media URLs.
const privateRuntimeCaches = new Set([
  'start-url', 'next-data', 'static-data-assets', 'apis', 'others', 'cross-origin',
  'static-image-assets', 'next-image', 'static-audio-assets', 'static-video-assets',
]);

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => privateRuntimeCaches.has(name)).map((name) => caches.delete(name)),
    )),
  );
});
