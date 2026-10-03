const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const skip = new Set(['node_modules', '.git', '$recycle.bin', 'windows', 'appdata']);

// Filename metadata only; never reads file contents or follows junctions.
async function searchFiles(query, roots, signal, { maxEntries = 60000, timeoutMs = 12000, maxResults = 40 } = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 200) throw new Error('Use a filename or a few filename keywords (under 200 characters).');
  const tokens = query.toLowerCase().replace(/["']/g, '').split(/\s+/).filter(Boolean);
  const patterns = tokens.map(t => new RegExp(t.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i'));
  const stack = [], visited = new Set(), matches = [], searched = [], unavailable = [];
  for (const root of roots) {
    try { const resolved = await fs.realpath(root); if (!visited.has(resolved.toLowerCase())) { visited.add(resolved.toLowerCase()); stack.push(resolved); searched.push(resolved); } }
    catch { unavailable.push(root); }
  }
  let examined = 0, truncated = false;
  const deadline = Date.now() + timeoutMs;
  while (stack.length) {
    signal.throwIfAborted();
    if (examined >= maxEntries || Date.now() >= deadline || matches.length >= maxResults) { truncated = true; break; }
    const folder = stack.pop();
    let entries;
    try { entries = await fs.readdir(folder, { withFileTypes: true }); } catch { unavailable.push(folder); continue; }
    for (const entry of entries) {
      signal.throwIfAborted();
      if (++examined > maxEntries || Date.now() >= deadline || matches.length >= maxResults) { truncated = true; break; }
      const filename = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { if (!skip.has(entry.name.toLowerCase()) && !visited.has(filename.toLowerCase())) { visited.add(filename.toLowerCase()); stack.push(filename); } continue; }
      if (!entry.isFile() || !patterns.every(p => p.test(entry.name))) continue;
      try { const info = await fs.stat(filename); matches.push({ id: randomUUID(), name: entry.name, path: filename, size: info.size, modified: info.mtime.toISOString() }); } catch {}
    }
    // Yield between directories so cancellation and window events remain responsive.
    await new Promise(resolve => setImmediate(resolve));
  }
  matches.sort((a,b) => a.name.localeCompare(b.name));
  return { matches, searched, unavailable: unavailable.slice(0,10), examined, truncated, scope: 'Filename search in configured folders; file contents were not read.' };
}
module.exports = { searchFiles };
