const { test } = require('node:test'), assert = require('node:assert/strict');
const { normalizePaper, buy, sell, valuation, resetPaper, fillPrice, STARTING_CASH, shouldTrigger, addPending, addOco, cancelPending, evaluatePending } = require('../src/wallet/paper');
const { normalizeConfig } = require('../src/wallet/index');
const { executeTool } = require('../src/tools');

test('paper account starts empty with the default simulated cash', () => {
  const paper = normalizePaper({});
  assert.equal(paper.cash, STARTING_CASH);
  assert.deepEqual(paper.positions, {});
  assert.deepEqual(paper.orders, []);
  assert.equal(normalizeConfig({}).paper.cash, STARTING_CASH);
});

test('a paper buy spends cash including fee and records the position', () => {
  const paper = normalizePaper({ cash: 1000 });
  buy(paper, { mint: 'MintA', symbol: 'AAA', usd: 100, price: 2, now: 1, id: 'b1' });
  assert.ok(Math.abs(paper.cash - (1000 - 101)) < 1e-9);
  const position = paper.positions.MintA;
  assert.ok(Math.abs(position.amount - 100 / fillPrice(2, 'buy', 50)) < 1e-9);
  assert.ok(Math.abs(position.cost - 101) < 1e-9);
  assert.equal(paper.orders.at(-1).side, 'buy');
  assert.equal(paper.orders.at(-1).id, 'b1');
});

test('a paper sell realizes profit and clears the position', () => {
  const paper = normalizePaper({ cash: 1000 });
  buy(paper, { mint: 'MintA', usd: 100, price: 2, now: 1, id: 'b1' });
  const held = paper.positions.MintA.amount;
  sell(paper, { mint: 'MintA', percent: 100, price: 3, now: 2, id: 's1' });
  const order = paper.orders.at(-1);
  assert.equal(order.side, 'sell');
  assert.ok(Math.abs(order.amount - held) < 1e-9);
  const proceeds = held * fillPrice(3, 'sell', 50);
  const net = proceeds * 0.99;
  assert.ok(Math.abs(paper.cash - (899 + net)) < 1e-9);
  assert.ok(Math.abs(order.realizedPnlUsd - (net - 101)) < 1e-9);
  assert.equal(paper.positions.MintA, undefined);
});

test('paper orders reject overspend without a price', () => {
  assert.throws(() => buy(normalizePaper({ cash: 100 }), { mint: 'MintA', usd: 1000, price: 1 }), /Not enough paper cash/);
  assert.throws(() => buy(normalizePaper({}), { mint: 'MintA', usd: 10, price: 0 }), /No live price/);
  assert.throws(() => sell(normalizePaper({}), { mint: 'MintA', price: 1 }), /do not hold/);
});

test('paper valuation marks positions to market and stays separate from real totals', () => {
  const paper = normalizePaper({ cash: 1000 });
  buy(paper, { mint: 'MintA', usd: 100, price: 2, now: 1 });
  const view = valuation(paper, mint => (mint === 'MintA' ? 4 : 0));
  assert.ok(view.holdingsValue > 0);
  assert.ok(Math.abs(view.equity - (paper.cash + view.holdingsValue)) < 1e-9);
  assert.ok(Math.abs(view.positions[0].unrealizedPnl - (view.holdingsValue - view.positions[0].cost)) < 1e-9);
  assert.ok(view.totalPnl > 0);
});

test('resetting the paper account clears orders and resets cash', () => {
  const paper = normalizePaper({ cash: 1000 });
  buy(paper, { mint: 'MintA', usd: 100, price: 2 });
  resetPaper(paper, 500);
  assert.equal(paper.cash, 500);
  assert.equal(paper.initial, 500);
  assert.deepEqual(paper.positions, {});
  assert.deepEqual(paper.orders, []);
});

test('paper tools validate input and route to the context', async () => {
  const signal = () => new AbortController().signal;
  assert.deepEqual(await executeTool('paper_buy', { mint: 'MintA', usd: '50' }, { signal: signal(), paperBuy: async (mint, usd) => ({ mint, usd }) }), { mint: 'MintA', usd: '50' });
  assert.deepEqual(await executeTool('paper_sell', { mint: 'MintA', percent: '100' }, { signal: signal(), paperSell: async (mint, amount, percent) => ({ mint, percent }) }), { mint: 'MintA', percent: '100' });
  await assert.rejects(executeTool('paper_buy', { mint: 'MintA' }, { signal: signal() }), /Missing string argument/);
});

test('conditional orders cross in the right direction', () => {
  assert.equal(shouldTrigger({ kind: 'limit', side: 'buy', trigger: 2 }, 1.9), true);
  assert.equal(shouldTrigger({ kind: 'limit', side: 'buy', trigger: 2 }, 2.1), false);
  assert.equal(shouldTrigger({ kind: 'limit', side: 'sell', trigger: 3 }, 3.1), true);
  assert.equal(shouldTrigger({ kind: 'stop', side: 'sell', trigger: 2 }, 1.9), true);
  assert.equal(shouldTrigger({ kind: 'takeProfit', side: 'sell', trigger: 4 }, 4.1), true);
  assert.equal(shouldTrigger({ kind: 'stop', side: 'sell', trigger: 2 }, 2.5), false);
  assert.equal(shouldTrigger({ kind: 'limit', side: 'buy', trigger: 2 }, 0), false);
});

test('a limit buy fills when the price crosses and records the trigger', () => {
  const paper = normalizePaper({ cash: 1000 });
  const order = addPending(paper, { mint: 'MintA', symbol: 'AAA', kind: 'limit', side: 'buy', trigger: 2, usd: 100, now: 5 });
  assert.equal(paper.pending.length, 1);
  const executed = evaluatePending(paper, () => 1.5);
  assert.equal(executed.length, 1);
  assert.equal(paper.pending.length, 0);
  assert.equal(paper.positions.MintA.amount > 0, true);
  assert.equal(paper.orders.at(-1).triggeredBy, order.id);
});

test('a stop-loss sells the position when the price crosses down', () => {
  const paper = normalizePaper({ cash: 1000 });
  buy(paper, { mint: 'MintA', usd: 200, price: 2 });
  addPending(paper, { mint: 'MintA', kind: 'stop', side: 'sell', trigger: 1.5, percent: 100, now: 2 });
  const executed = evaluatePending(paper, () => 1.2);
  assert.equal(executed.length, 1);
  assert.equal(paper.positions.MintA, undefined);
});

test('paused conditions do not fire until resumed', () => {
  const paper = normalizePaper({ cash: 1000, paused: true });
  addPending(paper, { mint: 'MintA', kind: 'limit', side: 'buy', trigger: 2, usd: 50 });
  assert.equal(evaluatePending(paper, () => 1).length, 0);
  assert.equal(paper.pending.length, 1);
  paper.paused = false;
  assert.equal(evaluatePending(paper, () => 1).length, 1);
});

test('the first crossing order wins and an unaffordable one stays pending with a reason', () => {
  const paper = normalizePaper({ cash: 100 });
  addPending(paper, { mint: 'MintA', kind: 'limit', side: 'buy', trigger: 2, usd: 60, now: 1 });
  addPending(paper, { mint: 'MintB', kind: 'limit', side: 'buy', trigger: 2, usd: 60, now: 2 });
  const executed = evaluatePending(paper, () => 1);
  assert.equal(executed.length, 1);
  assert.equal(paper.pending.length, 1);
  assert.match(paper.pending[0].lastError, /Not enough paper cash/);
});

test('pending conditions survive normalize and can be cancelled', () => {
  const paper = normalizePaper({});
  addPending(paper, { mint: 'MintA', kind: 'takeProfit', side: 'sell', trigger: 3, percent: 50 });
  const restored = normalizePaper(paper);
  assert.equal(restored.pending.length, 1);
  assert.equal(restored.pending[0].kind, 'takeProfit');
  cancelPending(restored, restored.pending[0].id);
  assert.equal(restored.pending.length, 0);
});

test('order types cross in the right direction (stop buy, stop-limit, trailing)', () => {
  assert.equal(shouldTrigger({ kind: 'stop', side: 'buy', trigger: 2 }, 2.1), true);
  assert.equal(shouldTrigger({ kind: 'stopLimit', side: 'sell', trigger: 2 }, 1.9), true);
  assert.equal(shouldTrigger({ kind: 'trailing', side: 'sell', trailPercent: 10, extreme: 2 }, 1.7), true);
  assert.equal(shouldTrigger({ kind: 'trailing', side: 'sell', trailPercent: 10, extreme: 2 }, 1.9), false);
  assert.equal(shouldTrigger({ kind: 'trailing', side: 'buy', trailPercent: 10, extreme: 2 }, 2.3), true);
});

test('a stop-limit arms into a limit order at its limit price', () => {
  const paper = normalizePaper({ cash: 1000 });
  addPending(paper, { mint: 'MintA', symbol: 'AAA', kind: 'stopLimit', side: 'buy', trigger: 2, limitPrice: 2.05, usd: 100, now: 1 });
  // price reaches the stop -> arms, does not fill yet
  assert.equal(evaluatePending(paper, () => 2.1).length, 0);
  assert.equal(paper.pending[0].kind, 'limit');
  assert.equal(paper.pending[0].trigger, 2.05);
  // price now at the limit -> fills
  assert.equal(evaluatePending(paper, () => 2.0).length, 1);
  assert.equal(paper.positions.MintA.amount > 0, true);
});

test('a trailing stop follows the peak and fires on the drop', () => {
  const paper = normalizePaper({ cash: 1000 });
  buy(paper, { mint: 'MintA', usd: 200, price: 2 });
  addPending(paper, { mint: 'MintA', kind: 'trailing', side: 'sell', trailPercent: 10, percent: 100, now: 1 });
  assert.equal(evaluatePending(paper, () => 2.5).length, 0); // peak 2.5, stop 2.25
  assert.equal(evaluatePending(paper, () => 2.4).length, 0);
  assert.equal(evaluatePending(paper, () => 2.2).length, 1); // below 2.25
  assert.equal(paper.positions.MintA, undefined);
});

test('an OCO bracket cancels its sibling when one side fills', () => {
  const paper = normalizePaper({ cash: 1000 });
  buy(paper, { mint: 'MintA', usd: 200, price: 2 });
  addOco(paper, { mint: 'MintA', symbol: 'AAA', percent: 100, takeProfit: 3, stopLoss: 1.5, now: 1 });
  assert.equal(paper.pending.length, 2);
  const executed = evaluatePending(paper, () => 3.1); // take-profit hits
  assert.equal(executed.length, 1);
  assert.equal(paper.pending.length, 0, 'the stop-loss sibling was cancelled');
  assert.equal(paper.positions.MintA, undefined);
});

test('valuation exposes average price and ROE', () => {
  const paper = normalizePaper({ cash: 1000 });
  buy(paper, { mint: 'MintA', usd: 100, price: 2, now: 1 });
  const view = valuation(paper, () => 4);
  const pos = view.positions[0];
  assert.ok(pos.avgPrice > 0);
  assert.ok(pos.roe > 0);
  assert.ok(Math.abs(pos.roe - ((pos.value - pos.cost) / pos.cost) * 100) < 1e-9);
});
