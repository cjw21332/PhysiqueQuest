import { randomUUID } from 'node:crypto';
import { createConnection, Types } from 'mongoose';
import { NutritionSchema } from '../src/nutrition/schemas/nutrition.schema.js';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import { up } from '../migrations/002-nullable-diary.mjs';

it.skipIf(!process.env.PQ_TEST_MONGO_URI)('migrates legacy meals and round trips incomplete scan entries', async () => {
  const connection = await createConnection(process.env.PQ_TEST_MONGO_URI!, { dbName: 'pq_nullable_test_' + randomUUID().replaceAll('-', ''), serverSelectionTimeoutMS: 3000 }).asPromise();
  try {
    const db = connection.db!;
    const owner = new Types.ObjectId();
    const model = connection.model('Nutrition', NutritionSchema);
    await db.collection('nutrition').insertOne({ userId: owner, meals: [{ id: 'older', calories: 0 }] });
    expect((await up(db)).modifiedCount).toBe(1);
    expect((await up(db)).modifiedCount).toBe(0);
    const service = new NutritionService(model);
    await service.addMealsFromScan(owner.toString(), { meal: 'Dinner', items: [{ food_name: 'rice', found: true, kcal: 150, protein_g: 0, carbs_g: null, fat_g: null, est_weight_g: 100 }] });
    await service.addMeal(owner.toString(), { name:'Label product', meal:'Lunch', source:'Barcode', brand:'Label brand', barcode:'4006381333931', servingQuantity:150, servingUnit:'g', calories:225, fiber:3, sodium:0, addedSugar:null, protein:0 });
    await service.addMeal(owner.toString(), {name:'Manual label',meal:'Lunch',source:'Manual',servingQuantity:150,servingUnit:'ml',calories:375,protein:0,fiber:6,sodium:null});
    const { meals } = await service.read(owner.toString());
    expect(JSON.parse(JSON.stringify(meals))).toMatchObject([
      { id: 'older', calories: 0, protein: null },
      { name: 'rice', estWeightG: 100, calories: 150, protein: 0, carbs: null, fat: null },
      {source:'Barcode',barcode:'4006381333931',brand:'Label brand',servingQuantity:150,servingUnit:'g',calories:225,fiber:3,sodium:0,addedSugar:null,protein:0,carbs:null,fat:null},
      {name:'Manual label',source:'Manual',servingQuantity:150,servingUnit:'ml',calories:375,protein:0,carbs:null,fat:null,fiber:6,sodium:null}
    ]);
    await service.updateMeal(owner.toString(),meals[3].id,{name:'Manual label edited',meal:'Lunch',calories:375,protein:0});
    expect((await service.read(owner.toString())).meals[3]).toMatchObject({name:'Manual label edited',calories:375,protein:0,carbs:null,fat:null,fiber:6,sodium:null});
    await service.updateMeal(owner.toString(),meals[3].id,{name:'Manual label',meal:'Lunch',calories:375,fiber:null,sodium:0});
    expect((await service.read(owner.toString())).meals[3]).toMatchObject({fiber:null,sodium:0,protein:0});

  } finally {
    try { if (/^pq_nullable_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase(); }
    finally { await connection.close(); }
  }
});
