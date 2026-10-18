export const REPDB_REVISION = '103fef20fe4932f7b40d260329463938477b2f20';
export const REPDB_MEDIA_BASE = `https://huggingface.co/datasets/RepDB/exercise-dataset/resolve/${REPDB_REVISION}/`;
const title = value => String(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const muscles = { upper_legs: 'Legs', lower_legs: 'Legs', upper_arms: 'Arms', lower_arms: 'Arms', chest: 'Chest', back: 'Back', shoulders: 'Shoulders', core: 'Core', waist: 'Core' };
const equipmentNames = { dumbbell: 'Dumbbells', barbell: 'Barbell', kettlebell: 'Kettlebell', resistance_band: 'Resistance bands', loop_band: 'Resistance bands', cable: 'Cable', cable_machine: 'Cable', machine: 'Machine' };
/** Prepare application display records only. Never expose this collection as a dataset download/API. */
export function normalizeRepDb(data) {
  if (!data || data.schema_version !== 3 || !Array.isArray(data.exercises) || data.exercises.length > 2000 || data.count !== data.exercises.length) throw new Error('Unsupported RepDB snapshot');
  const seen = new Set();
  return data.exercises.map(row => {
    if (!/^[a-z0-9-]{1,80}$/.test(row.id) || seen.has(row.id) || typeof row.name_en !== 'string' || !row.name_en.trim() || row.name_en.length > 100 ||
      !Array.isArray(row.instructions_en) || !row.instructions_en.length || !row.instructions_en.every(step => typeof step === 'string' && step.length < 2000)) throw new Error('Invalid RepDB exercise');
    seen.add(row.id);
    const illustrations = Object.entries(row.images?.flat ?? {}).filter(([label]) => ['start', 'peak', 'main'].includes(label)).map(([label, path]) => {
      if (typeof path !== 'string' || !/^images\/flat\/[a-z0-9-]+-(start|peak|main)\.webp$/.test(path)) throw new Error('Invalid RepDB illustration path');
      return { label: label === 'start' ? 'Start position' : label === 'peak' ? 'Peak position' : 'Exercise illustration', url: REPDB_MEDIA_BASE + path };
    });
    const equipment = row.is_bodyweight && !row.equipment ? 'Bodyweight' : equipmentNames[row.equipment] ?? (row.equipment ? title(row.equipment) : 'Equipment not specified');
    return { _id: `repdb-${row.id}`, slug: `repdb-${row.id}`, name: row.name_en.trim(), targetMuscle: muscles[row.body_part] ?? title(row.body_part || 'General'), equipment,
      group: muscles[row.body_part] ?? 'General', difficulty: title(row.difficulty || 'Unspecified'), description: typeof row.description_en === 'string' ? row.description_en : '',
      instructions: row.instructions_en, illustrations, source: 'RepDB', trackingStatus: 'Manual', pose: 'missing',
      checks: Array.isArray(row.tips_en) ? row.tips_en.filter(tip => typeof tip === 'string') : [], gifUrl: '' };
  });
}
