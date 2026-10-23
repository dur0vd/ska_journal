import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_POINTS, addEntries, checkCode, generateCode, grade, hashCode, normalizeCode, parsePoints, publicView, rowsHtml } from '../assets/journal-core.js';
import { handleJournal } from '../tools/journal-api.mjs';

test('Grades follow the 138-point scale', () => {
  assert.equal(MAX_POINTS, 138);
  assert.equal(grade(138).mark, 5); assert.equal(grade(90).mark, 5);
  assert.equal(grade(89.99).mark, 4); assert.equal(grade(75).mark, 4);
  assert.equal(grade(74.5).mark, 3); assert.equal(grade(50).mark, 3);
  assert.equal(grade(49.99), null); assert.equal(grade(0), null);
});

test('Points can be entered one by one or several at once', () => {
  assert.deepEqual(parsePoints('5'), [5]);
  assert.deepEqual(parsePoints(' 5 3 2 '), [5, 3, 2]);
  assert.deepEqual(parsePoints('5+3; 2,5 - 1'), [5, 3, 2.5, -1]);
  for (const bad of ['', 'abc', '0', '139', '1e3', '5,123', '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21']) assert.throws(() => parsePoints(bad), bad);
});

test('Sum cannot exceed the maximum and participants cannot take points away', () => {
  const p = { name: 'Иванов', entries: [] };
  assert.equal(addEntries(p, [100, 30], 'self'), 130);
  assert.throws(() => addEntries(p, [9], 'self'), /максимум/);
  assert.throws(() => addEntries(p, [-5], 'self'), /преподаватель/);
  assert.equal(addEntries(p, [-30], 'admin'), 100);
  assert.throws(() => addEntries(p, [-101], 'admin'), /меньше нуля/);
  assert.equal(p.entries.length, 3);
  assert.deepEqual(p.entries.map((e) => e.by), ['self', 'self', 'admin']);
});

test('Codes are checked by hash and tolerate typing variations', async () => {
  const code = generateCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  const stored = await hashCode(code);
  assert.ok(!JSON.stringify(stored).includes(code.replace('-', '')));
  assert.ok(await checkCode(code.toLowerCase().replace('-', ' '), stored));
  assert.equal(normalizeCode('аве-кмн'), 'ABEKMH');
  assert.equal(await checkCode(generateCode(), stored), false);
  assert.equal(await checkCode('', stored), false);
});

test('Public table hides codes and history and escapes names', () => {
  const view = publicView({ participants: [
    { id: 'p2', name: 'Яковлев', code: { salt: 's', hash: 'h' }, entries: [{ points: 95 }] },
    { id: 'p1', name: '<b>Алексеев</b>', code: { salt: 's', hash: 'h' }, entries: [{ points: 60 }, { points: 2.5 }] },
  ] });
  assert.deepEqual(view, { participants: [{ id: 'p1', name: '<b>Алексеев</b>', total: 62.5 }, { id: 'p2', name: 'Яковлев', total: 95 }] });
  const html = rowsHtml(view);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /class="g3"[\s\S]*62,5[\s\S]*class="g5"/);
});

function memoryStore(data) {
  let version = 0;
  return {
    data,
    conflicts: 0,
    read() { return { data: structuredClone(this.data), version }; },
    write(next, v) {
      if (this.conflicts > 0) { this.conflicts--; version++; throw Object.assign(new Error('conflict'), { conflict: true }); }
      if (v !== version) throw Object.assign(new Error('conflict'), { conflict: true });
      this.data = next; version++;
    },
  };
}
const post = (body, origin = 'https://site.example') => new Request('https://api.example/journal', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
});

test('A participant adds points to themselves only with their code', async () => {
  const code = generateCode();
  const store = memoryStore({ participants: [
    { id: 'p1', name: 'Иванов', code: await hashCode(code), entries: [] },
    { id: 'p2', name: 'Петров', code: await hashCode(generateCode()), entries: [] },
  ] });
  const opts = { store, origins: ['https://site.example'] };

  store.conflicts = 1; // одновременная запись другого участника
  let r = await handleJournal(post({ id: 'p1', code, points: '5 3' }), opts);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://site.example');
  const body = await r.json();
  assert.equal(body.total, 8);
  assert.ok(!JSON.stringify(body).includes('hash'));
  assert.equal(store.data.participants[0].entries.length, 2);

  r = await handleJournal(post({ id: 'p2', code, points: '5' }), opts);
  assert.equal(r.status, 403, 'чужой код не подходит');
  r = await handleJournal(post({ id: 'nobody', code, points: '5' }), opts);
  assert.equal(r.status, 403);
  r = await handleJournal(post({ id: 'p1', code, points: '-5' }), opts);
  assert.equal(r.status, 400);
  r = await handleJournal(post({ id: 'p1', code, points: '131' }), opts);
  assert.equal(r.status, 400);
  r = await handleJournal(post({ id: 'p1', code, points: '5' }, 'https://evil.example'), opts);
  assert.equal(r.status, 403, 'запрос с чужого сайта');
  assert.equal(store.data.participants[0].entries.length, 2);

  r = await handleJournal(new Request('https://api.example/journal'), opts);
  assert.deepEqual(await r.json(), { participants: [{ id: 'p1', name: 'Иванов', total: 8 }, { id: 'p2', name: 'Петров', total: 0 }] });
});
