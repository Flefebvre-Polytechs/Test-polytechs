import {DatabaseSync, type StatementSync} from 'node:sqlite';
import {createReadStream, promises as fs} from 'node:fs';
import {resolve, dirname, sep} from 'node:path';
import {Readable} from 'node:stream';

const storage=process.env.POLYTECHS_DATA_DIR;
if(!storage)throw new Error('POLYTECHS_DATA_DIR requires a persistent Render disk.');
const base=resolve(storage),file=resolve(base,'polytechs.sqlite'),objects=resolve(base,'objects');
let connection:DatabaseSync|undefined;
function sqlite(){if(!connection){connection=new DatabaseSync(file);connection.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')}return connection}
type Bound={statement:StatementSync;values:unknown[]};
function prepared(sql:string){const statement=sqlite().prepare(sql);const make=(values:unknown[])=>({statement,values,
  async run(){const result=statement.run(...values as []);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}},
  async all(){return {results:statement.all(...values as [])}},
  async first<T>(){return (statement.get(...values as [])??null) as T|null}
});return {...make([]),bind(...values:unknown[]){return make(values)}}}
export function database(){return {prepare:prepared,async batch(statements:Bound[]){const db=sqlite();db.exec('BEGIN IMMEDIATE');try{const results=statements.map(({statement,values})=>{const result=statement.columns().length?statement.all(...values as []):statement.run(...values as []);return Array.isArray(result)?{results:result,meta:{changes:0}}:{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}});db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}}} as unknown as D1Database}
function objectPath(key:string){if(!key||key.includes('\\')||key.split('/').some(x=>!x||x==='.'||x==='..'))throw new Error('Invalid object key');const path=resolve(objects,key);if(!path.startsWith(objects+sep))throw new Error('Invalid object key');return path}
export function bucket(){return {
  async put(key:string,bytes:Uint8Array){const path=objectPath(key);await fs.mkdir(dirname(path),{recursive:true});const temp=path+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,bytes,{flag:'wx'});await fs.rename(temp,path)}catch(e){await fs.rm(temp,{force:true});throw e}},
  async get(key:string){const path=objectPath(key);try{const stat=await fs.stat(path);if(!stat.isFile())return null;return {body:Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,size:stat.size}}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e}},
  async delete(key:string){await fs.rm(objectPath(key),{force:true})}
} as unknown as R2Bucket}
