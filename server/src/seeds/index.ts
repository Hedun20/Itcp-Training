import { connectDatabase, disconnectDatabase } from '../config/database';
import { seedAdmin } from './admin';
import { seedCourses } from './courses';

async function main() {
  await connectDatabase();
  try {
    const admin = await seedAdmin();
    const count = await seedCourses(admin._id);
    console.log(`Seed complete: ${count} published courses are ready`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error('Course seed failed', error);
  process.exitCode = 1;
});
