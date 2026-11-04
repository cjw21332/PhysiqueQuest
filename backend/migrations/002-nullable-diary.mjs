// Existing numeric values (including zero) are authoritative. Only fill absent fields.
export async function up(db) {
  const defaults = { calories: null, protein: null, carbs: null, fat: null };
  return db.collection('nutrition').updateMany({
    meals: { $elemMatch: { $or: Object.keys(defaults).map(key => ({ [key]: { $exists: false } })) } }
  }, [{ $set: { meals: { $map: { input: '$meals', as: 'meal', in: { $mergeObjects: [defaults, '$$meal'] } } } } }]);
}
