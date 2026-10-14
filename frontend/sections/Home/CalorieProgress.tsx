export default function CalorieProgress({ calories, target }: { calories: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.max(0, calories / target * 100)) : 0;
  return <div className="calorie-circle home-calorie-progress" role="img" aria-label={`${Math.round(calories)} of ${target} calories logged`}>
    <svg className="circle-svg" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="45" className="circle-bg"/>
      <circle cx="50" cy="50" r="45" className="circle-progress" strokeDasharray={2 * Math.PI * 45} strokeDashoffset={2 * Math.PI * 45 * (1 - percent / 100)}/>
    </svg>
    <div className="circle-content"><div className="calorie-amount">{calories >= 1000 ? `${(calories / 1000).toFixed(1)}k` : Math.round(calories)}</div><div className="calorie-goal">of {target.toLocaleString()}</div></div>
  </div>;
}
