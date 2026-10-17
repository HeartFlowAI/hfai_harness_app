const { randomUUID } = require('node:crypto');

// Simulated manual trading. Kept entirely separate from real balances; paper
// funds are never mixed into the real portfolio. Fee and slippage are explicit
// assumptions, not observed fills.
const STARTING_CASH = 1000;
const FEE_BPS = 100;        // 1.00% assumed platform fee
const SLIPPAGE_BPS = 50;    // 0.50% assumed slippage
const PENDING_KINDS = ['limit', 'stop', 'takeProfit', 'stopLimit', 'trailing'];

function normalizePaper(input) {
  const source = input && typeof input === 'object' ? input : {};
  const initial = Number.isFinite(Number(source.initial)) && Number(source.initial) > 0 ? Number(source.initial) : STARTING_CASH;
  const cash = Number.isFinite(Number(source.cash)) && Number(source.cash) >= 0 ? Number(source.cash) : initial;
  const positions = {};
  if (source.positions && typeof source.positions === 'object') {
    for (const [mint, value] of Object.entries(source.positions)) {
      const amount = Number(value?.amount);
      if (!mint || !Number.isFinite(amount) || amount <= 0) continue;
      positions[mint] = { mint, symbol: typeof value.symbol === 'string' && value.symbol ? value.symbol.slice(0, 24) : `${mint.slice(0, 4)}…${mint.slice(-4)}`, amount, cost: Math.max(0, Number(value.cost) || 0), openedAt: Number(value.openedAt) || 0 };
    }
  }
  const orders = Array.isArray(source.orders)
    ? source.orders.filter(order => order && order.mint && (order.side === 'buy' || order.side === 'sell')).slice(-500).map(order => ({
      id: String(order.id || ''), at: Number(order.at) || 0, mint: String(order.mint), symbol: String(order.symbol || ''),
      side: order.side, amount: Number(order.amount) || 0, priceUsd: Number(order.priceUsd) || 0,
      valueUsd: Number(order.valueUsd) || 0, feeUsd: Number(order.feeUsd) || 0, realizedPnlUsd: Number(order.realizedPnlUsd) || 0
    }))
    : [];
  const pending = Array.isArray(source.pending)
    ? source.pending.filter(order => order && order.mint && PENDING_KINDS.includes(order.kind) && (order.side === 'buy' || order.side === 'sell') && (Number(order.trigger) > 0 || (order.kind === 'trailing' && (Number(order.trailPercent) > 0 || Number(order.trailAmount) > 0)))).slice(0, 50).map(order => ({
      id: String(order.id || ''), createdAt: Number(order.createdAt) || 0, mint: String(order.mint), symbol: String(order.symbol || ''),
      kind: order.kind, side: order.side, trigger: Number(order.trigger), usd: Number(order.usd) || 0,
      amount: Number(order.amount) || 0, percent: Math.min(100, Math.max(1, Number(order.percent) || 100)), lastError: String(order.lastError || ''),
      limitPrice: Number(order.limitPrice) || 0, trailPercent: Math.max(0, Number(order.trailPercent) || 0), trailAmount: Math.max(0, Number(order.trailAmount) || 0),
      extreme: Number(order.extreme) || 0, groupId: typeof order.groupId === 'string' ? order.groupId : '', armed: order.armed === true
    }))
    : [];
  return { initial, cash, positions, orders, pending, paused: source.paused === true };
}
function fillPrice(price, side, slippageBps) {
  const slip = slippageBps / 10000;
  return side === 'buy' ? price * (1 + slip) : price * (1 - slip);
}
function buy(paper, { mint, symbol, usd, price, feeBps = FEE_BPS, slippageBps = SLIPPAGE_BPS, now = Date.now(), id = randomUUID() } = {}) {
  const spend = Number(usd);
  const market = Number(price);
  if (!mint || !(spend > 0)) throw new Error('Enter an amount to spend.');
  if (!(market > 0)) throw new Error('No live price for this token yet. Refresh and try again.');
  const fill = fillPrice(market, 'buy', slippageBps);
  const fee = spend * (feeBps / 10000);
  const total = spend + fee;
  if (total > paper.cash + 1e-9) throw new Error('Not enough paper cash for this order.');
  const amount = spend / fill;
  const existing = paper.positions[mint];
  paper.positions[mint] = existing
    ? { ...existing, amount: existing.amount + amount, cost: existing.cost + total, symbol: symbol || existing.symbol }
    : { mint, symbol: symbol || `${mint.slice(0, 4)}…${mint.slice(-4)}`, amount, cost: total, openedAt: now };
  paper.cash = paper.cash - total;
  paper.orders.push({ id, at: now, mint, symbol: symbol || '', side: 'buy', amount, priceUsd: fill, valueUsd: spend, feeUsd: fee, realizedPnlUsd: 0 });
  if (paper.orders.length > 500) paper.orders.splice(0, paper.orders.length - 500);
  return paper;
}
function sell(paper, { mint, amount, percent, price, feeBps = FEE_BPS, slippageBps = SLIPPAGE_BPS, now = Date.now(), id = randomUUID() } = {}) {
  const position = mint ? paper.positions[mint] : null;
  if (!position) throw new Error('You do not hold that token in the paper account.');
  const market = Number(price);
  if (!(market > 0)) throw new Error('No live price for this token yet. Refresh and try again.');
  let quantity = Number(amount);
  if (!(quantity > 0) && Number(percent) > 0) quantity = position.amount * (Math.min(100, Number(percent)) / 100);
  if (!(quantity > 0)) throw new Error('Enter an amount to sell.');
  quantity = Math.min(quantity, position.amount);
  const fill = fillPrice(market, 'sell', slippageBps);
  const proceeds = quantity * fill;
  const fee = proceeds * (feeBps / 10000);
  const net = proceeds - fee;
  const costRemoved = position.cost * (quantity / position.amount);
  const realized = net - costRemoved;
  position.amount -= quantity;
  position.cost = Math.max(0, position.cost - costRemoved);
  if (position.amount <= 1e-9) delete paper.positions[mint];
  paper.cash = paper.cash + net;
  paper.orders.push({ id, at: now, mint, symbol: position.symbol, side: 'sell', amount: quantity, priceUsd: fill, valueUsd: proceeds, feeUsd: fee, realizedPnlUsd: realized });
  if (paper.orders.length > 500) paper.orders.splice(0, paper.orders.length - 500);
  return paper;
}
function valuation(paper, priceOf = () => 0) {
  const positions = Object.values(paper.positions).map(position => {
    const price = Number(priceOf(position.mint)) || 0;
    const value = position.amount * price;
    const unrealizedPnl = price > 0 ? value - position.cost : 0;
    return { ...position, price, value, avgPrice: position.amount > 0 ? position.cost / position.amount : 0, unrealizedPnl, roe: position.cost > 0 && price > 0 ? (unrealizedPnl / position.cost) * 100 : 0 };
  }).sort((a, b) => b.value - a.value);
  const holdingsValue = positions.reduce((sum, position) => sum + position.value, 0);
  const equity = paper.cash + holdingsValue;
  return {
    cash: paper.cash, initial: paper.initial, holdingsValue, equity,
    totalPnl: equity - paper.initial,
    realizedPnl: paper.orders.reduce((sum, order) => sum + (order.realizedPnlUsd || 0), 0),
    positions, orders: paper.orders.slice(-50).reverse(), pending: paper.pending.slice().sort((a, b) => a.createdAt - b.createdAt), paused: paper.paused === true
  };
}
function resetPaper(paper, cash) {
  const value = Number(cash);
  paper.cash = Number.isFinite(value) && value >= 0 ? value : paper.initial;
  paper.initial = paper.cash;
  paper.positions = {};
  paper.orders = [];
  paper.pending = [];
  return paper;
}
// A condition fires once the market crosses its trigger. Buys fill at the cross
// price; sells take a percent of the position. Orders are checked oldest first,
// so a later order that can no longer be afforded stays pending with a reason.
function shouldTrigger(order, price) {
  if (!(price > 0)) return false;
  switch (order.kind) {
    case 'limit': return order.side === 'buy' ? price <= order.trigger : price >= order.trigger;
    case 'stop': return order.side === 'buy' ? price >= order.trigger : price <= order.trigger;
    case 'takeProfit': return order.side === 'sell' ? price >= order.trigger : price <= order.trigger;
    case 'stopLimit': return order.side === 'buy' ? price >= order.trigger : price <= order.trigger;
    case 'trailing': {
      const peak = order.extreme || price;
      if (order.side === 'sell') { const stop = order.trailPercent > 0 ? peak * (1 - order.trailPercent / 100) : peak - order.trailAmount; return price <= stop; }
      const stop = order.trailPercent > 0 ? peak * (1 + order.trailPercent / 100) : peak + order.trailAmount; return price >= stop;
    }
    default: return false;
  }
}
function addPending(paper, { mint, symbol, kind, side, trigger, usd, amount, percent, limitPrice, trailPercent, trailAmount, groupId, now = Date.now(), id = randomUUID() } = {}) {
  if (!mint) throw new Error('Choose a token.');
  const orderKind = PENDING_KINDS.includes(kind) ? kind : 'limit';
  const orderSide = side === 'sell' ? 'sell' : 'buy';
  const price = Number(trigger);
  const limit = Number(limitPrice) || 0;
  const trailPct = Math.max(0, Number(trailPercent) || 0);
  const trailAbs = Math.max(0, Number(trailAmount) || 0);
  if (orderKind === 'trailing') { if (!(trailPct > 0) && !(trailAbs > 0)) throw new Error('Set a trail percentage or amount.'); }
  else if (!(price > 0)) throw new Error('Enter a trigger price.');
  if (orderKind === 'stopLimit' && !(limit > 0)) throw new Error('Enter a limit price for the stop-limit order.');
  const order = { id, createdAt: now, mint, symbol: symbol || '', kind: orderKind, side: orderSide, trigger: Number.isFinite(price) ? price : 0, usd: 0, amount: 0, percent: 100, lastError: '', limitPrice: limit, trailPercent: trailPct, trailAmount: trailAbs, extreme: 0, groupId: typeof groupId === 'string' ? groupId : '', armed: false };
  if (orderSide === 'buy') {
    const spend = Number(usd);
    if (!(spend > 0)) throw new Error('Enter a USD amount for the buy order.');
    order.usd = spend;
  } else {
    order.percent = Math.min(100, Math.max(1, Number(percent) || 100));
  }
  paper.pending.push(order);
  if (paper.pending.length > 50) paper.pending.splice(0, paper.pending.length - 50);
  return order;
}
// One-cancels-other bracket: a take-profit and a stop-loss on the same position.
// When either fills, the other is cancelled automatically.
function addOco(paper, { mint, symbol, percent = 100, takeProfit, stopLoss, now = Date.now() } = {}) {
  if (!mint) throw new Error('Choose a token.');
  const tp = Number(takeProfit), sl = Number(stopLoss);
  if (!(tp > 0) || !(sl > 0)) throw new Error('Set both a take-profit and a stop-loss price.');
  const groupId = randomUUID();
  const pct = Math.min(100, Math.max(1, Number(percent) || 100));
  addPending(paper, { mint, symbol, side: 'sell', kind: 'takeProfit', trigger: tp, percent: pct, groupId, now });
  addPending(paper, { mint, symbol, side: 'sell', kind: 'stop', trigger: sl, percent: pct, groupId, now });
  return groupId;
}
function cancelPending(paper, id) {
  const before = paper.pending.length;
  paper.pending = paper.pending.filter(order => order.id !== id);
  if (paper.pending.length === before) throw new Error('That pending order no longer exists.');
  return paper;
}
function clearPending(paper) { const count = paper.pending.length; paper.pending = []; return count; }
function evaluatePending(paper, priceOf = () => 0, now = Date.now()) {
  if (paper.paused) return [];
  const executed = [];
  const queue = [...paper.pending].sort((a, b) => a.createdAt - b.createdAt);
  for (const order of queue) {
    if (!paper.pending.some(item => item.id === order.id)) continue;
    const price = Number(priceOf(order.mint)) || 0;
    if (order.kind === 'trailing' && price > 0) order.extreme = order.side === 'sell' ? Math.max(order.extreme || 0, price) : (order.extreme ? Math.min(order.extreme, price) : price);
    if (!shouldTrigger(order, price)) continue;
    // A stop-limit arms into a plain limit order at its limit price instead of filling.
    if (order.kind === 'stopLimit') { order.kind = 'limit'; order.trigger = order.limitPrice || order.trigger; order.armed = true; continue; }
    try {
      if (order.side === 'buy') buy(paper, { mint: order.mint, symbol: order.symbol, usd: order.usd, price, now, id: randomUUID() });
      else sell(paper, { mint: order.mint, symbol: order.symbol, percent: order.percent, price, now, id: randomUUID() });
      paper.pending = paper.pending.filter(item => item.id !== order.id);
      if (order.groupId) paper.pending = paper.pending.filter(item => item.groupId !== order.groupId);
      const filled = paper.orders[paper.orders.length - 1];
      if (filled) { filled.triggeredBy = order.id; if (order.groupId) filled.ocoGroup = order.groupId; }
      executed.push(order);
    } catch (error) {
      order.lastError = error.message;
    }
  }
  return executed;
}
module.exports = { STARTING_CASH, FEE_BPS, SLIPPAGE_BPS, PENDING_KINDS, normalizePaper, fillPrice, buy, sell, valuation, resetPaper, shouldTrigger, addPending, addOco, cancelPending, clearPending, evaluatePending };
