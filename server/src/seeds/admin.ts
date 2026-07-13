import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { getEnv } from '../config/env';
import { User } from '../models/User';
import { normalizeEmail } from '../utils/email';

export async function seedAdmin() {
  const env = getEnv();
  if (!env.ADMIN_NAME || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) are required to seed an admin');
  }
  if (/replace[-_ ]?with/i.test(env.ADMIN_PASSWORD)) {
    throw new Error('ADMIN_PASSWORD still contains a placeholder; choose a strong unique password before seeding');
  }
  const normalizedEmail = normalizeEmail(env.ADMIN_EMAIL);
  let admin = await User.findOne({ normalizedEmail }).select('+passwordHash');
  if (!admin) {
    admin = await User.create({
      name: env.ADMIN_NAME,
      email: normalizedEmail,
      normalizedEmail,
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12),
      role: 'admin',
      status: 'active',
    });
    console.log(`Created administrator ${normalizedEmail}`);
  } else {
    admin.name = env.ADMIN_NAME;
    admin.email = normalizedEmail;
    admin.role = 'admin';
    admin.status = 'active';
    if (!admin.passwordHash) admin.passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await admin.save();
    console.log(`Administrator ${normalizedEmail} already exists; role and status verified`);
  }
  return admin;
}

async function main() {
  await connectDatabase();
  try {
    await seedAdmin();
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Admin seed failed', error);
    process.exitCode = 1;
  });
}
