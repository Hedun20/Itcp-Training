import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { getEnv } from '../config/env';
import { User } from '../models/User';
import { normalizeEmail } from '../utils/email';

function assertSeedPassword(password: string | undefined): asserts password is string {
  if (!password || password.length < 12) {
    throw new Error('ADMIN_PASSWORD (at least 12 characters) is required when creating or explicitly resetting an admin');
  }
  if (/replace[-_ ]?with/i.test(password)) {
    throw new Error('ADMIN_PASSWORD still contains a placeholder; choose a strong unique password before seeding');
  }
}

export async function seedAdmin() {
  const env = getEnv();
  if (!env.ADMIN_NAME || !env.ADMIN_EMAIL) {
    throw new Error('ADMIN_NAME and ADMIN_EMAIL are required to seed an admin');
  }

  const normalizedEmail = normalizeEmail(env.ADMIN_EMAIL);
  let admin = await User.findOne({ normalizedEmail }).select('+passwordHash');

  if (!admin) {
    assertSeedPassword(env.ADMIN_PASSWORD);
    admin = await User.create({
      name: env.ADMIN_NAME,
      email: normalizedEmail,
      normalizedEmail,
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12),
      role: 'admin',
      status: 'active',
    });
    console.log(`Created administrator ${normalizedEmail}`);
    return admin;
  }

  if (admin.role !== 'admin') {
    throw new Error(
      `Refusing to promote existing non-admin account ${normalizedEmail}; choose a different ADMIN_EMAIL or promote it through an authenticated admin workflow`,
    );
  }

  admin.name = env.ADMIN_NAME;
  admin.email = normalizedEmail;
  admin.status = 'active';

  if (env.ADMIN_RESET_PASSWORD) {
    assertSeedPassword(env.ADMIN_PASSWORD);
    admin.passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  }

  await admin.save();
  console.log(
    env.ADMIN_RESET_PASSWORD
      ? `Administrator ${normalizedEmail} already exists; profile, status and password refreshed`
      : `Administrator ${normalizedEmail} already exists; profile and status refreshed, existing password preserved`,
  );
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
