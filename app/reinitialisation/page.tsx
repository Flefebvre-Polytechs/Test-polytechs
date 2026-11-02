'use client';
import {AccountGate} from '@/components/account-gate';
export default function ResetPasswordPage(){return <AccountGate>{()=> <main className="login-page"><section className="login-card"><h1>Compte connecté</h1><a href="/">Ouvrir mon espace</a></section></main>}</AccountGate>}
