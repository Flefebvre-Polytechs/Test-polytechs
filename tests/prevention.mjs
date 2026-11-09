import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {mock} from 'node:test';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-prevention-'));
try{
 mock.timers.enable({apis:['Date'],now:new Date('2026-11-07T12:00:00Z')});
 for(const [name,source] of [['prevention-rules','lib/prevention-rules.ts'],['modules','lib/modules.ts'],['workflows','lib/workflows.ts'],['prevention-readiness','lib/prevention-readiness.ts']]){
  const text=fs.readFileSync(source,'utf8').replaceAll("'./modules'","'./modules.mjs'").replaceAll("'./workflows'","'./workflows.mjs'").replaceAll("'./prevention-rules'","'./prevention-rules.mjs'");
  fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 }
 const {validate,blank,dateToday}=await import(pathToFileURL(path.join(dir,'workflows.mjs')));
 const r={...blank,kind:'Plans de prévention',domain:'Sécurité',title:'Maintenance ligne 4',owner:'QSSE',status:'À préparer',url:'https://example.test/ged/plan',details:{planType:'Ponctuel',urgent:'Non',inspectionDone:'Oui',cseEU:'Non',cseEUAbsence:'Absence vérifiée pour cet exercice',cseEE:'Non',cseEEAbsence:'Absence vérifiée pour cet exercice',contractor:'Prestataire',operation:'Maintenance',place:'Ligne 4',start:'2026-11-08',end:'2026-11-09',regime:'Intervention entreprise extérieure',hours:'8',dangerous:'Non',inspection:dateToday(),euRepresentative:'Polytechs',eeRepresentative:'Prestataire',inspectionAttendees:'Polytechs et prestataire',sector:'Ligne 4',dangerZones:'Machine consignée',circulation:'Voie A',facilities:'Vestiaire',instructions:'Consignes remises',equipment:'Outillage vérifié',emergency:'PC sécurité',coordination:'Chef chantier',maintenance:'Sans objet',medical:'Aucun',validator:'Responsable QSSE',riskRowsJson:JSON.stringify([{phase:'Consignation',hazard:'Redémarrage par l’équipe de production',measure:'Condamnation et vérification absence énergie',responsible:'Polytechs'}]),drivingNeeded:'Non',habilitationNeeded:'Non',loanNeeded:'Non',chemicalsNeeded:'Non',externalRiskNeeded:'Non',methodNeeded:'Non',credentialsJson:'[]',loansJson:'[]',agreementEU:'Accord EU 07/11',agreementEE:'Accord EE 07/11'}};
 assert.deepEqual(validate(r),[],'Brouillon enregistré');
 r.status='Validé';assert.deepEqual(validate(r),[],'Plan cohérent avant travaux');
 const {preventionReadiness,requiredPreventionDocuments}=await import(pathToFileURL(path.join(dir,'prevention-readiness.mjs')));
 assert.deepEqual(preventionReadiness(r,[],[]),[],'Readiness uses the same validated dossier');
 const missingInspection={...r,details:{...r.details,inspection:''}};
 assert.ok(preventionReadiness(missingInspection,[],[]).some(x=>x.step===1),'Missing inspection links to its step');
 const missingPhase={...r,details:{...r.details,riskRowsJson:'[]'}};
 assert.ok(preventionReadiness(missingPhase,[],[]).some(x=>x.step===2),'Risk analysis links to its step');
 const chemicalPlan={...r,details:{...r.details,chemicalsNeeded:'Oui'}};
 assert.deepEqual(requiredPreventionDocuments(chemicalPlan),['FDS']);
 assert.ok(preventionReadiness(chemicalPlan,[],null).some(x=>x.step===5),'Unloaded documents never show ready');
 assert.ok(preventionReadiness(chemicalPlan,[],[{id:'f',category:'FDS',status:'À examiner'}]).some(x=>x.step===5),'Received documents still need review');
 assert.ok(!preventionReadiness(chemicalPlan,[],[{id:'f',category:'FDS',status:'Accepté'}]).some(x=>x.step===5),'Accepted required documents complete their step');
 const newPlan={...r,title:'',details:{planType:'Ponctuel',urgent:'Non',inspectionDone:'Oui',cseEU:'Non',cseEUAbsence:'Absence vérifiée pour cet exercice',cseEE:'Non',cseEEAbsence:'Absence vérifiée pour cet exercice',contractor:''}};
 assert.equal(new Set(preventionReadiness(newPlan,[],[]).map(x=>x.step)).size,7,'A new dossier has no misleading complete stages');

 r.details.hours='400';assert.ok(validate(r).some(x=>x.includes('inspection du travail')),'400 h impose trace de notification');
 r.details.hours='8';r.details.dangerous='Oui';assert.ok(validate(r).some(x=>x.includes('inspection du travail')),'Travaux dangereux imposent plan écrit');
 r.details.inspectionNotice='Courrier du 07/11';assert.deepEqual(validate(r),[]);
 r.details.inspection='2026-11-10';assert.ok(validate(r).some(x=>x.includes('inspection commune')));r.details.inspection=dateToday();
 r.details.regime='Chargement / déchargement';assert.ok(validate(r).some(x=>x.includes('protocole')));r.details.regime='Intervention entreprise extérieure';
 r.details.riskRowsJson=JSON.stringify([{phase:'Consignation',hazard:'',measure:'',responsible:''}]);assert.ok(validate(r).some(x=>x.includes('risque d’interférence')));
 r.details.riskRowsJson=JSON.stringify([{phase:'Consignation',hazard:'Coactivité',measure:'Balisage',responsible:'Polytechs'}]);
 r.details.drivingNeeded='Oui';assert.ok(validate(r).some(x=>x.includes('Conduite')));
 r.details.credentialsJson=JSON.stringify([{type:'Conduite',person:'A',equipment:'Chariot',issuer:'Prestataire',reference:'R1',expiry:'2026-12-31',medicalChecked:'Non',siteBriefing:'Oui'}]);assert.ok(validate(r).some(x=>x.includes('attestation médicale')));
 r.details.credentialsJson=JSON.stringify([{type:'Conduite',person:'A',equipment:'Chariot',issuer:'Prestataire',reference:'R1',expiry:'2099-12-31',medicalChecked:'Oui',siteBriefing:'Oui'}]);assert.deepEqual(validate(r),[]);
 r.details.loanNeeded='Oui';assert.ok(validate(r).some(x=>x.includes('matériel prêté')));
 r.details.loansJson=JSON.stringify([{equipment:'Nacelle',condition:'Bon état',controls:'VGP vérifiée',responsible:'Polytechs',returnedAt:''}]);assert.deepEqual(validate(r),[]);
 r.details.chemicalsNeeded='Oui';assert.deepEqual(validate(r),[],'L’acceptation des pièces est vérifiée lors de l’enregistrement serveur.');
 r.status='Clôturé';assert.ok(validate(r).some(x=>x.includes('retour effectif')));assert.ok(validate(r).some(x=>x.includes('Information des intervenants')));r.details.loansJson=JSON.stringify([{equipment:'Nacelle',condition:'Bon état',controls:'VGP vérifiée',responsible:'Polytechs',returnedAt:dateToday()}]);r.details.briefing='Équipe informée';r.details.completedAt=dateToday();assert.deepEqual(validate(r),[]);
 console.log('Plans de prévention : brouillon, inspection préalable, risques par phase, 400 h, travaux dangereux, autre régime et clôture vérifiés.');
}finally{mock.timers.reset();fs.rmSync(dir,{recursive:true,force:true})}
