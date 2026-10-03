'use client';

import { useState } from 'react';
import { Icon } from './icons';

const series: Record<string, { value: string; delta: string; bars: number[]; unit: string }> = {
  Weight: { value: '68.5', delta: '+2.1 kg in 8 weeks', bars: [43,49,54,60,69,74,82,93], unit: 'kg' },
  Waist: { value: '78', delta: '−1.5 cm in 8 weeks', bars: [43,49,54,60,64,69,74,93], unit: 'cm' },
  'Bench press': { value: '62.5', delta: '+7.5 kg in 8 weeks', bars: [35,43,47,55,64,70,83,93], unit: 'kg' },
};

export default function Progress({ onBack }: { onBack: () => void }) {
  const [metric, setMetric] = useState('Weight');
  const data = series[metric];

  return (
    <>
      <header className="section-page-head">
        <div className="section-back-title">
          <button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button>
          <h2>Progress</h2>
        </div>
      </header>

      <section className="progress-overview">
        <div className="metric-tabs">
          {Object.keys(series).map(option => (
            <button
              key={option}
              className={metric === option ? 'active' : ''}
              onClick={() => setMetric(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="metric-value">
          <b>{data.value} {data.unit}</b>
          <span><Icon name="trend" size={13}/> {data.delta}</span>
        </div>

        <div className="chart" role="img" aria-label={`${metric} progress over eight weeks`}>
          {data.bars.map((height, i) => (
            <div className="chart-col" key={i}>
              <i
                className={i === data.bars.length - 1 ? 'latest' : ''}
                style={{ height: `${height}%` }}
              />
              {i % 2 === 0 || i === 7 ? <small>W{i + 1}</small> : <small/>}
            </div>
          ))}
        </div>
      </section>

      <section className="subsection records">
        <h3>Personal records</h3>
        {[
          ['Bench press','62.5 kg','Sat Nov 18'],
          ['Squat','90 kg','Sat Nov 16'],
          ['Deadlift','110 kg','Sat Nov 09']
        ].map(([name, value, date]) => (
          <div className="record" key={name}>
            <span>
              <span className="record-icon"><Icon name="medal" size={17}/></span>
              <span>
                <b>{name}</b>
                <small>Set {date}</small>
              </span>
            </span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="subsection accuracy">
        <div className="section-head">
          <h3>Form accuracy</h3>
          <small>8 weeks</small>
        </div>
        <div className="accuracy-card">
          <div className="mini-chart">
            {[35,45,50,59,68,76,87,96].map((h, i) => (
              <i key={i} className={i === 7 ? 'latest' : ''} style={{height: `${h}%`}}/>
            ))}
          </div>
          <p>Average form score improved from <b>58%</b> to <b>88%</b>.</p>
        </div>
      </section>

      <section className="subsection recent-sessions">
        <h3>Recent sessions</h3>
        {[
          ['Upper Body — Push','Nov 18','88% form'],
          ['Lower Body','Nov 16','84% form'],
          ['Upper Body — Pull','Nov 14','81% form']
        ].map(([name, date, score]) => (
          <button className="session-row" key={name}>
            <span>
              <b>{name}</b>
              <small>{date}</small>
            </span>
            <span>
              {score}
              <Icon name="arrow" size={15}/>
            </span>
          </button>
        ))}
      </section>
    </>
  );
}
