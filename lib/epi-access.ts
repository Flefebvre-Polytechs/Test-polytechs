import {database} from '@/db/raw';
import type {Account} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';

export async function epiCanManage(user:Account){
  if(user.role==='admin')return true;
  if(user.role!=='editor')return false;
  return !!await database().prepare('SELECT 1 FROM epi_managers WHERE user_id=?').bind(user.id).first();
}

export async function epiCanRead(user:Account){
  return await epiCanManage(user)||await teamsAllowed(user,['qsse']);
}
