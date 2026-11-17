import { connect, Schema, model, Types } from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();
const userSchema = new Schema({
  email: { type: String, required: true },
}, { collection: 'users' });

const User = model('User', userSchema);

const profileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
}, { collection: 'profiles' });
const Profile = model('Profile', profileSchema);

async function deleteUser() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || process.argv[3] !== '--confirm-delete') {
    throw new Error('Usage: ts-node backend/scripts/delete-user.ts <email> --confirm-delete');
  }
  const mongouri = process.env.MONGODB_URI;
  if (!mongouri) throw new Error('MONGODB_URI must be set before deleting an account');console.log('Connecting to MongoDB...');
  await connect(mongouri);

  const user = await User.findOne({ email });
  if (user) {
    // Lifecycle state machine guard: refuse deletion on accounts not in active state
    const lifecycleCollection = (await import('mongoose')).connection.db.collection('account_lifecycle');
    const lifecycleRow = await lifecycleCollection.findOne({ _id: user._id }, { projection: { status: 1, generation: 1 } });
    if (!lifecycleRow) {
      console.error('Refusing deletion: no account_lifecycle row found for user', user._id);
      process.exit(1);    }
    if (lifecycleRow.status !== 'active') {
      console.error('Refusing deletion: user lifecycle status is', lifecycleRow.status, '(not active)');
      process.exit(1);
    }
    // Generation gate: only allow deletion if the stored generation matches the expected (0 for initial)
    if (lifecycleRow.generation !== 0) {
      console.error('Refusing deletion: lifecycle generation is', lifecycleRow.generation, '(expected 0 for initial deletion)');
      process.exit(1);
    }
    console.log('Found user:', user._id);
    await Profile.deleteMany({ userId: user._id });
    console.log('Deleted related profiles');
    await User.deleteOne({ _id: user._id });
    console.log('Deleted user');
  } else {
    console.log('User not found in users collection');
  }

  await (await import('mongoose')).connection.close();
}

deleteUser().catch(e => { console.error(e); process.exit(1); });
