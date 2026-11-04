import {database} from '@/db/raw';
import type {Account} from './access';
export {functionRoles,type FunctionRole} from './function-role-labels';
import type {FunctionRole} from './function-role-labels';
export async function hasFunctionRole(user:Account,role:FunctionRole){if(role!=='cse_representative'&&!['editor','admin'].includes(user.role))return false;return !!await database().prepare('SELECT 1 FROM member_function_roles WHERE user_id=? AND role=?').bind(user.id,role).first()}
export async function pdpRoleAccess(user:Account){return user.role==='admin'||await hasFunctionRole(user,'pdp_manager')||await hasFunctionRole(user,'hsee_approver')||await hasFunctionRole(user,'cse_representative')}

export async function cseMembers(){return (await database().prepare("SELECT u.id,u.display_name FROM users u JOIN member_function_roles r ON r.user_id=u.id WHERE r.role='cse_representative'").all()).results as {id:string;display_name:string}[]}
