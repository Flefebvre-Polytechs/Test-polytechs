'use client';

import { useRef, useState } from 'react';
import { BookOpen, ClipboardList, Search, ShieldCheck, Ticket, UserRound, X } from 'lucide-react';
import { AccountGate } from '@/components/account-gate';
import { HubFrame } from '@/components/hub-layout';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { guideAccessNotes, guideGroups, matchingGuides, type Guide, type GuideAccess } from './guides';
import './help.css';

const groupIcons = { tickets: Ticket, documents: ClipboardList, terrain: ShieldCheck, profile: UserRound };

function GuideCard({ guide, access }: { guide: Guide; access: Record<GuideAccess, boolean> }) {
  const Icon = groupIcons[guide.group];
  const restriction = guide.link?.access;
  const canOpen = !restriction || access[restriction];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="help-guide-card" type="button" data-group={guide.group}>
          <span className="help-guide-icon"><Icon size={20} aria-hidden="true" /></span>
          <span>
            <strong>{guide.title}</strong>
            <span className="help-guide-summary">{guide.summary}</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="help-guide-dialog" lang="fr" data-no-translate showCloseButton={false}>
        <header className="help-guide-header" data-group={guide.group}>
          <span className="help-guide-icon"><Icon size={22} aria-hidden="true" /></span>
          <div>
            <DialogTitle>{guide.title}</DialogTitle>
            <DialogDescription>{guide.summary}</DialogDescription>
          </div>
          <DialogClose asChild>
            <button className="help-icon-button" type="button" aria-label="Fermer le guide"><X size={18} aria-hidden="true" /></button>
          </DialogClose>
        </header>
        <ol className="help-steps">
          {guide.steps.map(step => <li key={step}>{step}</li>)}
        </ol>
        <footer className="help-guide-footer">
          {restriction && !canOpen && <p>{guideAccessNotes[restriction]}</p>}
          {guide.link && canOpen ? (
            <a className="help-primary" href={guide.link.href}>{guide.link.label}</a>
          ) : (
            <DialogClose asChild><button type="button" className="outline">Fermer</button></DialogClose>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function HelpLibrary({ access }: { access: Record<GuideAccess, boolean> }) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<Guide['group'] | 'all'>('all');
  const input = useRef<HTMLInputElement>(null);
  const matches = matchingGuides(search, group);

  return (
    <div className="help-library" lang="fr" data-no-translate>
      <header className="help-hero">
        <div>
          <h1>Aide et guides</h1>
          <p>Choisissez une action pour voir les étapes et accéder au bon écran.</p>
          <div className="help-search">
            <Search size={21} aria-hidden="true" />
            <input
              ref={input}
              type="search"
              aria-label="Rechercher une action"
              placeholder="Rechercher une action…"
              maxLength={120}
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            {search && (
              <button className="help-icon-button" type="button" aria-label="Effacer la recherche" onClick={() => { setSearch(''); input.current?.focus(); }}>
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="help-hero-icon" aria-hidden="true"><BookOpen size={50} strokeWidth={1.5} /></div>
      </header>

      <div className="help-filters">
        <div className="help-topics" role="group" aria-label="Filtrer les guides par thème">
          <button type="button" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>Tous les guides</button>
          {guideGroups.map(topic => (
            <button key={topic.id} type="button" aria-pressed={group === topic.id} onClick={() => setGroup(topic.id)}>
              {topic.label}
            </button>
          ))}
        </div>
        <span className="help-result-count" role="status">{matches.length} {matches.length === 1 ? 'guide' : 'guides'}</span>
      </div>

      {matches.length === 0 ? (
        <div className="help-empty">
          <Search size={25} aria-hidden="true" />
          <h2>Aucun guide trouvé</h2>
          <p>Essayez « ticket », « audit » ou « EPI », ou sélectionnez tous les guides.</p>
          <button className="outline" type="button" onClick={() => { setSearch(''); setGroup('all'); input.current?.focus(); }}>Réinitialiser les filtres</button>
        </div>
      ) : guideGroups.map(topic => {
        const items = matches.filter(guide => guide.group === topic.id);
        if (!items.length) return null;
        return (
          <section className="help-group" key={topic.id} aria-labelledby={'help-' + topic.id}>
            <h2 id={'help-' + topic.id}>{topic.label}</h2>
            <div className="help-guide-grid">
              {items.map(guide => <GuideCard key={guide.id} guide={guide} access={access} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function HelpPage() {
  return (
    <AccountGate>{account => (
      <HubFrame active="Aide" teamId="" className="help-workspace">
        {directory => {
          const admin = account.role === 'admin';
          const qsse = admin || !!directory?.teams.some(team => team.id === 'qsse');
          return (
            <HelpLibrary access={{
              create: admin || account.role === 'editor' && !!directory?.editableTeams?.length,
              qsse,
              epi: qsse || !!directory?.epiManager,
            }} />
          );
        }}
      </HubFrame>
    )}</AccountGate>
  );
}
