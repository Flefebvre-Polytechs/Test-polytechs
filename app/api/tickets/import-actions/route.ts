import {checkOrigin,requireRole} from '@/lib/access';

export async function POST(req:Request){
 if(!checkOrigin(req))return Response.json({error:'Origine non autorisée.'},{status:403});
 const gate=await requireRole(req,'admin');
 if(gate.error)return gate.error;
 return Response.json({error:'La création de tickets par import a été désactivée.'},{status:410});
}
