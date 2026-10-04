import { connect, Schema, model, Types } from 'mongoose';

const exerciseSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, default: '' },
  group: { type: String, default: 'General' },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  pose: { type: String, enum: ['missing', 'ready', 'training'], default: 'ready' },
  targetMuscle: String,
  equipment: String,
  difficulty: { type: String, default: 'Beginner' },
  pictureUrl: String,
  videoUrl: String,
  instructions: [String],
  trackingStatus: { type: String, default: 'Manual' },
}, { timestamps: true, collection: 'admin_exercises' });

const Exercise = model('ExerciseRecord', exerciseSchema);

const dataset = [
  {
    name: "Dumbbell bench press",
    targetMuscle: "Chest",
    equipment: "Dumbbells",
    difficulty: "Intermediate",
    pictureUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500",
    videoUrl: "https://vjs.zencdn.net/v/oceans.mp4",
    trackingStatus: "AI tracked",
    instructions: [
      "Lie flat on a bench holding a dumbbell in each hand at chest level.",
      "Press the weights straight up over your chest until arms are fully extended.",
      "Lower the dumbbells slowly to starting position."
    ],
    slug: "dumbbell-bench-press",
    group: "Chest",
  },
  {
    name: "Overhead press",
    targetMuscle: "Shoulders",
    equipment: "Dumbbells",
    difficulty: "Intermediate",
    pictureUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500",
    videoUrl: "https://vjs.zencdn.net/v/oceans.mp4",
    trackingStatus: "AI tracked",
    instructions: [
      "Sit or stand holding dumbbells at shoulder height with palms facing forward.",
      "Press dumbbells upward until arms are extended overhead.",
      "Lower under control back to shoulder level."
    ],
    slug: "overhead-press",
  },
  {
    name: "Lateral raise",
    targetMuscle: "Shoulders",
    equipment: "Dumbbells",
    difficulty: "Beginner",
    pictureUrl: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=500",
    videoUrl: "https://vjs.zencdn.net/v/oceans.mp4",
    trackingStatus: "AI tracked",
    instructions: [
      "Stand tall holding dumbbells at your sides.",
      "Raise arms out to the sides until parallel to the floor.",
      "Lower back down smoothly."
    ],
    slug: "lateral-raise",
  },
  {
    name: "Triceps extension",
    targetMuscle: "Arms",
    equipment: "Dumbbells",
    difficulty: "Intermediate",
    pictureUrl: "https://images.unsplash.com/photo-1530822847156-5df684611749?w=500",
    videoUrl: "https://vjs.zencdn.net/v/oceans.mp4",
    trackingStatus: "Manual",
    instructions: [
      "Hold a dumbbell overhead with both hands.",
      "Lower weight behind head by bending at elbows.",
      "Extend arms back to starting overhead position."
    ],
    slug: "triceps-extension",
  },
  {
    name: "Incline press",
    targetMuscle: "Chest",
    equipment: "Dumbbells",
    difficulty: "Advanced",
    pictureUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500",
    videoUrl: "https://vjs.zencdn.net/v/oceans.mp4",
    trackingStatus: "AI tracked",
    instructions: [
      "Set bench to 30-45 degree incline.",
      "Press dumbbells up from chest level.",
      "Lower down slowly under tension."
    ],
    slug: "incline-press",
  },
  {
    name: "Floor press",
    targetMuscle: "Chest",
    equipment: "Dumbbells",
    difficulty: "Beginner",
    pictureUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500",
    videoUrl: "https://vjs.zencdn.net/v/oceans.mp4",
    trackingStatus: "AI tracked",
    instructions: [
      "Lie on floor with knees bent, holding dumbbells.",
      "Press up until elbows lock gently.",
      "Lower until upper arms touch the floor."
    ],
    slug: "floor-press",
  },
  {
    name: "Bent-over row",
    targetMuscle: "Back",
    equipment: "Dumbbells",
    difficulty: "Intermediate",
    pictureUrl: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=500",
    videoUrl: "https://vjs.zencdn.net/v/oceans.mp4",
    trackingStatus: "AI tracked",
    instructions: [
      "Hinge at hips with flat back, holding dumbbells hanging down.",
      "Pull dumbbells toward hips, squeezing shoulder blades.",
      "Lower under control."
    ],
    slug: "bent-over-row",
  },
  {
    name: "Goblet squat",
    targetMuscle: "Legs",
    equipment: "Dumbbells",
    difficulty: "Beginner",
    pictureUrl: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500",
    videoUrl: "https://vjs.zencdn.net/v/oceans.mp4",
    trackingStatus: "Caution",
    instructions: [
      "Hold one dumbbell vertically against chest.",
      "Squat down until thighs are parallel to ground.",
      "Drive up through heels to stand."
    ],
    slug: "goblet-squat",
  },
];

async function seed() {
  const mongouri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost/physiquequest';
  await connect(mongouri);
  for (const item of dataset) {
    await Exercise.updateOne({ name: item.name }, { $set: item }, { upsert: true });
  }
  console.log(`Seeded ${dataset.length} exercises into MongoDB (collection: admin_exercises)`);
  await (await import('mongoose')).connection.close();
}

seed().catch(e => { console.error(e); process.exit(1); });
