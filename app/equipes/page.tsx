'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Network, Pencil, Plus, Search, X } from 'lucide-react';
import { AccountGate } from '@/components/account-gate';
import { HubFrame, hubRequest } from '@/components/hub-layout';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useConfirmation } from '@/components/use-confirmation';
import { teamGroups, teamsInGroup, type Team, type TeamGroup } from '@/lib/team-organization';
import { teamVisual } from '@/lib/ticket-visuals';
import './organization.css';

type TeamDraft = {
  name: string;
  rank: number;
  parentId: string;
  group: TeamGroup;
  afterId: string;
};

function initialDraft(team: Team | null, teams: Team[]): TeamDraft {
  const parent = teams.find(item => item.id === 'direction' && item.rank === 1) ??
    teams.find(item => item.rank === 1);
  const group = team?.navigation_group ?? 'other';
  const groupTeams = teamsInGroup(teams, group);
  const position = team ? groupTeams.findIndex(item => item.id === team.id) : groupTeams.length;
  return {
    name: team?.name ?? '',
    rank: team?.rank ?? (parent ? 2 : 1),
    parentId: team ? team.parent_id ?? '' : parent?.id ?? '',
    group,
    afterId: groupTeams[position - 1]?.id ?? '',
  };
}

function TeamEditor({ team, teams, close, onSaved, restoreFocus }: {
  team: Team | null;
  teams: Team[];
  close: () => void;
  onSaved: (name: string, group: TeamGroup) => void;
  restoreFocus: () => void;
}) {
  const [initial] = useState(() => initialDraft(team, teams));
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { askConfirm, confirmation } = useConfirmation();
  const hasChildren = !!team && teams.some(item => item.parent_id === team.id);
  const parents = teams.filter(item => item.rank === 1 && item.id !== team?.id);
  const groupTeams = teamsInGroup(teams, draft.group).filter(item => item.id !== team?.id);
  const dirty = Object.keys(initial).some(key => initial[key as keyof TeamDraft] !== draft[key as keyof TeamDraft]);

  useEffect(() => {
    if (!dirty) return;
    function preventLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', preventLeave);
    return () => window.removeEventListener('beforeunload', preventLeave);
  }, [dirty]);

  function patch(fields: Partial<TeamDraft>) {
    setDraft(current => ({ ...current, ...fields }));
    setError('');
  }

  async function requestClose() {
    if (busy) return;
    if (!dirty || await askConfirm('Les modifications de cette équipe seront abandonnées.')) close();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await hubRequest('/api/dashboards', { action: 'team', id: team?.id, revision: team?.revision, ...draft });
      onSaved(draft.name.trim(), draft.group);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={open => { if (!open) void requestClose(); }}>
        <DialogContent
          className="team-editor-dialog"
          showCloseButton={false}
          onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}
        >
          <header className="team-editor-header">
            <div>
              <DialogTitle>{team ? 'Modifier l’équipe' : 'Ajouter un service'}</DialogTitle>
              <DialogDescription data-no-translate={team ? '' : undefined}>
                {team?.name ?? 'Renseignez sa place dans la barre latérale.'}
              </DialogDescription>
            </div>
            <button type="button" className="outline team-editor-close" aria-label="Fermer" disabled={busy} onClick={() => void requestClose()}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <form onSubmit={save}>
            <fieldset disabled={busy} className="team-editor-fields">
              <label className="team-editor-wide">Nom de l’équipe
                <input required maxLength={100} value={draft.name} onChange={event => patch({ name: event.target.value })} />
              </label>
              <label>Rang
                <select value={draft.rank} onChange={event => patch({ rank: Number(event.target.value) })}>
                  <option value={1}>Rang 1 · Direction</option>
                  <option value={2} disabled={hasChildren || !parents.length}>Rang 2 · Service</option>
                </select>
              </label>
              {draft.rank === 2 && (
                <label>Équipe de rattachement
                  <select required value={draft.parentId} onChange={event => patch({ parentId: event.target.value })}>
                    <option value="">Choisir une direction</option>
                    {parents.map(parent => <option key={parent.id} value={parent.id} data-no-translate>{parent.name}</option>)}
                  </select>
                </label>
              )}
              {hasChildren && <p className="team-editor-wide team-editor-hint">Réaffectez les services rattachés avant de modifier le rang de cette équipe.</p>}
              <label>Rubrique du menu
                <select value={draft.group} onChange={event => {
                  const group = event.target.value as TeamGroup;
                  patch({ group, afterId: teamsInGroup(teams, group).filter(item => item.id !== team?.id).at(-1)?.id ?? '' });
                }}>
                  {teamGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
              <label>Position dans la rubrique
                <select value={draft.afterId} onChange={event => patch({ afterId: event.target.value })}>
                  <option value="">En tête de rubrique</option>
                  {groupTeams.map(item => <option key={item.id} value={item.id} data-no-translate>{'Après ' + item.name}</option>)}
                </select>
              </label>
              {error && <p className="error team-editor-wide" role="alert">{error}</p>}
            </fieldset>
            <footer className="team-editor-footer">
              <button type="button" className="outline" disabled={busy} onClick={() => void requestClose()}>Annuler</button>
              <button className="primary" type="submit" disabled={busy || !draft.name.trim() || !!team && !dirty}>
                {busy ? 'Enregistrement…' : team ? 'Enregistrer' : 'Créer le service'}
              </button>
            </footer>
          </form>
        </DialogContent>
      </Dialog>
      {confirmation}
    </>
  );
}

const normalize = (name: string) => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');

function TeamDirectory({ teams, error, reload }: { teams: Team[] | undefined; error: string; reload: () => void }) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<TeamGroup | ''>('');
  const [editor, setEditor] = useState<{ team: Team | null } | null>(null);
  const [notice, setNotice] = useState('');
  const [linkError, setLinkError] = useState(false);
  const initialized = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!teams || initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.has('modifier')) {
      const team = teams.find(item => item.id === params.get('modifier'));
      if (team) setEditor({ team });
      else setLinkError(true);
    } else if (params.get('nouvelle') === '1') {
      setEditor({ team: null });
    }
  }, [teams]);

  const byId = new Map(teams?.map(team => [team.id, team]));
  const term = normalize(query.trim());
  const groups = teamGroups.map(group => ({
    ...group,
    teams: teamsInGroup(teams ?? [], group.id).filter(team =>
      (!section || section === group.id) &&
      normalize(team.name + ' ' + (byId.get(team.parent_id ?? '')?.name ?? '')).includes(term),
    ),
  }));
  const count = groups.reduce((total, group) => total + group.teams.length, 0);

  function openEditor(team: Team | null, button: HTMLButtonElement) {
    trigger.current = button;
    setNotice('');
    setLinkError(false);
    setEditor({ team });
  }

  function closeEditor() {
    setEditor(null);
    window.history.replaceState(null, '', '/equipes');
  }

  return (
    <section className="team-directory">
      <header className="team-directory-heading">
        <span className="team-directory-mark"><Network size={25} aria-hidden="true" /></span>
        <div>
          <h1>Équipes et services</h1>
          <p>Gérez les noms, les rattachements et l’ordre d’affichage dans la barre latérale.</p>
        </div>
        <button type="button" className="primary" disabled={!teams} onClick={event => openEditor(null, event.currentTarget)}>
          <Plus size={17} aria-hidden="true" /> Ajouter un service
        </button>
      </header>
      {notice && <p className="success" role="status" data-no-translate>{notice}</p>}
      {linkError && <p className="error" role="alert">Cette équipe est introuvable.</p>}
      {error && <div className="error team-directory-error" role="alert">{error}<button type="button" className="outline" onClick={reload}>Réessayer</button></div>}
      {!teams && !error && <p role="status">Chargement des équipes…</p>}
      {teams && (
        <>
          <div className="team-directory-filters">
            <label className="team-directory-search"><Search size={18} aria-hidden="true" />
              <input ref={search} type="search" aria-label="Rechercher une équipe" placeholder="Rechercher une équipe…" value={query} onChange={event => setQuery(event.target.value)} />
            </label>
            <label className="team-directory-select">
              <span className="sr-only">Filtrer par rubrique</span>
              <select value={section} onChange={event => setSection(event.target.value as TeamGroup | '')}>
                <option value="">Toutes les rubriques</option>
                {teamGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <span className="team-directory-count" role="status">{count} {count === 1 ? 'équipe' : 'équipes'}</span>
          </div>
          {count === 0 && <p className="team-directory-empty">Aucune équipe pour cette recherche.</p>}
          {groups.filter(group => group.teams.length).map(group => (
            <section key={group.id} className="team-directory-group" aria-labelledby={'directory-' + group.id}
              style={{ '--team-group-color': group.accent } as CSSProperties}>
              <h2 id={'directory-' + group.id}>{group.name}</h2>
              <ul>
                {group.teams.map(team => {
                  const Icon = teamVisual(team.id).Icon;
                  const parent = byId.get(team.parent_id ?? '');
                  return (
                    <li key={team.id} className="team-directory-row">
                      <div className="team-directory-identity">
                        <span className="team-directory-icon"><Icon size={19} aria-hidden="true" /></span>
                        <strong data-no-translate>{team.name}</strong>
                      </div>
                      <div className="team-directory-details">
                        <span>Rang {team.rank}</span>
                        {parent && <small data-no-translate>{parent.name}</small>}
                      </div>
                      <button type="button" className="outline team-directory-edit" aria-label={'Modifier l’équipe ' + team.name}
                        onClick={event => openEditor(team, event.currentTarget)}>
                        <Pencil size={15} aria-hidden="true" /> Modifier
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
      {editor && teams && (
        <TeamEditor team={editor.team} teams={teams} close={closeEditor}
          restoreFocus={() => (trigger.current?.isConnected ? trigger.current : search.current)?.focus()}
          onSaved={(name, group) => {
            setNotice(name + (editor.team ? ' · équipe mise à jour.' : ' · service créé.'));
            setQuery('');
            if (section) setSection(group);
            closeEditor();
            reload();
          }}
        />
      )}
    </section>
  );
}

export default function TeamsPage() {
  return (
    <AccountGate>{account => (
      <HubFrame active="Équipes et services" teamId="">
        {(directory, controls) => account.role === 'admin' ? (
          <TeamDirectory teams={directory?.teams} error={controls.error} reload={controls.reload} />
        ) : (
          <section className="panel">
            <h1>Accès réservé</h1>
            <p>L’organisation des équipes est réservée aux administrateurs globaux.</p>
            <a href="/unites">Retour aux tableaux de bord</a>
          </section>
        )}
      </HubFrame>
    )}</AccountGate>
  );
}
