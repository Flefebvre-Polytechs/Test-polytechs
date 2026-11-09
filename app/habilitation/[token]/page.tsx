import type {Metadata} from 'next';
import {BadgeCheckView} from './verification-view';
export const metadata:Metadata={title:'Vérification des habilitations · Polytechs',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <BadgeCheckView token={token}/>;}
