// Поиск своей строки в журнале по личному коду. Без скрипта таблица остаётся видимой.
(function () {
  'use strict';

  function fmt(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

  Array.prototype.forEach.call(document.querySelectorAll('.journal'), function (section) {
    var input = section.querySelector('.j-code');
    var result = section.querySelector('.j-result');
    var form = section.querySelector('.j-find');
    if (!input || !result) return;

    var threshold = Number(section.dataset.threshold) || 0;
    var max = Number(section.dataset.max) || 0;
    var rows = {};
    Array.prototype.forEach.call(section.querySelectorAll('tbody tr'), function (tr) { rows[tr.dataset.code] = tr; });
    var marked = null;

    form.addEventListener('submit', function (e) { e.preventDefault(); });

    function clear() {
      if (marked) { marked.classList.remove('mine'); marked = null; }
      result.hidden = true;
      result.textContent = '';
    }

    input.addEventListener('input', function () {
      var code = input.value.replace(/\s+/g, '').toUpperCase();
      clear();
      if (!code) return;
      var row = rows[code];
      result.hidden = false;
      if (!row) {
        if (code.length >= 5) result.textContent = 'Такого кода в этом журнале нет. Проверьте, что вводите код целиком.';
        else result.hidden = true;
        return;
      }
      marked = row;
      row.classList.add('mine');
      var total = Number(row.dataset.total) || 0;
      var text = 'Набрано ' + fmt(total) + (max ? ' из ' + fmt(max) : '') + ' баллов.';
      if (threshold > 0) {
        text += total >= threshold
          ? ' Зачёт набран.'
          : ' До зачёта не хватает ' + fmt(threshold - total) + '.';
      }
      result.textContent = text;
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  });
})();
