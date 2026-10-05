async function request(endpoint, key, body, signal, fetcher = fetch) {
  const response = await fetcher(`https://ollama.com/api/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(120000)])
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500).split(key).join('[redacted]');
    throw new Error(response.status === 401 ? 'Ollama rejected the API key. Check Settings.' : `Ollama ${response.status}: ${detail}`);
  }
  return response;
}

async function chat({ key, model, messages, tools, signal, onText, fetcher, provider = 'ollama-cloud', baseUrl }) {
  if (!['ollama-cloud', 'ollama-local'].includes(provider)) return require('./provider-adapters').chat({ key, model, messages, tools, signal, onText, fetcher, provider });
  const body = { model, messages: require('./provider-adapters').ollamaMessages(messages), tools, stream: true };
  const response = provider === 'ollama-local'
    ? await require('./provider-adapters').http(`${require('./provider-settings').localUrl(baseUrl)}/api/chat`, { body, signal, fetcher, label: 'Local Ollama' })
    : await request('chat', key, body, signal, fetcher);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '', content = '', thinking = '', calls = [], complete = false;
  const parse = line => {
    if (!line.trim()) return;
    const item = JSON.parse(line);
    if (item.error) throw new Error(String(item.error));
    const message = item.message || {};
    if (message.thinking) thinking += message.thinking;
    if (message.content) { content += message.content; onText?.(message.content); }
    if (message.tool_calls) calls.push(...message.tool_calls);
    if (item.done) complete = true;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) parse(line);
    }
    pending += decoder.decode(); parse(pending);
    if (!complete) throw new Error('Ollama stream ended early. Please retry.');
    return { role: 'assistant', content, ...(thinking ? { thinking } : {}), ...(calls.length ? { tool_calls: calls } : {}) };
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

async function listModels(key, signal, options = {}) {
  if (options.provider && options.provider !== 'ollama-cloud') return require('./provider-adapters').listModels({ ...options, key, signal });
  const response = await request('tags', key, null, signal);
  const body = await response.json();
  return (body.models || []).map(m => m.name).filter(Boolean);
}
async function webSearch(key, query, signal) {
  const response = await request('web_search', key, { query, max_results: 5 }, signal);
  return response.json();
}
module.exports = { request, chat, listModels, webSearch };
