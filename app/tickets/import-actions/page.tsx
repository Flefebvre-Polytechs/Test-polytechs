'use client';
import {UndoTicketImports} from '@/components/undo-ticket-imports';
import {AccountGate} from '@/components/account-gate';
import {HubFrame} from '@/components/hub-layout';
export default function Page(){
 return <AccountGate>{account=><HubFrame active="Tickets" teamId="">
  {account.role==='admin'?<section className="panel"><h1>Historique des imports de tickets</h1><a href="/tickets">Retour aux tickets</a><UndoTicketImports/></section>:<p role="alert">Historique réservé aux administrateurs globaux.</p>}
 </HubFrame>}</AccountGate>
}
