// Подключается в <head>: включает оформление «Москва» до первой отрисовки страницы.
// Содержимое прячется на время подлёта камеры, но не дольше 4 секунд, даже если скрипт не загрузился.
(function () {
  var root = document.documentElement;
  root.classList.add('scene-on');
  // День или ночь, выбранные кнопкой в шапке; без выбора — как в системе.
  try { var t = localStorage.getItem('ska-theme'); if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t); } catch (e) {}
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('scene-intro');
  setTimeout(function () { root.classList.remove('scene-intro'); }, 4000);
})();
