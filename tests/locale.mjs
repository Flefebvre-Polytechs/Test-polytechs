import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-locale-'));
class TextNode{nodeType=3;constructor(text){this.textContent=text;this.parentElement=null}}
class ElementNode{nodeType=1;constructor(tag,attrs={},children=[]){this.tag=tag;this.attrs=new Map(Object.entries(attrs));this.children=children;for(const child of children)child.parentElement=this;this.parentElement=null}getAttribute(n){return this.attrs.get(n)??null}setAttribute(n,v){this.attrs.set(n,v)}removeAttribute(n){this.attrs.delete(n)}closest(selector){for(let p=this;p;p=p.parentElement){if(selector.includes('[data-no-translate]')&&p.attrs.has('data-no-translate')||selector.includes(p.tag)&&['script','style','textarea'].includes(p.tag)||selector.includes('[contenteditable="true"]')&&p.attrs.get('contenteditable')==='true')return p}return null}querySelectorAll(){return this.children.flatMap(c=>c instanceof ElementNode?[c,...c.querySelectorAll('*')]:[])}append(child){child.parentElement=this;this.children.push(child)}}
class Observer{static current;constructor(callback){this.callback=callback;Observer.current=this}observe(root,options){this.root=root;this.options=options}disconnect(){this.stopped=true}trigger(changes){if(!this.stopped)this.callback(changes)}}
try{
for(const name of ['interface-locale-extra','interface-locale','smi-seed','smi']){const input=fs.readFileSync('lib/'+name+'.ts','utf8').replace("'./interface-locale-extra'","'./interface-locale-extra.mjs'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
const locale=await import(path.join(dir,'interface-locale.mjs'));
const extra=await import(path.join(dir,'interface-locale-extra.mjs'));
for(const row of extra.additionalTranslations){assert.equal(row.length,5);assert.ok(row.every(s=>s.trim()));for(const language of ['en','de','it','es'])if(!['Version','Leadership','Support','name@example.com'].includes(row[0]))assert.notEqual(locale.translate(row[0],language),row[0],row[0]+' / '+language)}
// New interface labels in these modules must ship with translations.
for(const file of ['components/team-access-panel.tsx','app/smi/page.tsx','components/team-invitations-panel.tsx','app/invitation/page.tsx']){
 const root=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function check(node){
  let text='';if(ts.isJsxText(node))text=node.text.trim().replace(/\s+/g,' ');
  if(ts.isJsxAttribute(node)&&['placeholder','title','aria-label','label'].includes(node.name.getText())&&node.initializer&&ts.isStringLiteral(node.initializer))text=node.initializer.text;
  if(/[A-Za-zÀ-ÿ]{2}/.test(text))assert.ok(locale.hasTranslation(text),file+': '+text);
  ts.forEachChild(node,check);
 }
 check(root);
}
const {requirementSeed}=await import(path.join(dir,'smi-seed.mjs'));
for(const requirement of requirementSeed){assert.ok(locale.hasTranslation(requirement.title),requirement.title);assert.ok(locale.hasTranslation(requirement.guidance),requirement.guidance)}
const {smiView,emptyFilters}=await import(path.join(dir,'smi.mjs'));
const requirement=requirementSeed.find(r=>r.topic==='stakeholders');
const matrix={requirements:[requirement],standards:[{id:requirement.standard_id,active:true,name:'ISO 9001',edition:'2026'}],documents:[],links:[],teams:[]};
assert.equal(smiView(matrix,{...emptyFilters,search:'interested parties'},v=>locale.translate(v,'en')).length,1,'Search accepts translated requirement titles');
assert.equal(smiView(matrix,{...emptyFilters,search:'parties intéressées'},v=>locale.translate(v,'en')).length,1,'Search retains original requirement titles');
const label=new TextNode('  Membres et droits de l’équipe  '),username=new TextNode('Enregistrer'),comment=new TextNode('Créer un ticket');
const input=new ElementNode('input',{'placeholder':'Nom du membre…','aria-label':'Rechercher une personne','title':'Membres et paramètres','value':'Nom saisi par un utilisateur'});
const textarea=new ElementNode('textarea',{'placeholder':'Rechercher…'},[comment]);
const protectedLabel=new ElementNode('span',{'data-no-translate':''},[username]);
const body=new ElementNode('body',{},[new ElementNode('h1',{},[label]),input,textarea,protectedLabel]);
globalThis.Node={TEXT_NODE:3};globalThis.Element=ElementNode;globalThis.NodeFilter={SHOW_TEXT:4};globalThis.MutationObserver=Observer;
globalThis.document={body,documentElement:{lang:'fr'},createTreeWalker(root){const nodes=[];function visit(n){for(const c of n.children||[]){if(c.nodeType===3)nodes.push(c);else visit(c)}}visit(root);let i=-1;return{nextNode(){return ++i<nodes.length},get currentNode(){return nodes[i]}}}};
let stop=locale.watchLocale('en');assert.equal(label.textContent,'  Team members and permissions  ');assert.equal(input.getAttribute('placeholder'),'Member name…');assert.equal(input.getAttribute('aria-label'),'Search for a person');assert.equal(textarea.getAttribute('placeholder'),'Search…');assert.equal(comment.textContent,'Créer un ticket');assert.equal(username.textContent,'Enregistrer');assert.equal(input.getAttribute('value'),'Nom saisi par un utilisateur');
const dialog=new ElementNode('section',{},[new TextNode('Ouvrir dans la GED')]);body.append(dialog);Observer.current.trigger([{type:'childList',addedNodes:[dialog]}]);assert.equal(dialog.children[0].textContent,'Open in document management');
input.setAttribute('title','Paramètres de l’équipe');Observer.current.trigger([{type:'attributes',target:input}]);assert.equal(input.getAttribute('title'),'Team settings');
stop();assert.equal(label.textContent,'  Membres et droits de l’équipe  ');assert.equal(input.getAttribute('title'),'Paramètres de l’équipe');assert.equal(input.getAttribute('placeholder'),'Nom du membre…');assert.equal(document.documentElement.lang,'fr');
for(const language of ['de','it','es','en','fr']){stop=locale.watchLocale(language);assert.equal(label.textContent,'  '+locale.translate('Membres et droits de l’équipe',language)+'  ');assert.equal(document.documentElement.lang,language);stop()}
assert.equal(locale.resolveLocale('invalid'),'fr');assert.equal(locale.resolveLocale(null),'fr');assert.equal(locale.resolveLocale('en'),'en');
console.log('Locale: four complete translation columns, language switching/restoration, late dialogs, dynamic attributes, textarea placeholders and protected user content passed.');
}finally{fs.rmSync(dir,{recursive:true,force:true});for(const key of ['Node','Element','NodeFilter','MutationObserver','document'])delete globalThis[key]}
