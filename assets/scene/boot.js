// Подключается в <head>: включает оформление «Москва» до первой отрисовки страницы.
// Содержимое прячется на время подлёта камеры, но не дольше 4 секунд, даже если скрипт не загрузился.
(function () {
  var root = document.documentElement;
  root.classList.add('scene-on');
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('scene-intro');
  setTimeout(function () { root.classList.remove('scene-intro'); }, 4000);
})();
