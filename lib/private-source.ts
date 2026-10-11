import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// Render reads optional seed files on the server only. Persisted records live on disk.
export function privateSource<T>(name:string,fallback:T):T{
  try{return JSON.parse(readFileSync(join(process.cwd(),'private',name),'utf8')) as T}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return fallback;throw error}
}
