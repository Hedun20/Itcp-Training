import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import { getEnv } from './env';
import { User, type IUser } from '../models/User';
import { normalizeEmail } from '../utils/email';

let configured = false;

export function verifiedGoogleEmail(profile: Pick<Profile, 'emails'>): string {
  const email = profile.emails?.find((candidate) => candidate.verified === true)?.value;
  if (!email) throw new Error('Google profile did not provide a verified email address');
  return email;
}

export function configurePassport(): boolean {
  const env = getEnv();
  if (!env.googleEnabled || configured) return env.googleEnabled;

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        callbackURL: env.GOOGLE_CALLBACK_URL!,
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        try {
          const email = verifiedGoogleEmail(profile);
          const normalizedEmail = normalizeEmail(email);
          let user = await User.findOne({ $or: [{ googleId: profile.id }, { normalizedEmail }] });
          if (user) {
            if (user.status !== 'active') return done(new Error('Account is unavailable'));
            user.googleId = profile.id;
            user.avatarUrl = profile.photos?.[0]?.value ?? user.avatarUrl;
            user.lastLoginAt = new Date();
            await user.save();
          } else {
            user = await User.create({
              name: profile.displayName || normalizedEmail.split('@')[0],
              email: email.trim(),
              normalizedEmail,
              googleId: profile.id,
              avatarUrl: profile.photos?.[0]?.value,
              role: 'learner',
              status: 'active',
              lastLoginAt: new Date(),
            });
          }
          return done(null, user as unknown as Express.User & IUser);
        } catch (error) {
          return done(error as Error);
        }
      },
    ),
  );
  configured = true;
  return true;
}

export { passport };
