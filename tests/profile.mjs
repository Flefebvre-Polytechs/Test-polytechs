import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qse-profile-'));
const db=new DatabaseSync(':memory:');
const objects=new Map();
function statement(sql,args=[]){return {bind(...values){return statement(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}
globalThis.profileDb={prepare:statement};
globalThis.profileBucket={async put(key,bytes){objects.set(key,bytes)},async get(key){return objects.has(key)?{body:objects.get(key)}:null},async delete(key){objects.delete(key)}};
function compile(name,file){const source=fs.readFileSync(file,'utf8').replaceAll("'@/db/raw'","'./raw.mjs'").replaceAll("'@/lib/access'","'./access.mjs'").replaceAll("'./interface-locale-extra'","'./interface-locale-extra.mjs'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
try{
 db.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT); INSERT INTO users VALUES (\'one\',\'reader\'),(\'two\',\'admin\');');
 db.exec(fs.readFileSync('drizzle/0019_tense_butterfly.sql','utf8'));
 fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.profileDb;export const bucket=()=>globalThis.profileBucket;');
 fs.writeFileSync(path.join(dir,'access.mjs'),`export const checkOrigin=req=>req.headers.get('origin')===new URL(req.url).origin;export async function requireRole(req){const id=req.headers.get('x-test-user');return ['one','two'].includes(id)?{user:{id}}:{error:new Response(null,{status:401})}}`);
 compile('profile','app/api/profile/route.ts');compile('photo','app/api/profile/photo/route.ts');compile('interface-locale-extra','lib/interface-locale-extra.ts');compile('locale','lib/interface-locale.ts');
 const api=await import(path.join(dir,'profile.mjs')),photo=await import(path.join(dir,'photo.mjs')),locale=await import(path.join(dir,'locale.mjs'));
 const req=(method='GET',user='one',body,headers={})=>new Request('https://example.test/api/profile',{method,headers:{'x-test-user':user,origin:'https://example.test',...headers},body});
 assert.equal((await api.GET(req('GET',''))).status,401);
 assert.deepEqual(await (await api.GET(req())).json(),{locale:'fr',photoUrl:''});
 for(const language of Object.keys(locale.languages)){const response=await api.POST(req('POST','one',JSON.stringify({locale:language}),{'content-type':'application/json'}));assert.equal(response.status,200);assert.equal((await (await api.GET(req())).json()).locale,language)}
 assert.equal((await api.POST(req('POST','one','{"locale":"xx"}'))).status,400);
 assert.equal((await api.POST(req('POST','one','{"locale":"en"}',{origin:'https://evil.test'}))).status,403);
 assert.equal((await (await api.GET(req('GET','two'))).json()).locale,'fr','Preferences must be account-specific');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6GQAAAAASUVORK5CYII=','base64');
 assert.equal((await api.PUT(req('PUT','one','<svg/>',{'content-type':'image/svg+xml'}))).status,400);
 assert.equal((await api.PUT(req('PUT','one','wrong',{'content-type':'image/png'}))).status,400);
 assert.equal((await api.PUT(req('PUT','one',new Uint8Array(2_000_001),{'content-type':'image/png'}))).status,413);
 assert.equal((await api.PUT(req('PUT','one',png,{'content-type':'image/png'}))).status,200);
 assert.equal(objects.size,1);
 assert.equal((await api.PUT(req('PUT','one',png,{'content-type':'image/png'}))).status,200);
 assert.equal(objects.size,1,'Replacing a photo cleans up the previous file');
 assert.equal((await photo.GET(req('GET','two'))).status,404,'Default photo endpoint remains scoped to the signed-in account');
 const directoryRequest=(user,id)=>new Request('https://example.test/api/profile/photo?user='+encodeURIComponent(id),{headers:{'x-test-user':user}});
 assert.equal((await photo.GET(directoryRequest('', 'one'))).status,401,'Directory photos require authentication');
 assert.equal((await photo.GET(directoryRequest('two','one'))).status,200,'Members can see directory profile photos');
 assert.equal((await photo.GET(directoryRequest('two','missing'))).status,404);
 assert.equal((await photo.GET(directoryRequest('two',"one' OR 1=1--"))).status,404);
 const savedPhoto=await photo.GET(req());assert.equal(savedPhoto.status,200);assert.equal(savedPhoto.headers.get('cache-control'),'private, no-store');assert.equal(savedPhoto.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(new Uint8Array(await savedPhoto.arrayBuffer()),new Uint8Array(png));
 assert.equal((await api.DELETE(req('DELETE'))).status,200);assert.equal(objects.size,0);assert.equal((await (await api.GET(req())).json()).locale,'es','Removing a photo keeps the chosen language');
 assert.equal(db.prepare("SELECT role FROM users WHERE id='one'").get().role,'reader');
 for(const [language,expected] of Object.entries({fr:'Mon profil',en:'My profile',de:'Mein Profil',it:'Il mio profilo',es:'Mi perfil'}))assert.equal(locale.translate('Mon profil',language),expected);
 assert.equal(locale.translate('Polytechs document 123','en'),'Polytechs document 123');
 console.log('Profile: French default, five persisted locales, per-account isolation, origin checks, image validation/size limits, private photo retrieval, replacement/removal and unchanged roles passed.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});delete globalThis.profileDb;delete globalThis.profileBucket}
