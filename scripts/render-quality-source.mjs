import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function identity(action) {
  return JSON.stringify([action.raw?.A, action.raw?.B]);
}

export async function installQualitySource(dir, env) {
  const manifest = env.POLYTECHS_QUALITY_SOURCE;
  if (!manifest) return;

  const [hash, parts] = manifest.split(':');
  const count = Number(parts);
  if (!/^[a-f0-9]{64}$/.test(hash) || !Number.isInteger(count) || count < 1 || count > 32) {
    throw Error('Invalid quality source manifest.');
  }

  const chunks = Array.from({length:count}, (_, index) => env['POLYTECHS_QUALITY_SOURCE_' + (index + 1)]);
  if (chunks.some(chunk => !chunk || !/^[a-z0-9+/=]+$/i.test(chunk))) {
    throw Error('Incomplete quality source transfer.');
  }
  const bytes = gunzipSync(Buffer.from(chunks.join(''), 'base64'), {maxOutputLength:8 * 1024 * 1024});
  if (digest(bytes) !== hash) throw Error('Quality source checksum mismatch.');

  const next = JSON.parse(bytes);
  if (!Array.isArray(next.records) || !next.records.length) throw Error('Empty quality source.');
  const records = new Map();
  for (const action of next.records) {
    if (!Number.isInteger(action.sourceRow) || action.sourceRow < 6 ||
        action.id !== 'quality-source-' + action.sourceRow || action.revision !== 0 ||
        typeof action.reference !== 'string' || !action.reference.trim() ||
        !/^\d+$/.test(action.raw?.A || '') || action.reference !== action.raw?.B ||
        records.has(action.id)) {
      throw Error('Invalid or duplicate quality source row.');
    }
    records.set(action.id, action);
  }

  const privateDir = join(dir, 'private');
  await mkdir(privateDir, {recursive:true, mode:0o700});
  const path = join(privateDir, 'quality-actions-source.json');
  const previousBytes = await readFile(path).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (previousBytes && digest(previousBytes) === hash) {
    console.log('QSSE quality source already installed:', records.size, 'actions.');
    return;
  }

  const previous = previousBytes ? JSON.parse(previousBytes).records : [];
  for (const action of previous) {
    const replacement = records.get(action.id);
    if (!replacement || identity(replacement) !== identity(action)) {
      throw Error('Quality source would remove or reassign an existing action.');
    }
  }

  const temp = path + '.' + randomUUID() + '.tmp';
  try {
    if (previousBytes) await writeFile(path + '.previous', previousBytes, {mode:0o600});
    await writeFile(temp, bytes, {mode:0o600, flag:'wx'});
    await rename(temp, path);
  } finally {
    await rm(temp, {force:true});
  }
  console.log('QSSE quality source installed:', records.size, 'actions;', records.size - previous.length, 'additional source rows.');
}
