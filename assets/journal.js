import { formatPoints, grade, normalizeCode, rowsHtml } from './journal-core.js';

(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var api = $('jr-table').dataset.api;
  var tbody = document.querySelector('#jr-table tbody');
  var KEY = 'ska_journal_me';
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (!api) return;

  function render(view, mine) {
    tbody.innerHTML = rowsHtml(view);
    var select = $('jr-id');
    if (select) {
      var value = select.value;
      select.length = 1;
      view.participants.forEach(function (p) { select.add(new Option(p.name, p.id)); });
      select.value = value || (saved && saved.id) || '';
    }
    if (mine) {
      var row = tbody.querySelector('tr[data-id="' + CSS.escape(mine) + '"]');
      if (row) row.classList.add('mine');
    }
  }

  // Страница собрана с данными на момент публикации. Подтягиваем свежие.
  fetch(api, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (view) { if (view && view.participants) render(view, $('jr-id') && $('jr-id').value); })
    .catch(function () {});

  var form = $('jr-form');
  if (!form) return;

  function status(kind, text) {
    var s = $('jr-status');
    s.className = 'jr-status ' + kind;
    s.textContent = text;
    s.hidden = false;
  }

  if (saved && saved.id) {
    $('jr-id').value = saved.id;
    $('jr-code').value = saved.code || '';
    $('jr-remember').checked = true;
    $('jr-points').focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = $('jr-id').value, code = normalizeCode($('jr-code').value), points = $('jr-points').value;
    if (code.length !== 10) { status('err', 'В коде 10 букв и цифр, например ABCDE-FGHJK.'); return; }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    status('busy', 'Сохраняю…');
    fetch(api, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, code: code, points: points }) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw new Error(data.error || 'Не удалось сохранить (' + r.status + ').');
          return data;
        });
      })
      .then(function (data) {
        // Запоминаем только подошедший код.
        saved = $('jr-remember').checked ? { id: id, code: code } : null;
        try {
          if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
          else localStorage.removeItem(KEY);
        } catch (err) {}
        render(data, id);
        var g = grade(data.total);
        status('ok', 'Добавлено. Ваша сумма: ' + formatPoints(data.total) + (g.mark > 2 ? ' — оценка ' + g.mark + '.' : ' — пока незачёт.'));
        $('jr-points').value = '';
        $('jr-points').focus();
      })
      .catch(function (err) {
        status('err', err.message === 'Failed to fetch' ? 'Нет связи с сервером журнала. Попробуйте позже.' : err.message);
      })
      .then(function () { btn.disabled = false; });
  });
})();
