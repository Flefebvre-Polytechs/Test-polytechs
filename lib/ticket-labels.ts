import {database} from '@/db/raw';
import type {Ticket,TicketLabel} from './hub';

export async function ticketLabelError(ticket:Ticket,previous?:Ticket){
 const topics=ticket.topicTags??[],locations=ticket.locationTags??[];
 if(!topics.length&&!locations.length)return '';
 const {results}=await database().prepare(`SELECT id,kind,category,deleted_at AS deletedAt
  FROM ticket_labels WHERE id IN (SELECT value FROM json_each(?))`)
  .bind(JSON.stringify([...topics,...locations])).all<Pick<TicketLabel,'id'|'kind'|'category'|'deletedAt'>>();
 const byId=new Map(results.map(label=>[label.id,label]));
 if(topics.some(id=>byId.get(id)?.kind!=='topic'||byId.get(id)?.category!==ticket.category))
  return 'Une étiquette de sujet ne correspond pas au thème du ticket. Vérifiez votre sélection.';
 if(locations.some(id=>byId.get(id)?.kind!=='location'))
  return 'Une étiquette de lieu est inconnue. Actualisez la liste.';
 const prior=new Set([...(previous?.topicTags??[]),...(previous?.locationTags??[])]);
 if(results.some(label=>label.deletedAt&&!prior.has(label.id)))
  return 'Une étiquette sélectionnée a été supprimée du catalogue. Retirez-la du ticket pour l’enregistrer.';
 return '';
}
