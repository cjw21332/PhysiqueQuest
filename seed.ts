import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/fitnessApp';

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  targetMuscle: { type: String, required: true },
  equipment: { type: String, required: true },
  difficulty: { type: String, required: true },
  pictureUrl: { type: String },
  videoUrl: { type: String },
  instructions: { type: [String], required: true },
  trackingStatus: { type: String, default: 'Manual' }
}, { timestamps: true });

const Exercise = mongoose.models.Exercise || mongoose.model('Exercise', exerciseSchema);

const exerciseDataset = [
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  }
];

async function runSeed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully.');

    console.log('Clearing old exercises...');
    await Exercise.deleteMany({});

    console.log('Inserting new dataset...');
    await Exercise.insertMany(exerciseDataset);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runSeed();
