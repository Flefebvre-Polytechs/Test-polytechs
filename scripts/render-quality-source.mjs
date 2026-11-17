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
  const installed = previousBytes ? JSON.parse(previousBytes) : null;
  if (installed && (digest(previousBytes) === hash || installed.transferHash === hash)) {
    console.log('QSSE quality source already installed:', installed.records.length, 'actions.');
    return;
  }

  const previous = installed?.records ?? [];
  const previousByIdentity = new Map(previous.map(action => [identity(action), action]));
  const existingNumbers = new Set(previous.map(action => action.raw?.A));
  const reservedIds = new Set(previous.map(action => action.id));
  const incomingIdentities = new Set();
  const incomingNumbers = new Set();
  const merged = [];

  for (const action of records.values()) {
    const key = identity(action);
    const number = action.raw.A;
    const existing = previousByIdentity.get(key);
    if (incomingNumbers.has(number) || (existingNumbers.has(number) && !existing)) {
      throw Error('An existing quality source number has a different reference.');
    }
    incomingNumbers.add(number);
    incomingIdentities.add(key);
    const id = existing?.id ?? (reservedIds.has(action.id) ? 'quality-workbook-' + number : action.id);
    if (!existing && reservedIds.has(id)) throw Error('Quality source action identifier collision.');
    reservedIds.add(id);
    merged.push({...action,id});
  }

  const retained = previous.filter(action => !incomingIdentities.has(identity(action)));
  merged.push(...retained);
  const contents = JSON.stringify({...next,transferHash:hash,records:merged});

  const temp = path + '.' + randomUUID() + '.tmp';
  try {
    if (previousBytes) await writeFile(path + '.previous', previousBytes, {mode:0o600});
    await writeFile(temp, contents, {mode:0o600, flag:'wx'});
    await rename(temp, path);
  } finally {
    await rm(temp, {force:true});
  }
  console.log('QSSE quality source installed:', merged.length, 'actions;', merged.length - previous.length, 'additional source rows;', retained.length, 'prior rows retained.');
}
