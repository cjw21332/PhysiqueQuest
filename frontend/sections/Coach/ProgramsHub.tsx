'use client';
import { useState } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { api, type CoachExercise, type SavedProgram } from '../../lib/api';
import { ATHLETES, HEALTH_PROGRAMS, SPLITS, type ProgramTemplate } from '../../lib/programCatalog';
import { formatLoad, formatRest, sessionMinutes, suggestFor, type TrainingContext } from '../../lib/programSuggest';
import { useSavedPrograms } from '../../hooks/useSavedPrograms';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import { useTrainingContext } from '../../hooks/useTrainingContext';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import ProgramBuilder from './ProgramBuilder';
import { noteToProgram } from '../../lib/noteProgram';
import { adaptProgram, dayToSession, newId, programExerciseCount, templateToProgram, weekdayShort } from './programModel';

// Detail screens keep ids, not computed programs, so equipment or profile changes re-render them live.
type Screen = { kind: 'hub' } | { kind: 'import' } | { kind: 'detail'; templateId?: string; program?: SavedProgram } | { kind: 'build'; draft: SavedProgram; isNew: boolean; from?: Screen };
const TEMPLATES = [...SPLITS, ...ATHLETES, ...HEALTH_PROGRAMS];
export const equipmentLabel = (equipment: string[] = []) => equipment.length ? equipment.join(', ') : 'Full gym';
const sourceLabel = { custom: 'Custom', split: 'Split', athlete: 'Athlete' } as const;
const initials = (name = '') => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();


function WeekDots({ days, label }: { days: (number | undefined)[]; label: string }) {
  return <span className="cq-weekdots" role="img" aria-label={label}>{weekdayShort.map((day, index) => <i key={day} className={days.includes(index) ? 'on' : ''} aria-hidden="true">{day[0]}</i>)}</span>;
}

export default function ProgramsHub({ profile, onStart, onOpenPlan }: { profile: Profile; onStart: (exercises: CoachExercise[], title: string) => void; onOpenPlan: () => void }) {
  const ctx = useTrainingContext(profile);
  const { programs, loading, error, refresh } = useSavedPrograms();
  const { plan } = useCoachPlan();
  const [screen, setScreen] = useState<Screen>({ kind: 'hub' });
  const [filter, setFilter] = useState('All');
  const [notice, setNotice] = useState('');
  const openTemplate = (template: ProgramTemplate) => { setNotice(''); setScreen({ kind: 'detail', templateId: template.id }); };
  const create = () => setScreen({ kind: 'build', isNew: true, draft: { id: newId('prog'), name: '', source: 'custom', days: [{ id: newId('day'), title: 'Day 1', exercises: [] }] } });

  if (screen.kind === 'import') return <NoteImport trainingDays={profile.days ?? []} onCancel={() => setScreen({ kind: 'hub' })} onReady={draft => setScreen({ kind: 'build', isNew: true, draft, from: { kind: 'import' } })}/>;
  if (screen.kind === 'build') return <ProgramBuilder ctx={ctx} initial={screen.draft} isNew={screen.isNew} onCancel={() => setScreen(screen.from ?? { kind: 'hub' })} onSaved={saved => { setNotice(`${saved.name} saved to My programs.`); setScreen({ kind: 'detail', program: saved }); }}/>;
  if (screen.kind === 'detail') {
    const template = TEMPLATES.find(item => item.id === screen.templateId);
    // Templates are stored in their full-gym form; the equipment fit is applied on every render.
    const base = template ? templateToProgram(template, ctx) : programs.find(item => item.id === screen.program?.id) ?? screen.program;
    if (base) {
      const { program, swaps } = adaptProgram(base, profile.equipment, ctx);
      return <ProgramDetail key={base.id} program={program} base={base} swaps={swaps} equipment={equipmentLabel(profile.equipment)} template={template} ctx={ctx} owned={!template} notice={notice}
        onBack={() => { setNotice(''); setScreen({ kind: 'hub' }); }}
        onStart={onStart}
        onEdit={() => setScreen({ kind: 'build', isNew: !!template, draft: template ? { ...program, id: newId('prog'), days: program.days.map(day => ({ ...day, id: newId('day') })) } : program, from: screen })}
        onDeleted={() => { setNotice(''); setScreen({ kind: 'hub' }); }}/>;
    }
  }

  const filters = ['All', '6', '5', '4', '3', '2'];
  const splits = SPLITS.filter(item => filter === 'All' || item.daysPerWeek.split('-').includes(filter));
  const healthLabels = new Set([...(profile.conditions ?? []), ...(profile.injuries ?? []), ...(profile.healthRisks ?? [])]);
  const matchesHealth = (item: ProgramTemplate) => item.forConditions?.some(label => healthLabels.has(label)) ?? false;
  const healthPrograms = [...HEALTH_PROGRAMS].sort((a, b) => Number(matchesHealth(b)) - Number(matchesHealth(a)));
  return <div className="cq-programs">
    <button type="button" className="cq-create" onClick={create}>
      <span className="cq-create-icon" aria-hidden="true"><Icon name="plus" size={22}/></span>
      <span><strong>Create a program</strong><small>Pick exercises, sets, reps, weight and rest for every day.</small></span>
      <Icon name="arrow" size={16}/>
    </button>
    <button type="button" className="cq-create cq-import-card" onClick={() => { setNotice(''); setScreen({ kind: 'import' }); }}>
      <span className="cq-create-icon" aria-hidden="true"><Icon name="clipboard" size={22}/></span>
      <span><strong>Import from notes</strong><small>Paste a workout note; days, sets, reps and weights are filled in for you to review.</small></span>
      <Icon name="arrow" size={16}/>
    </button>

    {plan && <section className="cq-block" aria-labelledby="cq-plan-heading">
      <h3 id="cq-plan-heading" className="cq-block-title">Your PhysiqueQuest plan</h3>
      <button type="button" className="cq-plan-card" onClick={onOpenPlan}>
        <span className="cq-plan-badge"><Icon name="coach-wand" size={18}/></span>
        <span><strong>Your adaptive weekly plan</strong><small>{plan.goal || profile.goal || 'General fitness'} · {plan.sessionCount} sessions a week · {plan.duration}</small></span>
        <WeekDots days={plan.days.filter(day => day.isWorkoutDay).map(day => day.index)} label={`${plan.sessionCount} training days`}/>
      </button>
    </section>}

    <section className="cq-block" aria-labelledby="cq-mine-heading">
      <div className="cq-block-head"><h3 id="cq-mine-heading" className="cq-block-title">My programs</h3>{programs.length > 0 && <span className="cq-count">{programs.length}</span>}</div>
      {loading && <div className="cq-skeleton" role="status" aria-label="Loading your programs"/>}
      {error && !loading && <p className="cq-inline-error" role="alert">Could not load your programs. <button type="button" onClick={() => void refresh()}>Retry</button></p>}
      {!loading && !error && !programs.length && <p className="cq-empty">No saved programs yet. Create your own or save one of the programs below.</p>}
      <div className="cq-list">{programs.map(program => { const adapted = adaptProgram(program, profile.equipment, ctx).swaps.length > 0; return <button type="button" key={program.id} className="cq-program-row" onClick={() => { setNotice(''); setScreen({ kind: 'detail', program }); }}>
        <span className={`cq-avatar ${program.source}`} aria-hidden="true">{initials(program.name)}</span>
        <span className="cq-row-copy"><strong>{program.name}</strong><small>{program.days.length} {program.days.length === 1 ? 'day' : 'days'} · {programExerciseCount(program)} exercises · {sourceLabel[program.source]}</small>{adapted && <span className="cq-pill">Adapted to your equipment</span>}</span>
        <Icon name="arrow" size={16}/>
      </button>; })}</div>
    </section>

    <section className="cq-block" aria-labelledby="cq-split-heading">
      <h3 id="cq-split-heading" className="cq-block-title">Training splits</h3>
      <p className="cq-equipment-note"><Icon name="dumbbell" size={14}/><span>Matched to your equipment: <b>{equipmentLabel(profile.equipment)}</b>. Change it in Me › Training preferences and these update automatically.</span></p>
      <div className="cq-chips" role="group" aria-label="Filter splits by days per week">{filters.map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'All' ? 'All' : `${value} days`}</button>)}</div>
      <div className="cq-list">{splits.map(split => <button type="button" key={split.id} className="cq-split-card" onClick={() => openTemplate(split)}>
        <span className="cq-split-days" aria-hidden="true"><b>{split.daysPerWeek}</b><small>days</small></span>
        <span className="cq-row-copy"><strong>{split.name}</strong><small>{split.summary}</small><WeekDots days={split.days.map(day => day.weekday)} label={`Trains ${split.days.map(day => weekdayShort[day.weekday]).join(', ')}`}/></span>
        <Icon name="arrow" size={16}/>
      </button>)}</div>
    </section>

    <section className="cq-block" aria-labelledby="cq-health-heading">
      <h3 id="cq-health-heading" className="cq-block-title">For injuries &amp; conditions</h3>
      <div className="cq-list">{healthPrograms.map(item => <button type="button" key={item.id} className="cq-split-card" onClick={() => openTemplate(item)}>
        <span className="cq-split-days" aria-hidden="true"><b>{item.daysPerWeek}</b><small>days</small></span>
        <span className="cq-row-copy"><strong>{item.name}</strong><small>{item.tag} · {item.summary}</small>{matchesHealth(item) && <span className="cq-pill">Matches your health profile</span>}</span>
        <Icon name="arrow" size={16}/>
      </button>)}</div>
      <p className="cq-fineprint">General exercise guidance, not treatment. Ask your doctor or physiotherapist before starting, and stop any exercise that causes pain.</p>
    </section>

    <section className="cq-block" aria-labelledby="cq-athlete-heading">
      <div className="cq-block-head"><h3 id="cq-athlete-heading" className="cq-block-title">Athlete programs</h3><span className="cq-hint">Inspired by</span></div>
      <div className="cq-carousel">{ATHLETES.map(item => <button type="button" key={item.id} className="cq-athlete-card" onClick={() => openTemplate(item)} aria-label={`${item.name}, inspired by ${item.athlete}, ${item.daysPerWeek} days a week`}>
        <span className="cq-athlete-mono" aria-hidden="true">{initials(item.athlete)}</span>
        <small className="cq-athlete-tag">{item.tag}</small>
        <strong>{item.athlete}</strong>
        <span className="cq-athlete-name">{item.name}</span>
        <span className="cq-athlete-meta">{item.daysPerWeek} days / week</span>
      </button>)}</div>
      <p className="cq-fineprint">Built from publicly described training styles. Not affiliated with or endorsed by these athletes.</p>
    </section>
  </div>;
}

function ProgramDetail({ program, base, swaps, equipment, template, ctx, owned, notice, onBack, onStart, onEdit, onDeleted }: { program: SavedProgram; base: SavedProgram; swaps: { from: string; to: string }[]; equipment: string; template?: ProgramTemplate; ctx: TrainingContext; owned: boolean; notice: string; onBack: () => void; onStart: (exercises: CoachExercise[], title: string) => void; onEdit: () => void; onDeleted: () => void }) {
  const today = (new Date().getDay() + 6) % 7;
  const [dayIndex, setDayIndex] = useState(() => Math.max(0, program.days.findIndex(day => day.weekday === today)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(notice);
  const [deleting, setDeleting] = useState(false);
  const day = program.days[Math.min(dayIndex, program.days.length - 1)];
  const rows = day.exercises.map(row => ({ row, hint: suggestFor(row, ctx, template?.style) }));
  const minutes = sessionMinutes(day.exercises);
  const basis = rows.some(item => item.hint.basis === 'history') ? 'Weights use your logged best sets where available.' : 'Starting weights are estimated from your age, sex, body weight, height, goal and activity level, and kept light on purpose. They update once you log sets.';
  const save = async () => {
    setBusy(true); setError('');
    try { await api.saveProgram({ ...base, id: newId('prog') }); setSaved(`${program.name} saved to My programs.`); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save this program.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError('');
    try { await api.deleteProgram(program.id); onDeleted(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete this program.'); setDeleting(false); }
    finally { setBusy(false); }
  };
  return <div className="cq-detail">
    <header className="cq-subheader"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to programs"><Icon name="arrow-left" size={22}/></button><span>Programs</span></header>
    <section className="cq-detail-hero">
      <div className="cq-detail-tags"><span className={`cq-tag ${program.source}`}>{template?.athlete ? `Inspired by ${template.athlete}` : sourceLabel[program.source]}</span>{template && <span className="cq-tag muted">{template.daysPerWeek} days / week</span>}</div>
      <h2>{program.name}</h2>
      {(template?.detail || program.notes) && <p>{template?.detail || program.notes}</p>}
    </section>
    {program.source !== 'athlete' && <details className="cq-adapt" open={swaps.length > 0 && swaps.length <= 3}>
      <summary><Icon name="dumbbell" size={14}/>{swaps.length ? `Adapted to your equipment · ${swaps.length} ${swaps.length === 1 ? 'swap' : 'swaps'}` : 'Fits your equipment'}<span>{equipment}</span></summary>
      {swaps.length ? <ul>{swaps.map(item => <li key={item.from}><s>{item.from}</s> → <b>{item.to}</b></li>)}</ul> : <p>Every exercise works with what you have.</p>}
      <p>Swaps keep the same muscle and movement pattern, and loads are re-suggested for the new exercise. Updates automatically when you change your equipment.</p>
    </details>}
    <div className="cq-daytabs" role="tablist" aria-label="Program days">{program.days.map((item, index) => <button type="button" role="tab" key={item.id} aria-selected={index === dayIndex} onClick={() => setDayIndex(index)}><small>{item.weekday === undefined ? `Day ${index + 1}` : weekdayShort[item.weekday]}</small>{item.title}</button>)}</div>
    <div className="cq-day-meta" role="tabpanel" aria-label={day.title}>
      <span><Icon name="dumbbell" size={14}/>{day.exercises.length} exercises</span>
      <span><Icon name="clock" size={14}/>≈ {minutes} min</span>
      <span><Icon name="target" size={14}/>{day.exercises.reduce((sum, item) => sum + item.sets, 0)} sets</span>
    </div>
    <ol className="cq-exercises">{rows.map(({ row, hint }, index) => {
      const reps = row.reps || hint.reps, weight = row.weight ?? hint.weight;
      return <li key={row.exerciseId} className="cq-exercise">
        <span className="cq-ex-num" aria-hidden="true">{index + 1}</span>
        <div className="cq-ex-body">
          <strong>{row.name}</strong>
          <small>{[row.targetMuscle, row.equipment].filter(Boolean).join(' · ')}</small>
          <dl className="cq-ex-stats">
            <div><dt>Sets</dt><dd>{row.sets}</dd></div>
            <div><dt>Reps</dt><dd>{reps}{!row.reps && <em>suggested</em>}</dd></div>
            <div><dt>Weight</dt><dd>{formatLoad({ weight, unit: row.weight !== undefined ? row.unit : hint.unit, perHand: hint.perHand })}{row.weight === undefined && weight !== undefined && <em>suggested</em>}</dd></div>
            <div><dt>Rest</dt><dd>{formatRest(row.restSets)}<em>{formatRest(row.restNext)} after</em></dd></div>
          </dl>
        </div>
      </li>;
    })}</ol>
    {!day.exercises.length && <p className="cq-empty">No exercises on this day yet.</p>}
    <aside className="cq-note"><Icon name="lightbulb" size={16}/><p>{basis} Stop 2–3 reps short of failure on the first sessions and add weight once you hit the top of the rep range.</p></aside>
    {template?.athlete && <p className="cq-fineprint">Inspired by {template.athlete}&apos;s publicly described training style. Exercise selection, sets and loads are PhysiqueQuest suggestions for you, not the athlete&apos;s own program.</p>}
    {saved && <p className="cq-success" role="status">{saved}</p>}
    {error && <p className="cq-inline-error" role="alert">{error}</p>}
    <div className="cq-actions">
      <button type="button" className="primary cq-start" disabled={!day.exercises.length || day.exercises.length > 50} onClick={() => onStart(dayToSession(day), `${program.name} · ${day.title}`.slice(0, 80))}><Icon name="play" size={18}/>Start {day.title}</button>
      <div className="cq-actions-row">
        {owned ? <>
          <button type="button" className="secondary" onClick={onEdit} disabled={busy}><Icon name="edit" size={16}/>Edit</button>
          <button type="button" className="secondary danger" onClick={() => setDeleting(true)} disabled={busy}><Icon name="trash" size={16}/>Delete</button>
        </> : <>
          <button type="button" className="secondary" onClick={() => void save()} disabled={busy || Boolean(saved)}><Icon name="plus" size={16}/>{saved ? 'Saved' : busy ? 'Saving…' : 'Save program'}</button>
          <button type="button" className="secondary" onClick={onEdit} disabled={busy}><Icon name="edit" size={16}/>Customize</button>
        </>}
      </div>
    </div>
    {deleting && <DeleteConfirmation title="Delete this program?" description={`${program.name} will be removed from My programs. Logged workouts are kept.`} confirmLabel="Delete program" busy={busy} error={error} onCancel={() => setDeleting(false)} onConfirm={() => void remove()}/>}
  </div>;
}

/** Paste a workout note, then review the parsed program in the normal Program builder before saving. */
function NoteImport({ trainingDays, onCancel, onReady }: { trainingDays: string[]; onCancel: () => void; onReady: (draft: SavedProgram) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const next = () => {
    const draft = noteToProgram(text, newId('prog'), () => newId('day'), trainingDays);
    if (!draft) { setError('No exercises found. Number each exercise (for example "1. Bench Press") and list working sets like "20 kg x 8".'); return; }
    onReady(draft);
  };
  return <div className="cq-programs cq-import">
    <header className="cq-import-head"><button type="button" className="coach-back" onClick={onCancel} aria-label="Back to programs"><Icon name="arrow" size={20}/></button><h2>Import from notes</h2></header>
    <p className="cq-import-intro">Paste your workout note. Day headings (Push day, Leg day, Upper day), numbered exercises and working sets such as <b>20 kg x 8</b> or <b>Bar + 25 kg x 10</b> become a program. Warm-up sets are skipped; each exercise uses your heaviest working weight. You can edit everything before saving.</p>
    <label className="cq-import-field"><span>Workout note</span><textarea value={text} maxLength={20000} rows={12} onChange={event => { setText(event.target.value); setError(''); }} placeholder={'PUSH DAY\n1. Smith Machine Bench Press\nWorking set:\nBar + 25 kg x 8\nBar + 25 kg x 10'}/></label>
    {error && <p className="cq-inline-error" role="alert">{error}</p>}
    <button type="button" className="cq-import-next" disabled={!text.trim()} onClick={next}>Review program <Icon name="arrow" size={16}/></button>
  </div>;
}
