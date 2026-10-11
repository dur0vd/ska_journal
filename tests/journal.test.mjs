import test from 'node:test';
import assert from 'node:assert/strict';
import { toPoints, randomCode, normalizeJournal, totalOf, maxTotal, statusOf, renderJournal, LIMITS } from '../assets/journal-core.js';
import { slugFromTitle } from '../assets/journal-admin.js';

test('баллы: запятая, мусор, отрицательные и огромные значения', () => {
  assert.equal(toPoints('12,5'), 12.5);
  assert.equal(toPoints(' 7 '), 7);
  assert.equal(toPoints(''), null);
  assert.equal(toPoints(null), null);
  assert.equal(toPoints('abc'), null);
  assert.equal(toPoints(-3), null);
  assert.equal(toPoints(Infinity), null);
  assert.equal(toPoints(99999), LIMITS.maxPoints);
  // сумма десятичных долей не должна давать хвосты вроде 0.30000000000000004
  assert.equal(totalOf({ scores: { a: 0.1, b: 0.2 } }, [{ id: 'a' }, { id: 'b' }]), 0.3);
});

test('коды: алфавит без похожих знаков и без повторов', () => {
  const taken = new Set();
  for (let i = 0; i < 400; i++) {
    const code = randomCode(taken);
    assert.match(code, /^[A-HJ-NP-Z2-9]{5}$/);
    assert.ok(!taken.has(code));
    taken.add(code);
  }
});

test('нормализация отбрасывает мусор и ограничивает данные', () => {
  const j = normalizeJournal({
    title: '  Группа\u0000  107 ',
    threshold: '55',
    columns: [
      { id: 'c1', title: 'Эссе', group: 'Работы', max: '10' },
      { id: 'c1', title: 'Дубль', max: 5 },
      { id: 'BAD ID', title: 'Плохой' },
      { id: 'c2', title: '', max: -4 }
    ],
    students: [
      { code: 'abcde', scores: { c1: '8,5', c2: 'x', zz: 3 } },
      { code: 'ABCDE', scores: { c1: 1 } },
      { code: '<b>', scores: {} },
      { code: 'ok123', scores: { c1: -5 } },
      null
    ]
  });
  assert.equal(j.title, 'Группа 107');
  assert.equal(j.threshold, 55);
  assert.deepEqual(j.columns.map((c) => c.id), ['c1', 'c2']);
  assert.equal(j.columns[1].title, 'Без названия');
  assert.equal(j.columns[1].max, 0);
  assert.deepEqual(j.students.map((s) => s.code), ['ABCDE', 'OK123']);
  assert.deepEqual(j.students[0].scores, { c1: 8.5 });
  assert.deepEqual(j.students[1].scores, {});
  assert.equal(normalizeJournal(null).title, 'Журнал');
  const many = normalizeJournal({ columns: Array.from({ length: 100 }, (_, i) => ({ id: 'c' + i })), students: Array.from({ length: 1000 }, (_, i) => ({ code: 'A' + String(i).padStart(4, '0') })) });
  assert.equal(many.columns.length, LIMITS.columns);
  assert.equal(many.students.length, LIMITS.students);
});

test('сумма, максимум и зачёт', () => {
  const cols = [{ id: 'c1', max: 10 }, { id: 'c2', max: 5.5 }];
  assert.equal(totalOf({ scores: { c1: 7.25, c2: 3 } }, cols), 10.25);
  assert.equal(totalOf({ scores: { c9: 50 } }, cols), 0);
  assert.equal(maxTotal(cols), 15.5);
  assert.equal(statusOf(55, 55), 'pass');
  assert.equal(statusOf(54.5, 55), 'fail');
  assert.equal(statusOf(0, 0), 'none');
});

test('публичная разметка экранирует названия и не содержит лишнего', () => {
  const html = renderJournal('x"><script>', {
    title: '<img src=x onerror=alert(1)>',
    threshold: 5,
    columns: [{ id: 'c1', title: '<script>alert(1)</script>', group: '"><b>', max: 10 }],
    students: [{ code: 'ZZZZ9', scores: { c1: 6 } }, { code: 'AAAA2', scores: {}, name: 'Иванов', fio: 'Петров' }]
  });
  assert.ok(!/<script/i.test(html));
  assert.ok(!/<img/i.test(html));
  assert.ok(!html.includes('"><b>'));
  assert.ok(!html.includes('Иванов') && !html.includes('Петров'));
  assert.ok(html.indexOf('AAAA2') < html.indexOf('ZZZZ9'), 'строки идут по коду, а не по порядку ввода');
  assert.match(html, /data-code="ZZZZ9" data-total="6"/);
  assert.match(html, /j-status j-pass/);
  assert.match(html, /Для зачёта нужно набрать 5 из 10 баллов/);
});

test('пустой журнал не рисует таблицу', () => {
  const html = renderJournal('empty', { title: 'Пустой', columns: [], students: [] });
  assert.match(html, /Баллы пока не внесены/);
  assert.ok(!html.includes('<table'));
});

test('адрес журнала строится из названия', () => {
  assert.equal(slugFromTitle('ФГУ, группа 107 осень'), 'fgu-gruppa-107-osen');
  assert.equal(slugFromTitle('!!!'), 'zhurnal');
  assert.match(slugFromTitle('А'.repeat(200)), /^[a-z0-9-]{1,40}$/);
});
