'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { ClipboardList, Cog, Leaf, Package, Pencil, Plus, Users, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ticketAnalysisMethods, ticketIshikawaFamilies } from '@/lib/hub';
import '@/app/tickets/ishikawa.css';

type Family = typeof ticketIshikawaFamilies[number];
const familyIcons = {
  methodes: ClipboardList,
  milieu: Leaf,
  materiel: Cog,
  matieres: Package,
  main_oeuvre: Users,
} satisfies Record<Family[0], LucideIcon>;
const conclusionLabel = ticketAnalysisMethods.ishikawa.fields.at(-1)![1];

export function TicketIshikawa({ problem, values, readOnly, disabled, onChange }: {
  problem: string;
  values: Record<string, string>;
  readOnly: boolean;
  disabled: boolean;
  onChange: (values: Record<string, string>) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [editor, setEditor] = useState<{ family: Family; text: string } | null>(null);

  function openFamily(family: Family, button: HTMLButtonElement) {
    trigger.current = button;
    setEditor({ family, text: values[family[0]] ?? '' });
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || disabled || readOnly) return;
    const [key] = editor.family;
    if (editor.text !== (values[key] ?? '')) onChange({ ...values, [key]: editor.text });
    setEditor(null);
  }

  return (
    <div className="ticket-ishikawa">
      <div className="ticket-ishikawa-board" role="group" aria-label="Diagramme d’Ishikawa">
        <div className="ticket-ishikawa-problem">
          <span>Problème</span>
          <strong data-no-translate={problem.trim() ? '' : undefined}>{problem.trim() || 'Titre du ticket à renseigner'}</strong>
        </div>
        <div className="ticket-ishikawa-spine" aria-hidden="true" />
        {ticketIshikawaFamilies.map(family => {
          const [key, label] = family;
          const Icon = familyIcons[key];
          const causes = (values[key] ?? '').split(/\r\n?|\n/).map(line => line.trim()).filter(Boolean);
          const EditIcon = causes.length ? Pencil : Plus;
          return (
            <section className="ticket-ishikawa-family" key={key} data-family={key} aria-label={label}>
              <button className="ticket-ishikawa-family-button" type="button" aria-haspopup="dialog"
                disabled={disabled} onClick={event => openFamily(family, event.currentTarget)}>
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
                {!readOnly && <EditIcon size={13} aria-hidden="true" />}
              </button>
              <div className="ticket-ishikawa-rib" data-empty={!causes.length}>
                {!!causes.length && <ul className="ticket-ishikawa-causes">
                  {causes.map((cause, index) => <li key={index} data-no-translate>{cause}</li>)}
                </ul>}
              </div>
            </section>
          );
        })}
      </div>
      <div className="ticket-ishikawa-conclusion">
        <label htmlFor={id + '-conclusion'}>{conclusionLabel}</label>
        <textarea id={id + '-conclusion'} rows={2} maxLength={3000} value={values.cause ?? ''}
          readOnly={readOnly} disabled={disabled} onChange={event => onChange({ ...values, cause: event.target.value })} />
      </div>
      <Dialog open={!!editor} onOpenChange={open => { if (!open) setEditor(null); }}>
        <DialogContent className="ticket-ishikawa-dialog" showCloseButton={false}
          onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
          {editor && <>
            <DialogTitle>{editor.family[1]}</DialogTitle>
            <DialogDescription>{readOnly ? 'Causes de cette famille' : 'Écris une cause par ligne.'}</DialogDescription>
            <form onSubmit={apply}>
              <textarea aria-label={'Causes · ' + editor.family[1]} rows={5} maxLength={3000}
                readOnly={readOnly} disabled={disabled} value={editor.text}
                placeholder={readOnly ? 'Aucune cause renseignée' : 'Saisir les causes…'}
                onChange={event => setEditor({ ...editor, text: event.target.value })} />
              <footer>
                <button className="outline" type="button" onClick={() => setEditor(null)}>{readOnly ? 'Fermer' : 'Annuler'}</button>
                {!readOnly && <button className="primary" type="submit" disabled={disabled}>Appliquer</button>}
              </footer>
            </form>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
