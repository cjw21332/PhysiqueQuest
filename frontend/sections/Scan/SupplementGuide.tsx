'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { CERTIFICATIONS, US_FDA_NOTE, supplementAudience, type Supplement, type SupplementCategory } from '../../lib/supplements';
import './supplement-guide.css';

type Filter = 'For you' | 'All' | SupplementCategory;
const CATEGORIES: SupplementCategory[] = ['Performance', 'Protein', 'Vitamins & minerals', 'Health & recovery'];
export default function SupplementGuide({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const audience = supplementAudience(profile);
  const [filter, setFilter] = useState<Filter>('For you');
  const [selected, setSelected] = useState<Supplement | null>(null);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); }, [selected]);

  const forYou = audience.ordered.filter(audience.fits);
  const shown = filter === 'For you' ? (forYou.length ? forYou : audience.ordered) : filter === 'All' ? audience.ordered : audience.ordered.filter(item => item.category === filter);

  if (selected) return <div className="diet-plan supp-guide" ref={top}>
    <header className="diet-header pq-page-heading"><button type="button" className="coach-back" onClick={() => setSelected(null)} aria-label="Back to supplement guide"><Icon name="arrow" size={20}/></button><h2>{selected.name}</h2></header>
    <SupplementDetail item={selected} minor={audience.minor} fits={audience.fits(selected)}/>
  </div>;

  return <div className="diet-plan supp-guide" ref={top}>
    <header className="diet-header pq-page-heading"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to Nutrition"><Icon name="arrow" size={20}/></button><h2>Supplement guide</h2></header>

    <section className="supp-hero" aria-labelledby="supp-hero-title">
      <span className="supp-hero-icon" aria-hidden="true"><Icon name="shield" size={22}/></span>
      <div><h2 id="supp-hero-title">Food first, supplements second</h2>
        <p>Supplements fill gaps your meals leave. Each entry shows the evidence, how to take it, its benefits and side effects, and which quality marks to look for.</p></div>
    </section>

    {audience.minor && <p className="supp-notice warn" role="note"><Icon name="warning" size={18}/><span><strong>You are under 18.</strong> Performance supplements such as creatine, caffeine and beta-alanine are not suggested for teenagers. Talk to a doctor or parent before taking any supplement.</span></p>}
    {audience.health.length > 0 && <p className="supp-notice warn" role="note"><Icon name="health" size={18}/><span><strong>You listed a health condition.</strong> Check every supplement with your doctor or pharmacist first, especially if you take regular medicine.</span></p>}
    {audience.over50 && <p className="supp-notice" role="note"><Icon name="lightbulb" size={18}/><span>From age 50, vitamin B12, vitamin D and calcium needs often change. Ask your doctor about a blood test.</span></p>}

    <details className="supp-certs">
      <summary><span className="supp-certs-title"><Icon name="shield" size={18}/><strong>How to check a product is safe</strong><Icon name="chevron-down" size={16}/></span><small>{CERTIFICATIONS.map(cert => cert.mark).join(' · ')}</small></summary>
      <p className="supp-fda">{US_FDA_NOTE.text} <a href={US_FDA_NOTE.url} target="_blank" rel="noreferrer">FDA guidance<span className="visually-hidden"> (opens in a new tab)</span></a></p>
      <ul>{CERTIFICATIONS.map(cert => <li key={cert.mark}>
        <strong><Icon name="check-circle" size={16}/>{cert.mark}</strong>
        <p>{cert.meaning}</p>
        <a href={cert.check.url} target="_blank" rel="noreferrer">{cert.check.label}<span className="visually-hidden"> (opens in a new tab)</span></a>
      </li>)}</ul>
    </details>

    <div className="supp-filters" role="group" aria-label="Filter supplements">
      {(['For you', 'All', ...CATEGORIES] as Filter[]).map(item => <button type="button" key={item} aria-pressed={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}
    </div>
    {filter === 'For you' && <p className="supp-filter-note">{forYou.length ? `Matched to your goal${profile.goal ? ` (${profile.goal})` : ''}${audience.over50 ? ' and age' : ''}.` : 'No close match for your profile yet, so all supplements are shown.'}</p>}

    <ul className="supp-list" aria-label="Supplements">{shown.map(item => <li key={item.id}>
      <button type="button" className="supp-card" onClick={() => setSelected(item)}>
        <span className="supp-card-top"><strong>{item.name}</strong><EvidencePill evidence={item.evidence}/></span>
        <span className="supp-card-summary">{item.summary}</span>
        <span className="supp-tags"><span>{item.category}</span>{audience.fits(item) && <span className="fit">Fits your profile</span>}{audience.minor && item.adultsOnly && <span className="warn">Not for under 18</span>}</span>
        <span className="supp-card-dose"><Icon name="clock" size={14}/>{item.dose.split('. ')[0].replace(/\.$/, '')}</span>
      </button>
    </li>)}</ul>

    <p className="supp-disclaimer">General education, not medical advice. Doses follow the NIH Office of Dietary Supplements. Ask a doctor, pharmacist or dietitian before starting a supplement, especially if you are pregnant, take medicine or have a health condition.</p>
  </div>;
}

function EvidencePill({ evidence }: { evidence: Supplement['evidence'] }) {
  return <span className={`supp-evidence ${evidence.toLowerCase()}`}>{evidence} evidence</span>;
}

function SupplementDetail({ item, minor, fits }: { item: Supplement; minor: boolean; fits: boolean }) {
  const list = (title: string, icon: string, rows: string[], tone = '') =>
    <section className={`supp-section ${tone}`}><h2><Icon name={icon} size={18}/>{title}</h2><ul>{rows.map(row => <li key={row}>{row}</li>)}</ul></section>;
  return <>
    <section className="supp-detail-hero">
      <div className="supp-tags"><span>{item.category}</span><EvidencePill evidence={item.evidence}/>{fits && <span className="fit">Fits your profile</span>}</div>
      <p>{item.summary}</p>
      {minor && item.adultsOnly && <p className="supp-notice warn" role="note"><Icon name="warning" size={18}/><span>Not suggested for anyone under 18 without a doctor.</span></p>}
      <dl className="supp-dose">
        <div><dt>How much</dt><dd>{item.dose}</dd></div>
        <div><dt>When</dt><dd>{item.timing}</dd></div>
      </dl>
    </section>
    {list('Benefits', 'check-circle', item.benefits, 'good')}
    {list('Possible side effects', 'warning', item.sideEffects, 'bad')}
    {list('Who should be careful', 'health', item.cautions)}
    {list('Medicine interactions', 'clipboard', item.interactions)}
    <section className="supp-section"><h2><Icon name="shield" size={18}/>Quality marks to look for</h2>
      <div className="supp-marks">{item.certifications.map(mark => <span key={mark}><Icon name="check" size={14}/>{mark}</span>)}</div>
      <p className="supp-section-note">Check the mark on the label, then confirm it on the certifier&apos;s website. No supplement is &quot;FDA approved&quot;; avoid products that claim to be.</p>
    </section>
    <section className="supp-section"><h2><Icon name="search" size={18}/>Where to buy</h2><ul>{item.whereToBuy.map(row => <li key={row}>{row}</li>)}</ul>
      <p className="supp-section-note">Buy sealed products from official stores, check the expiry date, and avoid sellers with no FDA Philippines registration number.</p>
    </section>
    <a className="supp-source" href={item.source.url} target="_blank" rel="noreferrer"><Icon name="book-open" size={18}/><span><small>Source</small>{item.source.label}</span><span className="visually-hidden"> (opens in a new tab)</span></a>
    <p className="supp-disclaimer">General education, not medical advice. Ask a doctor or pharmacist before starting, stopping or combining supplements.</p>
  </>;
}
