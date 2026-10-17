const { test } = require('node:test'), assert = require('node:assert/strict');
const { createDesk, walletFixture } = require('./helpers/desk');

test('the desk mounts and the Trade section renders without [object ...] placeholders', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  assert.ok(desk.document.getElementById('trading-workspace'), 'desk mounted');
  desk.tab('trade').click();
  await desk.flush();
  const content = desk.document.getElementById('ws-content');
  assert.ok(content.querySelector('.ws-trade'), 'trade grid renders');
  assert.ok(content.querySelector('.ws-charttype'), 'line/candles control renders');
  assert.ok(!/\[object /.test(content.textContent), 'no [object ...] placeholder text');
});

test('canvas starter tiles create a view without rendering a non-snapshot', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('canvas').click();
  await desk.flush();
  const tile = [...desk.document.querySelectorAll('.ws-starter')].find(node => node.textContent.includes('Price chart'));
  assert.ok(tile, 'price chart starter tile present');
  const before = desk.renderCalls.length;
  tile.click();
  await desk.flush();
  assert.ok((desk.calls.walletViewShow || 0) >= 1, 'walletViewShow was called');
  assert.equal(desk.renderCalls.length, before, 'window.render is not called for a { view } result');
  assert.ok(!desk.toasts.some(message => /Cannot read properties|undefined/.test(message)), 'no bogus error toast');
});

test('holders render for a token that has holder accounts', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('trade').click();
  await desk.flush(12);
  const holders = desk.document.querySelector('#ws-content .ws-holders');
  assert.ok(holders, 'holders body rendered');
  assert.match(holders.textContent, /38\.3%|Top 10|Holders/i, 'holder stats rendered');
  assert.ok(!/\[object /.test(holders.textContent), 'holder rows do not stringify nodes');
});

test('sub-cent token prices are formatted, not rounded to $0', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('portfolio').click();
  await desk.flush();
  const rows = [...desk.document.querySelectorAll('#ws-content .ws-market-table tbody tr')];
  const bonk = rows.find(row => row.textContent.includes('BONK'));
  assert.ok(bonk, 'BONK market row present');
  assert.match(bonk.textContent, /\$0\.000003/, 'micro price uses significant digits');
});
