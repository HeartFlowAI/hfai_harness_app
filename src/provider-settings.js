const definitions = {
  'ollama-cloud': { name: 'Ollama Cloud', key: true },
  'openai': { name: 'OpenAI', key: true },
  'anthropic': { name: 'Claude / Anthropic', key: true },
  'openrouter': { name: 'OpenRouter', key: true },
  'ollama-local': { name: 'Local Ollama', key: false }
};
function localUrl(value = 'http://127.0.0.1:11434') {
  let url; try { url = new URL(value); } catch { throw Error('Enter a local Ollama address, such as http://127.0.0.1:11434.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('Local Ollama must use a loopback address without a path or credentials.');
  return url.origin;
}
function normalize(data) {
  data.connections = data.connections && typeof data.connections === 'object' && !Array.isArray(data.connections) ? data.connections : {};
  // Preserve the legacy encrypted key; never decrypt it during migration.
  if (!data.connections['ollama-cloud']) data.connections['ollama-cloud'] = { model: data.model || '', encryptedKey: data.encryptedKey || '' };
  for (const id of Object.keys(definitions)) {
    const entry = data.connections[id] || {};
    data.connections[id] = { model: typeof entry.model === 'string' ? entry.model : '', encryptedKey: typeof entry.encryptedKey === 'string' ? entry.encryptedKey : '', ...(id === 'ollama-local' ? { baseUrl: entry.baseUrl || 'http://127.0.0.1:11434' } : {}) };
  }
  if (!Object.hasOwn(definitions, data.provider)) data.provider = 'ollama-cloud';
  data.model = data.connections[data.provider].model;
}
function snapshot(data) {
  return Object.fromEntries(Object.entries(definitions).map(([id, definition]) => [id, { ...definition, model: data.connections[id].model, hasKey: !!data.connections[id].encryptedKey, baseUrl: data.connections[id].baseUrl }]));
}
module.exports = { definitions, localUrl, normalize, snapshot };
