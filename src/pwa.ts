export function registerOfflineApp() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const workerUrl = `${import.meta.env.BASE_URL}sw.js`;
    void navigator.serviceWorker.register(workerUrl, { scope: import.meta.env.BASE_URL })
      .then(registration => registration.update())
      .catch(error => console.warn('Offline mode is unavailable:', error));
  });
}
