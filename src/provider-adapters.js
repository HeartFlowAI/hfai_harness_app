const { randomUUID } = require('node:crypto');
const { localUrl } = require('./provider-settings');
const endpoints = { openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com/v1', openrouter: 'https://openrouter.ai/api/v1' };
async function http(url, { key = '', body, signal, fetcher = fetch, label = 'Provider', headers = {} } = {}) {
  const response = await fetcher(url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(120000)]), redirect: 'error' });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw Error([401,403].includes(response.status) ? `${label} rejected the connection. Check your API key in Settings.` : `${label} ${response.status}: ${key ? detail.split(key).join('[redacted]') : detail}`);
  }
  return response;
}
async function events(response, callback) {
  const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '', lines = [];
  const line = value => {
    if (value === '') { if (lines.length) { callback(lines.join('\n')); lines = []; } }
    else if (value.startsWith('data:')) lines.push(value.slice(5).trimStart());
  };
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      pending += decoder.decode(value, { stream: true });
      const parts = pending.split('\n'); pending = parts.pop();
      for (const part of parts) line(part.replace(/\r$/, ''));
    }
    pending += decoder.decode(); if (pending) line(pending.replace(/\r$/, '')); line('');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
// Stable IDs also let conversations continue after switching providers.
function normalized(messages) {
  let pending = []; const result = [];
  const interrupted = () => {
    for (const call of pending) result.push({role:'tool',tool_name:call.function.name,tool_call_id:call.id,content:'This tool call was interrupted before its result was recorded. No success is confirmed. Observe current state before retrying any action.'});
    pending = [];
  };
  messages.forEach((message, index) => {
    const m = { ...message };
    if (m.role !== 'tool') interrupted();
    if (m.role === 'assistant') {
      pending = (m.tool_calls || []).map((call, n) => ({ ...call, id: call.id || `aurora_${index}_${n}`, function: { ...call.function, arguments: typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments || {} } }));
      m.tool_calls = pending;
    }
    if (m.role === 'tool') {
      const match = pending.find(call => call.id === m.tool_call_id) || pending.find(call => call.function.name === m.tool_name) || pending[0];
      // A damaged legacy/orphan record has no corresponding callable request.
      if (!match) return;
      m.tool_call_id = match.id;
      pending = pending.filter(call => call !== match);
    }
    result.push(m);
  });
  interrupted(); return result;
}
function ollamaMessages(messages) {
  return normalized(messages).map(m => ({ role: m.role, content: m.content || '', ...(m.thinking && m._provider !== 'openrouter' ? { thinking: m.thinking } : {}), ...(m.tool_calls?.length ? { tool_calls: m.tool_calls.map(call => ({ function: call.function })) } : {}), ...(m.tool_name ? { tool_name: m.tool_name } : {}) }));
}
function routerMessages(messages, model) {
  return normalized(messages).map(m => ({ role: m.role, content: m.content || '', ...(m.tool_calls?.length ? { tool_calls: m.tool_calls.map(call => ({ id: call.id, type: 'function', function: { name: call.function.name, arguments: JSON.stringify(call.function.arguments) } })) } : {}), ...(m.role === 'tool' ? { tool_call_id: m.tool_call_id } : {}), ...(m._provider === 'openrouter' && (!model || m._model === model) && m.reasoning_details ? { reasoning_details: m.reasoning_details } : {}) }));
}
function openaiInput(messages, model) {
  const input = [];
  for (const m of normalized(messages)) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') input.push({ type: 'function_call_output', call_id: m.tool_call_id, output: m.content || '' });
    else if (m.role === 'assistant' && m._provider === 'openai' && (!model || m._model === model) && m._output) input.push(...m._output);
    else {
      if (m.content) input.push({ role: m.role, content: m.content });
      for (const call of m.tool_calls || []) input.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: JSON.stringify(call.function.arguments) });
    }
  }
  return input;
}
function anthropicMessages(messages) {
  const result = [];
  for (const m of normalized(messages)) {
    if (m.role === 'system') continue;
    const role = m.role === 'tool' ? 'user' : m.role;
    const content = m.role === 'tool' ? [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content || '' }] : [ ...(m.content ? [{ type: 'text', text: m.content }] : []), ...(m.tool_calls || []).map(call => ({ type: 'tool_use', id: call.id, name: call.function.name, input: call.function.arguments })) ];
    if (!content.length) continue;
    if (result.at(-1)?.role === role) result.at(-1).content.push(...content); else result.push({ role, content });
  }
  return result;
}
async function chat(options) {
  const { provider, key, model, messages, tools = [], onText, signal, fetcher } = options;
  if (!Object.hasOwn(endpoints, provider)) throw Error('Unknown model provider.');
  let content = '', calls = [], complete = false, output, reasoning = [];
  const text = value => { if (value) { content += value; onText?.(value); } };
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  let body, endpoint, headers = {}, blocks = [], fragments = new Map();
  if (provider === 'openai') {
    endpoint = 'responses'; body = { model, instructions: system, input: openaiInput(messages,model), tools: tools.map(t => ({ type: 'function', ...t.function, strict: false })), stream: true, store: false };
  } else if (provider === 'anthropic') {
    endpoint = 'messages'; headers = { Authorization: '', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    body = { model, system, messages: anthropicMessages(messages), tools: tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })), max_tokens: 8192, stream: true };
  } else { endpoint = 'chat/completions'; body = { model, messages: routerMessages(messages,model), tools, stream: true }; }
  const response = await http(`${endpoints[provider]}/${endpoint}`, { key, body, signal, fetcher, headers, label: provider });
  await events(response, data => {
    if (data === '[DONE]') return;
    const item = JSON.parse(data);
    if (item.error || item.type === 'error') throw Error('The model provider reported an error. Check the selected model and account credits.');
    if (provider === 'openai') {
      if (item.type === 'response.output_text.delta') text(item.delta);
      if (item.type === 'response.failed' || item.type === 'response.incomplete') throw Error('OpenAI did not finish its response. Retry or choose another model.');
      if (item.type === 'response.completed') { output = item.response.output; complete = true; }
    } else if (provider === 'anthropic') {
      if (item.type === 'content_block_start') blocks[item.index] = { ...item.content_block };
      if (item.type === 'content_block_delta') {
        const block = blocks[item.index];
        if (item.delta.type === 'text_delta') { text(item.delta.text); if (block) block.text = (block.text || '') + item.delta.text; }
        if (item.delta.type === 'input_json_delta') fragments.set(item.index, (fragments.get(item.index) || '') + item.delta.partial_json);
      }
      if (item.type === 'message_delta' && item.delta?.stop_reason === 'max_tokens') throw Error('Claude reached its response limit. Retry with a shorter request.');
      if (item.type === 'message_stop') complete = true;
    } else {
      const choice = item.choices?.[0], delta = choice?.delta;
      text(delta?.content);
      if (delta?.reasoning_details) reasoning.push(...delta.reasoning_details);
      for (const call of delta?.tool_calls || []) {
        const entry = calls[call.index] ||= { id: '', function: { name: '', arguments: '' } };
        if (call.id) entry.id = call.id;
        if (call.function?.name) entry.function.name += call.function.name;
        if (call.function?.arguments) entry.function.arguments += call.function.arguments;
      }
      if (choice?.finish_reason) { if (!['stop', 'tool_calls'].includes(choice.finish_reason)) throw Error('The model did not finish its response. Retry with a shorter request.'); complete = true; }
    }
  });
  if (!complete) throw Error(`${provider} stream ended early. Please retry.`);
  if (provider === 'openai') {
    if (!Array.isArray(output)) throw Error('OpenAI returned no response output.');
    calls = output.filter(m => m.type === 'function_call').map(m => ({ id: m.call_id, function: { name: m.name, arguments: JSON.parse(m.arguments) } }));
  } else if (provider === 'anthropic') {
    calls = blocks.flatMap((block, index) => block.type === 'tool_use' ? [{ id: block.id, function: { name: block.name, arguments: fragments.has(index) ? JSON.parse(fragments.get(index)) : block.input } }] : []);
  } else calls = calls.filter(Boolean).map(call => ({ ...call, id: call.id || randomUUID(), function: { ...call.function, arguments: JSON.parse(call.function.arguments || '{}') } }));
  return { role: 'assistant', content, _provider: provider, _model: model, ...(output ? { _output: output } : {}), ...(reasoning.length ? { reasoning_details: reasoning } : {}), ...(calls.length ? { tool_calls: calls } : {}) };
}
async function listModels({ provider, key, baseUrl, signal, fetcher }) {
  const local = provider === 'ollama-local';
  if (!local && !Object.hasOwn(endpoints, provider)) throw Error('Unknown model provider.');
  const response = await http(local ? `${localUrl(baseUrl)}/api/tags` : `${endpoints[provider]}/models`, { key: local ? '' : key, signal, fetcher, label: provider, ...(provider === 'anthropic' ? { headers: { Authorization: '', 'x-api-key': key, 'anthropic-version': '2023-06-01' } } : {}) });
  const data = await response.json();
  return (local ? data.models || [] : data.data || []).filter(m => provider !== 'openrouter' || m.supported_parameters?.includes('tools')).map(m => local ? m.name : m.id).filter(Boolean).sort();
}
module.exports = { http, events, normalized, ollamaMessages, routerMessages, openaiInput, anthropicMessages, chat, listModels };
