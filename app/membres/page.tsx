'use client';
import {AccountGate} from '@/components/account-gate';
import {GlobalMembersPanel} from '@/components/global-members-panel';
import {HubFrame} from '@/components/hub-layout';
export default function MembersPage(){return <AccountGate>{account=><HubFrame active="Membres" teamId="">{account.role==='admin'?<GlobalMembersPanel account={account}/>:<section className="panel"><h1>Accès réservé</h1><p>La gestion globale des membres est réservée aux administrateurs globaux.</p><a href="/unites">Retour aux tableaux de bord</a></section>}</HubFrame>}</AccountGate>}
