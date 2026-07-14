import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../models/User';
import { repairOriginalTrainingContent } from './courses';

async function main() {
  await connectDatabase();
  try {
    const admin = await User.findOne({ role: 'admin', status: 'active' }).sort({ createdAt: 1 });
    if (!admin) {
      throw new Error('An active administrator is required as the repair actor; run npm run seed:admin first');
    }
    const report = await repairOriginalTrainingContent(admin._id);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Original training content repair failed', error);
    process.exitCode = 1;
  });
}
