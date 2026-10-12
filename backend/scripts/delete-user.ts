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
  if (!mongouri) throw new Error('MONGODB_URI must be set before deleting an account');
  console.log('Connecting to MongoDB...');
  await connect(mongouri);

  const user = await User.findOne({ email });
  if (user) {
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
