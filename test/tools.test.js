const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { workspacePath, executeTool, runPowerShell } = require('../src/tools');

test('file tool confines paths, rejects junction escapes, and respects approval', async t => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'aurora-test-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const workspace = path.join(base, 'workspace'), outside = path.join(base, 'outside');
  await fs.mkdir(workspace); await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'secret.txt'), 'private');
  await fs.symlink(outside, path.join(workspace, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const input of ['../outside/secret.txt', path.join(outside, 'secret.txt'), 'safe.txt:stream', 'escape/secret.txt']) {
    await assert.rejects(workspacePath(workspace, input));
  }
  await assert.rejects(workspacePath(workspace, 'escape/new.txt', true));
  const context = { workspace, signal: new AbortController().signal, approve: async () => false };
  const denied = await executeTool('write_file', { path: 'hello.txt', content: 'hello' }, context);
  assert.equal(denied.denied, true); await assert.rejects(fs.stat(path.join(workspace, 'hello.txt')));
  context.approve = async () => true;
  await executeTool('write_file', { path: 'hello.txt', content: 'Aurora ♥' }, context);
  assert.equal(await executeTool('read_file', { path: 'hello.txt' }, context), 'Aurora ♥');
  await fs.writeFile(path.join(workspace, 'binary.bin'), Buffer.from([0, 1, 2]));
  await assert.rejects(executeTool('read_file', { path: 'binary.bin' }, context), /binary/);
  await assert.rejects(executeTool('write_file', { path: 'hello.txt', content: 'x', surprise: 'y' }, context), /Unexpected/);
});

test('PowerShell captures results and stops an active process', { skip: process.platform !== 'win32' }, async () => {
  const result = await runPowerShell('Write-Output "aurora-test"', process.cwd(), new AbortController().signal);
  assert.equal(result.exitCode, 0); assert.match(result.output, /aurora-test/);
  const controller = new AbortController();
  const started = Date.now();
  const running = runPowerShell('Start-Sleep -Seconds 20', process.cwd(), controller.signal);
  setTimeout(() => controller.abort(), 400);
  await assert.rejects(running, /Stopped/);
  assert.ok(Date.now() - started < 8000, 'Stop must actually terminate the command promptly');
});
