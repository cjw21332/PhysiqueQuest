// Ranking is a recommendation policy, not a claim of upstream popularity.
export function commonMovementScore(name: string): number {
  const basic = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(dumbbell|barbell|bodyweight|cable|band|kettlebell)\b/g, '').replace(/\s+/g, ' ').trim();
  const canonical = ['bench press', 'push up', 'squat', 'goblet squat', 'deadlift', 'romanian deadlift', 'bent over row', 'row', 'pull up', 'lat pulldown', 'shoulder press', 'overhead press', 'lateral raise', 'biceps curl', 'triceps extension', 'plank', 'crunch', 'glute bridge', 'standing calf raise', 'calf raise', 'lunge'];
  if (canonical.includes(basic)) return 100;
  return (/bench press|push up|squat|deadlift|pull up|row|curl|plank|lateral raise|shoulder press|calf raise|lunge|crunch|triceps/.test(basic) ? 35 : 0) - basic.split(' ').length;
}

export function primaryCategory(target: string, group: string): string {
  const value = `${target} ${group}`.toLowerCase();
  if (/cardio/.test(value)) return 'Cardio';
  if (/chest|pectoral/.test(value)) return 'Chest';
  if (/shoulder|deltoid/.test(value)) return 'Shoulders';
  if (/\b(back|lat|lats)\b/.test(value)) return 'Back';
  if (/leg|glute|quad|hamstring|calf|calves/.test(value)) return 'Legs';
  if (/arm|biceps|triceps/.test(value)) return 'Arms';
  if (/core|waist|abdominal/.test(value)) return 'Core';
  return 'General';
}

export function suitableStrengthMovement(name: string): boolean {
  if (/stretch|potty|cuban|inside leg kick|overhead twist|chest tap|guillotine|behind.*neck|upward facing|downward facing|yoga|cobra|\bcat\b|bowling|exercise ball|leg raised|contralateral|inverse leg curl|upright row/i.test(name)) return false;
  return /press|push[ -]?up|squat|lunge|deadlift|row|pull[ -]?up|pulldown|curl|extension|raise|plank|crunch|bridge|bird dog|dead bug|wall sit|fly|dip|kickback|step[ -]?up|leg press|good morning/i.test(name);
}

export function matchesFocus(category: string, name: string, keywords: string[]): boolean {
  if (keywords.includes('*')) return true;
  if (category === 'Cardio') return keywords.includes('cardio') || keywords.includes('endurance');
  if (category === 'Chest') return keywords.includes('chest');
  if (category === 'Shoulders') return keywords.includes('shoulder') || keywords.includes('press');
  if (category === 'Back') return keywords.includes('back') || keywords.includes('lat') || keywords.includes('row');
  if (category === 'Legs') return keywords.includes('leg') || keywords.includes('glute') || keywords.includes('quad') || keywords.includes('hamstring');
  if (category === 'Core') return keywords.includes('core') || keywords.includes('ab');
  if (category === 'Arms') return (keywords.includes('triceps') && /triceps|extension|kickback|dip/i.test(name)) || (keywords.includes('biceps') && /biceps|curl/i.test(name));
  return false;
}

export function movementFamily(name: string): string {
  if (/push[ -]?up/i.test(name)) return 'bodyweight push';
  if (/press/i.test(name)) return /shoulder|overhead|arnold|seated/i.test(name) ? 'vertical push' : 'horizontal push';
  if (/squat/i.test(name)) return 'squat';
  if (/lunge|step[ -]?up/i.test(name)) return 'lunge';
  if (/deadlift|hinge|good morning/i.test(name)) return 'hinge';
  if (/bridge/i.test(name)) return 'bridge';
  if (/row/i.test(name)) return 'row';
  if (/pull[ -]?up|pulldown/i.test(name)) return 'vertical pull';
  if (/lateral raise/i.test(name)) return 'lateral raise';
  if (/calf raise/i.test(name)) return 'calf raise';
  if (/curl/i.test(name)) return /leg|hamstring/i.test(name) ? 'leg curl' : 'arm curl';
  if (/triceps|kickback/i.test(name)) return 'triceps';
  if (/fly/i.test(name)) return 'fly';
  return name.toLowerCase();
}
