'use client';
import { useState } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { api, type CoachExercise, type ProgramDay, type SavedProgram } from '../../lib/api';
import { ATHLETES, HEALTH_PROGRAMS, SPLITS, type ProgramTemplate } from '../../lib/programCatalog';
import { formatLoad, formatRest, sessionMinutes, suggestFor, type TrainingContext } from '../../lib/programSuggest';
import { useSavedPrograms } from '../../hooks/useSavedPrograms';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import { useTrainingContext } from '../../hooks/useTrainingContext';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import ProgramBuilder from './ProgramBuilder';
import { noteToProgram } from '../../lib/noteProgram';
import { adaptProgram, dayToSession, newId, planExercises, programExerciseCount, programWeek, templateToProgram, weekPayload, weekdayLong, weekdayShort } from './programModel';

// Program screens keep ids, not computed programs, so equipment or profile changes re-render them live.
type Ref = { templateId?: string; program?: SavedProgram };
type Screen = { kind: 'hub' } | { kind: 'import' } | ({ kind: 'detail' } & Ref) | ({ kind: 'day'; dayId: string } & Ref) | { kind: 'build'; draft: SavedProgram; isNew: boolean; initialDay?: number; from?: Screen };
type StartFn = (exercises: CoachExercise[], title: string) => void;
const TEMPLATES = [...SPLITS, ...ATHLETES, ...HEALTH_PROGRAMS];
export const equipmentLabel = (equipment: string[] = []) => equipment.length ? equipment.join(', ') : 'Full gym';
const sourceLabel = { custom: 'Custom', split: 'Split', athlete: 'Athlete' } as const;
const pageLabel = (template?: ProgramTemplate, program?: SavedProgram) => template?.kind === 'athlete' ? 'Athlete program' : template && HEALTH_PROGRAMS.includes(template) ? 'Health program' : template ? 'Training split' : program?.source === 'custom' ? 'My program' : 'Saved program';
const initials = (name = '') => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
const setCount = (day: ProgramDay) => day.exercises.reduce((sum, item) => sum + item.sets, 0);
const muscles = (day: ProgramDay) => [...new Set(day.exercises.map(item => item.targetMuscle).filter(Boolean))].slice(0, 4).join(' · ');

function WeekDots({ days, label }: { days: (number | undefined)[]; label: string }) {
  return <span className="cq-weekdots" role="img" aria-label={label}>{weekdayShort.map((day, index) => <i key={day} className={days.includes(index) ? 'on' : ''} aria-hidden="true">{day[0]}</i>)}</span>;
}

function SubHeader({ title, backLabel, onBack, disabled }: { title: string; backLabel: string; onBack: () => void; disabled?: boolean }) {
  return <header className="cq-subheader pq-page-heading"><button type="button" className="coach-back" onClick={onBack} disabled={disabled} aria-label={backLabel}><Icon name="arrow" size={20}/></button><h2>{title}</h2></header>;
}

export default function ProgramsHub({ profile, onStart, onOpenPlan }: { profile: Profile; onStart: StartFn; onOpenPlan: () => void }) {
  const ctx = useTrainingContext(profile);
  const { programs, loading, error, refresh } = useSavedPrograms();
  const { plan } = useCoachPlan();
  const [screen, setScreen] = useState<Screen>({ kind: 'hub' });
  const [filter, setFilter] = useState('All');
  const [notice, setNotice] = useState('');
  const openTemplate = (template: ProgramTemplate) => { setNotice(''); setScreen({ kind: 'detail', templateId: template.id }); };
  const create = () => setScreen({ kind: 'build', isNew: true, draft: { id: newId('prog'), name: '', source: 'custom', days: [{ id: newId('day'), title: 'Day 1', exercises: [] }] } });

  if (screen.kind === 'import') return <NoteImport trainingDays={profile.days ?? []} onCancel={() => setScreen({ kind: 'hub' })} onReady={draft => setScreen({ kind: 'build', isNew: true, draft, from: { kind: 'import' } })}/>;
  if (screen.kind === 'build') return <ProgramBuilder ctx={ctx} initial={screen.draft} isNew={screen.isNew} initialDay={screen.initialDay} onCancel={() => setScreen(screen.from ?? { kind: 'hub' })} onSaved={saved => { setNotice(`${saved.name} saved to My programs.`); setScreen({ kind: 'detail', program: saved }); }}/>;
  if (screen.kind === 'detail' || screen.kind === 'day') {
    const template = TEMPLATES.find(item => item.id === screen.templateId);
    // Templates are stored in their full-gym form; the equipment fit is applied on every render.
    const base = template ? templateToProgram(template, ctx) : programs.find(item => item.id === screen.program?.id) ?? screen.program;
    if (base) {
      const { program, swaps } = adaptProgram(base, profile.equipment, ctx);
      const ref: Ref = template ? { templateId: template.id } : { program: base };
      const toOverview = () => { setNotice(''); setScreen({ kind: 'detail', ...ref }); };
      // Built-in programs are edited as your own copy; your programs are edited in place.
      const edit = (dayId?: string) => {
        const initialDay = Math.max(0, program.days.findIndex(day => day.id === dayId));
        setScreen({ kind: 'build', isNew: !!template, initialDay, from: screen, draft: template ? { ...program, id: newId('prog'), days: program.days.map(day => ({ ...day, id: newId('day') })) } : program });
      };
      const shared = { program, base, template, owned: !template, planVersion: plan?.programVersion, onStart, onEdit: edit };
      if (screen.kind === 'day') {
        const day = program.days.find(item => item.id === screen.dayId);
        if (day) return <ProgramDayView key={day.id} {...shared} day={day} ctx={ctx} onBack={toOverview} onSelect={dayId => setScreen({ kind: 'day', dayId, ...ref })} onOpenPlan={onOpenPlan} onDayDeleted={toOverview}/>;
      }
      return <ProgramOverview key={base.id} {...shared} swaps={swaps} equipment={equipmentLabel(profile.equipment)} notice={notice}
        onBack={() => { setNotice(''); setScreen({ kind: 'hub' }); }}
        onOpenDay={dayId => setScreen({ kind: 'day', dayId, ...ref })}
        onApplied={onOpenPlan}
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
        <span><strong>Your weekly plan</strong><small>{plan.goal || profile.goal || 'General fitness'} · {plan.sessionCount} sessions a week · {plan.duration}</small></span>
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
        <span className="cq-row-copy"><strong>{program.name}</strong><small>{program.days.length} {program.days.length === 1 ? 'day' : 'days'} · {programExerciseCount(program)} exercises · {sourceLabel[program.source]}</small><WeekDots days={programWeek(program).map(item => item.dayIndex)} label={`Trains ${programWeek(program).map(item => weekdayShort[item.dayIndex]).join(', ')}`}/>{adapted && <span className="cq-pill">Adapted to your equipment</span>}</span>
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

type Shared = { program: SavedProgram; base: SavedProgram; template?: ProgramTemplate; owned: boolean; planVersion?: string; onStart: StartFn; onEdit: (dayId?: string) => void };

/** Removes one day from your own program; the saved list refreshes from the response. */
function useDayDelete(base: SavedProgram, onDone: () => void) {
  const [target, setTarget] = useState<ProgramDay | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (!target) return;
    setBusy(true); setError('');
    try { await api.saveProgram({ ...base, days: base.days.filter(day => day.id !== target.id) }); setTarget(null); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete this day.'); }
    finally { setBusy(false); }
  };
  const canDelete = (day: ProgramDay) => base.days.length > 1 && base.days.some(item => item.id !== day.id && item.exercises.length);
  const dialog = target && <DeleteConfirmation title={`Delete ${target.title}?`} description={`${target.title} and its ${target.exercises.length} exercises are removed from this program. Logged workouts are kept.`} confirmLabel="Delete day" busy={busy} error={error} onCancel={() => { setTarget(null); setError(''); }} onConfirm={() => void confirm()}/>;
  return { ask: setTarget, canDelete, dialog };
}

/** Page 1: the whole split, one row per weekday, with actions per day and for the whole program. */
function ProgramOverview({ program, base, template, owned, planVersion, swaps, equipment, notice, onStart, onEdit, onBack, onOpenDay, onApplied, onDeleted }: Shared & { swaps: { from: string; to: string }[]; equipment: string; notice: string; onBack: () => void; onOpenDay: (dayId: string) => void; onApplied: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(notice);
  const [confirm, setConfirm] = useState<'apply' | 'delete' | null>(null);
  const week = programWeek(program);
  const byWeekday = new Map(week.map(item => [item.dayIndex, item.day]));
  const exercises = programExerciseCount(program);
  const avgMinutes = week.length ? Math.round(week.reduce((sum, item) => sum + sessionMinutes(item.day.exercises), 0) / week.length / 5) * 5 : 0;
  const dayDelete = useDayDelete(base, () => setSaved('Day deleted.'));
  const summary = week.map(item => `${weekdayShort[item.dayIndex]} ${item.day.title}`).join(', ');
  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true); setError('');
    try { await action(); return true; }
    catch (err) { setError(err instanceof Error ? err.message : fallback); return false; }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!planVersion) { setError('Your plan is still loading. Check your connection and try again.'); return; }
    if (await run(() => api.replaceCoachWeek({ programVersion: planVersion, days: weekPayload(program) }), 'Could not update your weekly plan.')) { setConfirm(null); onApplied(); }
  };
  const save = async () => { if (await run(() => api.saveProgram({ ...base, id: newId('prog') }), 'Could not save this program.')) setSaved(`${program.name} saved to My programs.`); };
  const remove = async () => { if (await run(() => api.deleteProgram(program.id), 'Could not delete this program.')) onDeleted(); else setConfirm(null); };

  return <div className="cq-detail cq-overview">
    <SubHeader title={pageLabel(template, program)} backLabel="Back to programs" onBack={onBack}/>
    <section className="cq-detail-hero">
      <div className="cq-detail-tags"><span className={`cq-tag ${program.source}`}>{template?.athlete ? `Inspired by ${template.athlete}` : sourceLabel[program.source]}</span>{template && <span className="cq-tag muted">{template.daysPerWeek} days / week</span>}</div>
      <h2>{program.name}</h2>
      {(template?.detail || program.notes) && <p>{template?.detail || program.notes}</p>}
      <dl className="cq-overview-stats">
        <div><dt>Training days</dt><dd>{week.length}</dd></div>
        <div><dt>Exercises</dt><dd>{exercises}</dd></div>
        <div><dt>Per session</dt><dd>≈ {avgMinutes} min</dd></div>
      </dl>
    </section>
    {program.source !== 'athlete' && <details className="cq-adapt" open={swaps.length > 0 && swaps.length <= 3}>
      <summary><Icon name="dumbbell" size={14}/>{swaps.length ? `Adapted to your equipment · ${swaps.length} ${swaps.length === 1 ? 'swap' : 'swaps'}` : 'Fits your equipment'}<span>{equipment}</span></summary>
      {swaps.length ? <ul>{swaps.map(item => <li key={item.from}><s>{item.from}</s> → <b>{item.to}</b></li>)}</ul> : <p>Every exercise works with what you have.</p>}
      <p>Swaps keep the same muscle and movement pattern, and loads are re-suggested for the new exercise. Updates automatically when you change your equipment.</p>
    </details>}

    <section className="cq-block" aria-labelledby="cq-week-heading">
      <div className="cq-block-head"><h3 id="cq-week-heading" className="cq-block-title">Your week</h3><span className="cq-hint">{week.length} training · {7 - week.length} rest</span></div>
      <ol className="cq-weeklist">{weekdayLong.map((name, index) => {
        const day = byWeekday.get(index);
        if (!day) return <li key={name} className="cq-weekrow is-rest"><span className="cq-weekrow-day" aria-hidden="true">{weekdayShort[index]}</span><span className="cq-weekrow-rest"><span className="visually-hidden">{name}: </span>Rest day</span></li>;
        return <li key={name} className="cq-weekrow">
          <button type="button" className="cq-weekrow-main" onClick={() => onOpenDay(day.id)} aria-label={`${name}: ${day.title}, ${day.exercises.length} exercises. Open day`}>
            <span className="cq-weekrow-day" aria-hidden="true">{weekdayShort[index]}</span>
            <span className="cq-row-copy"><strong>{day.title}</strong><small>{day.exercises.length} exercises · {setCount(day)} sets · ≈ {sessionMinutes(day.exercises)} min</small>{muscles(day) && <small className="cq-weekrow-muscles">{muscles(day)}</small>}</span>
            <Icon name="chevron-right" size={18}/>
          </button>
          <div className="cq-weekrow-actions">
            <button type="button" className="cq-chip-btn is-start" onClick={() => onStart(dayToSession(day), `${program.name} · ${day.title}`.slice(0, 80))} disabled={day.exercises.length > 50} aria-label={`Start ${day.title}`}><Icon name="play" size={14}/>Start</button>
            <button type="button" className="cq-chip-btn" onClick={() => onEdit(day.id)} aria-label={`Edit ${day.title}`}><Icon name="edit" size={14}/>Edit</button>
            {owned && <button type="button" className="cq-chip-btn is-danger" onClick={() => dayDelete.ask(day)} disabled={!dayDelete.canDelete(day)} aria-label={`Delete ${day.title}`}><Icon name="trash" size={14}/>Delete</button>}
          </div>
        </li>;
      })}</ol>
    </section>

    {template?.athlete && <p className="cq-fineprint">Inspired by {template.athlete}&apos;s publicly described training style. Exercise selection, sets and loads are PhysiqueQuest suggestions for you, not the athlete&apos;s own program.</p>}
    {saved && <p className="cq-success" role="status">{saved}</p>}
    {error && !confirm && <p className="cq-inline-error" role="alert">{error}</p>}
    <div className="cq-actions cq-overview-actions">
      <button type="button" className="primary cq-start" disabled={busy || !week.length} onClick={() => { setError(''); setConfirm('apply'); }}><Icon name="calendar" size={18}/>Use as my weekly plan</button>
      <p className="cq-fineprint">Replaces the workouts in your Today tab with this program. Logged workouts are kept.</p>
      {owned ? <button type="button" className="secondary danger cq-wide" onClick={() => { setError(''); setConfirm('delete'); }} disabled={busy}><Icon name="trash" size={16}/>Delete program</button>
        : <div className="cq-actions-row">
          <button type="button" className="secondary" onClick={() => void save()} disabled={busy || Boolean(saved)}><Icon name="plus" size={16}/>{saved ? 'Saved' : busy ? 'Saving…' : 'Save program'}</button>
          <button type="button" className="secondary" onClick={() => onEdit()} disabled={busy}><Icon name="edit" size={16}/>Customize</button>
        </div>}
    </div>
    {confirm === 'apply' && <DeleteConfirmation tone="primary" icon="calendar" title="Replace your weekly plan?" description={`Your Today tab will follow ${program.name}: ${summary}. Every other day becomes a rest day. Changing your goal, training days or equipment later builds a new plan.`} confirmLabel="Replace weekly plan" busyLabel="Updating…" busy={busy} error={error} onCancel={() => setConfirm(null)} onConfirm={() => void apply()}/>}
    {confirm === 'delete' && <DeleteConfirmation title="Delete this program?" description={`${program.name} will be removed from My programs. Logged workouts and your weekly plan are kept.`} confirmLabel="Delete program" busy={busy} error={error} onCancel={() => setConfirm(null)} onConfirm={() => void remove()}/>}
    {dayDelete.dialog}
  </div>;
}

/** Page 2: one training day with its exercises; start it, edit it, delete it or put it on your weekly plan. */
function ProgramDayView({ program, base, template, owned, planVersion, day, ctx, onStart, onEdit, onBack, onSelect, onOpenPlan, onDayDeleted }: Shared & { day: ProgramDay; ctx: TrainingContext; onBack: () => void; onSelect: (dayId: string) => void; onOpenPlan: () => void; onDayDeleted: () => void }) {
  const week = programWeek(program);
  const weekday = week.find(item => item.day.id === day.id)?.dayIndex ?? day.weekday ?? (new Date().getDay() + 6) % 7;
  const [target, setTarget] = useState(weekday);
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const dayDelete = useDayDelete(base, onDayDeleted);
  const rows = day.exercises.map(row => ({ row, hint: suggestFor(row, ctx, template?.style) }));
  const basis = rows.some(item => item.hint.basis === 'history') ? 'Weights use your logged best sets where available.' : 'Starting weights are estimated from your profile and kept light on purpose. They update once you log sets.';
  const apply = async () => {
    if (!planVersion) { setError('Your plan is still loading. Check your connection and try again.'); return; }
    setBusy(true); setError('');
    try { await api.updateCoachDay({ programVersion: planVersion, dayIndex: target, title: day.title.trim().slice(0, 80) || 'Workout', exercises: planExercises(day) }); setApplying(false); setDone(`${day.title} is now your ${weekdayLong[target]} workout.`); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update your plan.'); }
    finally { setBusy(false); }
  };

  return <div className="cq-detail cq-dayview">
    <SubHeader title={program.name} backLabel={`Back to ${program.name}`} onBack={onBack}/>
    {week.length > 1 && <div className="cq-daytabs" role="tablist" aria-label="Program days">{week.map(item => <button type="button" role="tab" key={item.day.id} aria-selected={item.day.id === day.id} onClick={() => onSelect(item.day.id)}><small>{weekdayShort[item.dayIndex]}</small>{item.day.title}</button>)}</div>}
    <section className="cq-day-hero">
      <p className="cq-day-eyebrow">{weekdayLong[weekday]}</p>
      <h2>{day.title}</h2>
      <div className="cq-day-meta">
        <span><Icon name="dumbbell" size={14}/>{day.exercises.length} exercises</span>
        <span><Icon name="clock" size={14}/>≈ {sessionMinutes(day.exercises)} min</span>
        <span><Icon name="target" size={14}/>{setCount(day)} sets</span>
      </div>
    </section>
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
            <div><dt>Weight</dt><dd>{formatLoad({ weight, unit: row.weight !== undefined ? row.unit : hint.unit, perHand: hint.perHand, base: row.weight !== undefined ? row.loadBase : undefined })}{row.weight === undefined && weight !== undefined && <em>suggested</em>}</dd></div>
            <div><dt>Rest</dt><dd>{formatRest(row.restSets)}<em>{formatRest(row.restNext)} after</em></dd></div>
          </dl>
        </div>
      </li>;
    })}</ol>
    {!day.exercises.length && <p className="cq-empty">No exercises on this day yet.</p>}
    <aside className="cq-note"><Icon name="lightbulb" size={16}/><p>{basis} Stop 2–3 reps short of failure on the first sessions and add weight once you hit the top of the rep range.</p></aside>
    {done && <p className="cq-success" role="status">{done} <button type="button" className="cq-link" onClick={onOpenPlan}>Open Today</button></p>}
    {error && !applying && <p className="cq-inline-error" role="alert">{error}</p>}
    <div className="cq-actions">
      <button type="button" className="primary cq-start" disabled={!day.exercises.length || day.exercises.length > 50} onClick={() => onStart(dayToSession(day), `${program.name} · ${day.title}`.slice(0, 80))}><Icon name="play" size={18}/>Start {day.title}</button>
      <button type="button" className="secondary cq-wide cq-tonal" disabled={!day.exercises.length || busy} onClick={() => { setError(''); setTarget(weekday); setApplying(true); }}><Icon name="calendar" size={16}/>Use for {weekdayLong[weekday]} in my plan</button>
      <div className={`cq-actions-row${owned ? '' : ' single'}`}>
        <button type="button" className="secondary" onClick={() => onEdit(day.id)} disabled={busy}><Icon name="edit" size={16}/>{owned ? 'Edit day' : 'Customize'}</button>
        {owned && <button type="button" className="secondary danger" onClick={() => dayDelete.ask(day)} disabled={busy || !dayDelete.canDelete(day)}><Icon name="trash" size={16}/>Delete day</button>}
      </div>
    </div>
    {applying && <DeleteConfirmation tone="primary" icon="calendar" title={`Use ${day.title} in your plan?`} description={`It replaces the ${weekdayLong[target]} workout in your Today tab. Your other days stay the same.`} confirmLabel={`Use on ${weekdayLong[target]}`} busyLabel="Updating…" busy={busy} error={error} onCancel={() => setApplying(false)} onConfirm={() => void apply()}>
      <div className="cq-weekday-pick" role="radiogroup" aria-label="Day of the week">{weekdayShort.map((name, index) => <button type="button" role="radio" key={name} aria-checked={target === index} aria-label={weekdayLong[index]} onClick={() => setTarget(index)} disabled={busy}>{name}</button>)}</div>
    </DeleteConfirmation>}
    {dayDelete.dialog}
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
    <SubHeader title="Import from notes" backLabel="Back to programs" onBack={onCancel}/>
    <p className="cq-import-intro">Paste your workout note. Day headings (Push day, Leg day, Upper day), numbered exercises and working sets such as <b>20 kg x 8</b> or <b>Bar + 25 kg x 10</b> become a program. Warm-up sets are skipped; each exercise uses your heaviest working weight. You can edit everything before saving.</p>
    <label className="cq-import-field"><span>Workout note</span><textarea value={text} maxLength={20000} rows={12} onChange={event => { setText(event.target.value); setError(''); }} placeholder={'PUSH DAY\n1. Smith Machine Bench Press\nWorking set:\nBar + 25 kg x 8\nBar + 25 kg x 10'}/></label>
    {error && <p className="cq-inline-error" role="alert">{error}</p>}
    <button type="button" className="cq-import-next" disabled={!text.trim()} onClick={next}>Review program <Icon name="arrow" size={16}/></button>
  </div>;
}
