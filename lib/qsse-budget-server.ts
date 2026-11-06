import {database} from '@/db/raw';
import type {Account} from '@/lib/access';
export async function budgetAccess(user:Account){const db=database();const member=!!await db.prepare("SELECT 1 FROM team_members WHERE user_id=? AND team_id='qsse'").bind(user.id).first();const manager=['editor','admin'].includes(user.role)&&!!await db.prepare("SELECT 1 FROM qsse_budget_owner o JOIN member_function_roles r ON r.user_id=o.user_id AND r.role='budget_manager' WHERE o.user_id=?").bind(user.id).first();return {read:user.role==='admin'||member||manager,write:manager};}
