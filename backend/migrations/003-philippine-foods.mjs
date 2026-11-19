// Creates an empty collection and indexes; a reviewed seed import is separate.
export async function up(db) {
  const name = 'philippine_foods';
  if (!(await db.listCollections({ name }).hasNext())) await db.createCollection(name);
  const foods = db.collection(name);
  await foods.createIndex({ id: 1 }, { unique: true });
  await foods.createIndex({ canonicalName: 'text', filipinoName: 'text', aliases: 'text' });
}
