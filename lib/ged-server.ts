import {database} from '@/db/raw';
import {gedSource} from './ged-private-source';
import {blankDocument,type GedDocument,type GedVersion,type GedUser} from './ged';
export async function gedUsers():Promise<GedUser[]>{
 const {results}=await database().prepare(`SELECT u.id,u.display_name,u.role,coalesce(p.manager_id,'') AS managerId,
   (r.user_id IS NOT NULL AND u.role IN ('editor','admin')) AS gedReviewer,
   COALESCE(p.qsse, u.username IN ('flavien','karine') OR EXISTS(
     SELECT 1 FROM team_members tm WHERE tm.user_id=u.id AND tm.team_id='qsse' AND tm.level='contributor'
   )) AS qsse
   FROM users u LEFT JOIN ged_profiles p ON p.user_id=u.id
   LEFT JOIN member_function_roles r ON r.user_id=u.id AND r.role='ged_reviewer'
   ORDER BY u.display_name`).all();
 return (results as (Omit<GedUser,'qsse'|'gedReviewer'>&{qsse:number;gedReviewer:number})[]).map(u=>({...u,qsse:!!u.qsse,gedReviewer:!!u.gedReviewer}));
}
export async function gedDocuments(){const db=database(),docs=new Map<string,GedDocument>((gedSource?.records||[]).map(d=>[d.id,d]));const [rows,legacy]=await Promise.all([db.prepare('SELECT * FROM ged_documents').all(),db.prepare("SELECT * FROM records WHERE kind='Gestion documentaire'").all()]);for(const x of legacy.results as any[]){const details=JSON.parse(x.details||'{}');docs.set('ged-legacy-'+x.id,{...blankDocument(),id:'ged-legacy-'+x.id,ref:details.reference||x.title,index:details.version||'',title:x.title,type:details.type||'Procédure',comment:x.description||'',sourceSheet:'Ancien registre',sourceConform:'',catalogStatus:'À vérifier',issues:['Applicabilité à confirmer dans la GED'],raw:{'Ancienne fiche':x.id,'Statut':x.status,'Lien':x.url||''}})}for(const x of rows.results as any[]){const original=docs.get(x.id);docs.set(x.id,{...JSON.parse(x.data),id:x.id,revision:x.revision,publishedVersionId:x.published_version_id||'',raw:original?.raw,sourceSheet:original?.sourceSheet||'',sourceRow:original?.sourceRow||0})}return docs}
export function parseVersion(row:any):GedVersion{return {...row,data:JSON.parse(row.data)}}
export async function gedVersion(id:string){const row=await database().prepare('SELECT * FROM ged_versions WHERE id=?').bind(id).first<any>();return row?parseVersion(row):null}
