'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Circle, Link2, Plus, Square, Unlink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useConfirmation } from '@/components/use-confirmation';
import {
  causeTreeLinksByEffect, causeTreeOutcomeId, causeTreeReachableFacts,
  maxCauseTreeFacts, maxCauseTreeLinks, maxCauseTreeText,
  type CauseTreeFact, type CauseTreeLink, type TicketCauseTree,
} from '@/lib/hub';
import '@/app/tickets/cause-tree.css';

const emptyTree: TicketCauseTree = { outcome: '', facts: [], links: [] };
const factKinds = { variation: 'Fait inhabituel', permanent: 'Fait permanent' } as const;

type Branch = {
  id: string;
  fact?: CauseTreeFact;
  link?: CauseTreeLink;
  reference: boolean;
  depth: number;
  children: Branch[];
};

type Editor = {
  mode: 'outcome' | 'add' | 'edit';
  effectId: string;
  antecedentId: string;
  text: string;
  kind: CauseTreeFact['kind'];
  uncertain: boolean;
};

export function TicketCauseTreeFields({ tree = emptyTree, problem, readOnly, disabled, onChange }: {
  tree?: TicketCauseTree;
  problem: string;
  readOnly: boolean;
  disabled: boolean;
  onChange: (tree: TicketCauseTree) => void;
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const outcomeButton = useRef<HTMLButtonElement>(null);
  const { askConfirm, confirmation } = useConfirmation();
  const locked = readOnly || disabled;
  const canAddFact = tree.facts.length < maxCauseTreeFacts;
  const canAddLink = tree.links.length < maxCauseTreeLinks;
  const outcome = tree.outcome.trim() || problem.trim();
  const byId = new Map(tree.facts.map(fact => [fact.id, fact]));
  const byEffect = causeTreeLinksByEffect(tree.links);
  const uses = new Map<string, number>();
  for (const { antecedentId } of tree.links) uses.set(antecedentId, (uses.get(antecedentId) ?? 0) + 1);

  // A shared fact has one full branch. Its other occurrences point to the same fact.
  const expanded = new Set<string>();
  let leaves = 0;
  function branch(id: string, link?: CauseTreeLink, depth = 0): Branch {
    const reference = expanded.has(id);
    expanded.add(id);
    const children = reference ? [] : (byEffect.get(id) ?? []).map(child => branch(child.antecedentId, child, depth + 1));
    if (!children.length) leaves++;
    return { id, fact: byId.get(id), link, reference, depth, children };
  }
  const root = branch(causeTreeOutcomeId);
  const existingFacts = editor?.mode === 'add' ? tree.facts.filter(fact =>
    !byEffect.get(editor.effectId)?.some(link => link.antecedentId === fact.id) &&
    !causeTreeReachableFacts(byEffect, fact.id).has(editor.effectId),
  ) : [];

  function editFact(node: Branch, button: HTMLButtonElement) {
    trigger.current = button;
    setEditor({
      mode: node.link ? 'edit' : 'outcome',
      effectId: node.link?.effectId ?? causeTreeOutcomeId,
      antecedentId: node.fact?.id ?? '',
      text: node.fact?.text ?? outcome,
      kind: node.fact?.kind ?? 'variation',
      uncertain: node.link?.uncertain ?? false,
    });
  }

  function add(effectId: string, button: HTMLButtonElement) {
    trigger.current = button;
    setEditor({ mode: 'add', effectId, antecedentId: '', text: '', kind: 'variation', uncertain: false });
  }

  function isEditedLink(link: CauseTreeLink, draft: Editor) {
    return link.antecedentId === draft.antecedentId && link.effectId === draft.effectId;
  }

  const hasText = !!editor?.text.trim();
  const canAddAntecedent = canAddLink && (editor?.antecedentId ?
    existingFacts.some(fact => fact.id === editor.antecedentId) : canAddFact && hasText);
  const canApply = !!editor && !locked && (editor.mode === 'add' ? canAddAntecedent : editor.mode === 'outcome' || hasText);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !canApply) return;
    const text = editor.text.trim();
    if (editor.mode === 'outcome') {
      const next = text === problem.trim() ? '' : text;
      if (next !== tree.outcome) onChange({ ...tree, outcome: next });
    } else if (editor.mode === 'edit') {
      onChange({
        ...tree,
        facts: tree.facts.map(fact => fact.id === editor.antecedentId ? { ...fact, text, kind: editor.kind } : fact),
        links: tree.links.map(link => isEditedLink(link, editor) ? { ...link, uncertain: editor.uncertain } : link),
      });
    } else {
      const antecedentId = editor.antecedentId || crypto.randomUUID();
      onChange({
        ...tree,
        facts: editor.antecedentId ? tree.facts : [...tree.facts, { id: antecedentId, text, kind: editor.kind }],
        links: [...tree.links, { antecedentId, effectId: editor.effectId, uncertain: editor.uncertain }],
      });
    }
    setEditor(null);
  }

  async function detach() {
    if (locked || editor?.mode !== 'edit') return;
    const links = tree.links.filter(link => !isEditedLink(link, editor));
    const reachable = causeTreeReachableFacts(causeTreeLinksByEffect(links), causeTreeOutcomeId);
    const facts = tree.facts.filter(fact => reachable.has(fact.id));
    const removed = tree.facts.length - facts.length;
    if (removed && !await askConfirm(
      removed === 1 ? 'Ce fait sera retiré de l’arbre.' : 'Ce lien et ' + removed + ' faits seront retirés de l’arbre.',
      { title: 'Détacher cet antécédent ?', confirmLabel: 'Détacher' },
    )) return;
    onChange({ ...tree, facts, links: links.filter(link => reachable.has(link.effectId)) });
    setEditor(null);
  }

  function render(node: Branch) {
    const { fact, children, reference } = node;
    const title = fact?.text ?? outcome;
    const FactIcon = fact?.kind === 'permanent' ? Square : Circle;
    return <div className="ticket-cause-node">
      <div className="ticket-cause-card" data-outcome={!fact} data-reference={reference}>
        <button type="button" className="ticket-cause-fact" ref={!fact ? outcomeButton : undefined}
          aria-haspopup="dialog" disabled={disabled} onClick={event => editFact(node, event.currentTarget)}>
          <span className="ticket-cause-kind">{fact ? <><FactIcon size={13} aria-hidden="true" />{factKinds[fact.kind]}</> : 'Fait final'}</span>
          <strong data-no-translate={title ? '' : undefined}>{title || 'Décrire le fait final'}</strong>
          {fact && (uses.get(fact.id) ?? 0) > 1 && <small><Link2 size={13} aria-hidden="true" /> Fait commun</small>}
          {node.link?.uncertain && <small className="ticket-cause-uncertain">Lien à vérifier</small>}
        </button>
        {!readOnly && !reference && <button type="button" className="ticket-cause-add" disabled={disabled || !canAddLink}
          aria-label={fact ? 'Ajouter un antécédent à « ' + title + ' »' : 'Ajouter un antécédent au fait final'}
          onClick={event => add(node.id, event.currentTarget)}>
          <Plus size={15} aria-hidden="true" /> Ajouter un antécédent
        </button>}
      </div>
      {!!children.length && <div className="ticket-cause-branches" data-deep={node.depth >= 6}>
        {children.length > 1 && <span className="ticket-cause-junction" title="Ces faits ont été nécessaires ensemble">ET</span>}
        <ul className="ticket-cause-children" role="list">
          {children.map(child => <li key={child.id} data-uncertain={child.link?.uncertain}>{render(child)}</li>)}
        </ul>
      </div>}
    </div>;
  }

  const effectText = editor?.effectId === causeTreeOutcomeId ? outcome : byId.get(editor?.effectId ?? '')?.text;
  return <div className="ticket-cause-tree">
    <div className="ticket-cause-board" role="group" aria-label="Arbre des causes" data-compact={leaves > 3}>{render(root)}</div>
    {!canAddLink && !readOnly && <p className="ticket-cause-limit">Limite de {maxCauseTreeLinks} liens atteinte.</p>}
    <Dialog open={!!editor} onOpenChange={open => { if (!open) setEditor(null); }}>
      <DialogContent className="ticket-cause-dialog" showCloseButton={false}
        onCloseAutoFocus={event => {
          event.preventDefault();
          (trigger.current?.isConnected ? trigger.current : outcomeButton.current)?.focus({ preventScroll: true });
        }}>
        {editor && <>
          <DialogTitle>{editor.mode === 'outcome' ? 'Fait final' : editor.mode === 'add' ? 'Ajouter un antécédent' : 'Fait antécédent'}</DialogTitle>
          <DialogDescription>
            {editor.mode === 'outcome' ? 'Dommage ou événement qui sert de point de départ à l’analyse.'
              : effectText ? <>Antécédent de « <span data-no-translate>{effectText}</span> »</> : 'Antécédent du fait final.'}
          </DialogDescription>
          <form onSubmit={save}>
            {editor.mode === 'add' && existingFacts.length > 0 && <label>
              Fait à relier
              <select value={editor.antecedentId} disabled={locked} onChange={event => setEditor({ ...editor, antecedentId: event.target.value })}>
                <option value="" disabled={!canAddFact}>{canAddFact ? 'Nouveau fait' : 'Choisir un fait existant'}</option>
                {existingFacts.map(fact => <option key={fact.id} value={fact.id} data-no-translate>{fact.text}</option>)}
              </select>
            </label>}
            {editor.mode === 'add' && !canAddFact && !editor.antecedentId &&
              <p className="ticket-cause-limit">Limite de {maxCauseTreeFacts} faits atteinte.</p>}
            {(editor.mode !== 'add' || !editor.antecedentId && canAddFact) && <>
              <label>
                {editor.mode === 'outcome' ? 'Description du fait final' : 'Fait observé'}
                <textarea rows={3} maxLength={maxCauseTreeText} value={editor.text} readOnly={readOnly} disabled={disabled}
                  placeholder={editor.mode === 'outcome' ? 'Titre du ticket' : 'Décrivez un fait concret…'}
                  onChange={event => setEditor({ ...editor, text: event.target.value })} />
              </label>
              {editor.mode !== 'outcome' && <label>
                Type de fait
                <select value={editor.kind} disabled={locked} onChange={event => setEditor({ ...editor, kind: event.target.value as CauseTreeFact['kind'] })}>
                  {Object.entries(factKinds).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
                </select>
              </label>}
            </>}
            {editor.mode !== 'outcome' && <label className="ticket-cause-check">
              <input type="checkbox" checked={editor.uncertain} disabled={locked}
                onChange={event => setEditor({ ...editor, uncertain: event.target.checked })} />
              Ce lien reste à vérifier
            </label>}
            <footer>
              {!readOnly && editor.mode === 'edit' && <button type="button" className="ticket-cause-detach"
                disabled={disabled} onClick={() => void detach()}>
                <Unlink size={15} aria-hidden="true" /> Détacher le lien
              </button>}
              <button type="button" className="outline" onClick={() => setEditor(null)}>{readOnly ? 'Fermer' : 'Annuler'}</button>
              {!readOnly && <button type="submit" className="primary" disabled={!canApply}>Appliquer</button>}
            </footer>
          </form>
        </>}
      </DialogContent>
    </Dialog>
    {confirmation}
  </div>;
}
