import {database} from '@/db/raw';
import type {Account} from '@/lib/access';
export async function budgetAccess(user:Account){const db=database();const member=!!await db.prepare("SELECT 1 FROM team_members WHERE user_id=? AND team_id='qsse'").bind(user.id).first();const manager=['editor','admin'].includes(user.role)&&!!await db.prepare("SELECT 1 FROM member_function_roles WHERE role='budget_manager' AND user_id=?").bind(user.id).first();return {read:user.role==='admin'||member||manager,write:manager};}
