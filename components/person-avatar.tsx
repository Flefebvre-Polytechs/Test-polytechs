"use client";
import {Avatar,AvatarImage,AvatarFallback} from '@/components/ui/avatar';
/** Profile photos are read through the authenticated directory, never public storage URLs. */
export function PersonAvatar({id,name,size=28,version}:{id?:string;name:string;size?:number;version?:string|null}){
 const initials=name.trim().split(/\s+/).slice(0,2).map(word=>word[0]?.toLocaleUpperCase('fr')).join('')||'?';
 return <Avatar aria-hidden="true" style={{width:size,height:size,flexShrink:0}}>
  {id&&<AvatarImage src={'/api/profile/photo?user='+encodeURIComponent(id)+(version?'&v='+encodeURIComponent(version):'')} alt="" style={{objectFit:'cover'}}/>}
  <AvatarFallback style={{background:'#eef2f6',color:'#496079',fontSize:11,fontWeight:600}}>{initials}</AvatarFallback>
 </Avatar>;
}
