const test = require('node:test');
const assert = require('node:assert/strict');
const { chat, request } = require('../src/provider');

function streamed(chunks) {
  return async () => new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } }), { status: 200 });
}
test('Ollama stream survives split JSON lines and retains tool calls', async () => {
  const events = [], args = { key: 'test-key', model: 'test', messages: [], tools: [], signal: new AbortController().signal, onText: t => events.push(t) };
  const result = await chat({ ...args, fetcher: streamed(['{"message":{"content":"Hi ', 'Aurora"}}\n{"message":{"tool_calls":[{"function":{"name":"read_file","arguments":{"path":"hello.txt"}}}]}}\n', '{"done":true}\n']) });
  assert.equal(result.content, 'Hi Aurora'); assert.equal(result.tool_calls[0].function.name, 'read_file'); assert.deepEqual(events, ['Hi Aurora']);
});
test('incomplete stream is reported rather than silently accepted', async () => {
  await assert.rejects(chat({ key: 'test-key', model: 'test', messages: [], tools: [], fetcher: streamed(['{"message":{"content":"partial"}}\n']) }), /ended early/);
});
test('thinking content is preserved for subsequent tool turns', async () => {
  const result = await chat({ key: 'test-key', model: 'test', messages: [], tools: [], fetcher: streamed(['{"message":{"thinking":"plan"}}\n{"message":{"content":"ok"},"done":true}\n']) });
  assert.equal(result.thinking, 'plan'); assert.equal(result.content, 'ok');
});
test('authentication errors are actionable and keys are redacted', async () => {
  await assert.rejects(request('chat', 'secret', {}, null, async () => new Response('secret bad', { status: 401 })), /rejected the API key/);
  await assert.rejects(request('chat', 'secret', {}, null, async () => new Response('secret bad', { status: 500 })), error => !error.message.includes('secret'));
});
