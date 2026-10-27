import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-builder-'));
try{
 for(const name of ['hub','audit-builder']){const source=fs.readFileSync('lib/'+name+'.ts','utf8').replace("from './hub'","from './hub.mjs'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
 const hub=await import(path.join(dir,'hub.mjs')),builder=await import(path.join(dir,'audit-builder.mjs'));
 const routine={title:'Audit',description:'',teams:['qsse'],pilot:'pilot',start:'2028-01-31',time:'09:00',repeat:'monthly',interval:1,end:'',active:true,questions:[{id:'a',label:'Contrôle A',section:'Terrain'},{id:'b',label:'Contrôle B',section:'Terrain'},{id:'c',label:'Contrôle C',section:'Machines'}]};
 assert.deepEqual(builder.moveAuditQuestion(routine.questions,'b',-1).map(q=>q.id),['b','a','c']);assert.deepEqual(routine.questions.map(q=>q.id),['a','b','c'],'Moving never mutates the source');
 assert.deepEqual(builder.moveAuditQuestion(routine.questions,'c',-1),routine.questions,'Question moves stay in the selected theme');
 assert.deepEqual(builder.moveAuditTheme(routine.questions,'Machines',-1).map(q=>q.id),['c','a','b']);
 let id=0;const bulk=builder.bulkAuditQuestions('1. Premier contrôle\n\n- Second contrôle\n• Troisième contrôle','Terrain',()=>String(++id));assert.equal(bulk.length,3);assert.equal(new Set(bulk.map(q=>q.id)).size,3);assert.equal(bulk[1].label,'Second contrôle');
 assert.equal(builder.uniqueAuditTheme('Terrain',routine.questions),'Terrain (2)');
 for(const template of builder.auditTemplates){const questions=builder.templateQuestions(template.id,()=>String(++id));assert.equal(hub.routineError({...routine,questions}),'');assert.ok(questions.every(q=>q.evidence==='comment'));assert.equal(new Set(questions.map(q=>q.id)).size,questions.length)}
 assert.deepEqual(builder.nextAuditDates(routine,'2028-01-01'),['2028-01-31','2028-02-29','2028-03-31','2028-04-30']);assert.deepEqual(builder.nextAuditDates({...routine,interval:0}),[]);
 assert.equal(builder.auditBuilderIssues(routine).filter(i=>i.level==='error').length,0);
 const duplicate={...routine,questions:[{id:'a',label:'Électricité',section:'Terrain'},{id:'b',label:'electricite',section:'Terrain'}]};assert.ok(builder.auditBuilderIssues(duplicate).some(i=>i.level==='advice'&&i.questionId==='b'));
 assert.ok(builder.auditBuilderIssues({...routine,title:'',teams:[],questions:[{id:'x',label:''}]}).filter(i=>i.level==='error').length>=3);
 assert.ok(hub.routineError({...routine,questions:[{id:'a',label:'Test',type:'unknown'}]}));assert.ok(hub.routineError({...routine,questions:[{id:'a',label:'Test',required:'yes'}]}));assert.ok(hub.routineError({...routine,questions:[{id:'a',label:'Test',help:'x'.repeat(1001)}]}));
 const answers=[{id:'a',label:'Contrôle',result:'Conforme',comment:''},{id:'b',label:'Nombre',type:'number',value:'0',result:'Information',comment:''},{id:'c',label:'Texte',type:'text',value:'Conforme',result:'Conforme',comment:''},{id:'d',label:'Date',type:'date',value:'2026-10-27',result:'Information',comment:''},{id:'e',label:'Facultatif',required:false,result:'À faire',comment:''}];
 const score=hub.auditScore(answers);assert.equal(score.percent,100);assert.equal(score.conform,1,'Informational answers cannot inflate the score');assert.equal(score.information,3);assert.equal(score.requiredPending,0);assert.equal(score.pending,1);assert.equal(hub.auditCompletionError({answers,notes:'',completed:true}),'');
 assert.equal(hub.auditScore([{...answers[1],value:''}]).percent,null);assert.equal(hub.auditScore([{...answers[1],value:''}]).requiredPending,1);
 assert.ok(hub.auditAnswerError({type:'number'},{value:'Infinity',comment:''}));assert.ok(hub.auditAnswerError({type:'date'},{value:'2026-02-30',comment:''}));assert.equal(hub.auditAnswerError({type:'number'},{value:'12,5',comment:''}),'');
 const nonconform={id:'proof',label:'Fuite',result:'Non conforme',comment:'',evidence:'both'};assert.ok(hub.auditCompletionError({answers:[nonconform]}));assert.ok(hub.auditCompletionError({answers:[{...nonconform,comment:'Fuite observée'}],photos:[]}));assert.equal(hub.auditCompletionError({answers:[{...nonconform,comment:'Fuite observée'}],photos:[{questionId:'proof'}]}),'');
 console.log('Audit builder: templates, immutable theme/question ordering, bulk entry, duplicate advice, leap-year schedule, typed validation, optional answers, neutral information fields and required evidence passed.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
