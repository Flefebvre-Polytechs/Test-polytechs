import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

// Render reads optional seed files on the server only. Persisted records live on disk.
export function privateSource<T>(name:string,fallback:T):T{
  const mounted=process.env.POLYTECHS_DATA_DIR&&join(process.env.POLYTECHS_DATA_DIR,'private',name);
  const path=mounted&&existsSync(mounted)?mounted:join(process.cwd(),'private',name);
  try{return JSON.parse(readFileSync(path,'utf8')) as T}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return fallback;throw error}
}
