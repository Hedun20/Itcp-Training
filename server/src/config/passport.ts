import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import { getEnv } from './env';
import { User, type IUser } from '../models/User';
import { normalizeEmail } from '../utils/email';

let configured = false;

export interface PendingGoogleIdentity {
  googleId: string;
  email: string;
  normalizedEmail: string;
  name: string;
  avatarUrl?: string;
}

export type GoogleAuthentication =
  | { kind: 'existing'; user: IUser }
  | { kind: 'new'; identity: PendingGoogleIdentity };

export function verifiedGoogleEmail(profile: Pick<Profile, 'emails'>): string {
  const email = profile.emails?.find((candidate) => candidate.verified === true)?.value;
  if (!email) throw new Error('Google profile did not provide a verified email address');
  return email;
}

export async function resolveGoogleProfile(profile: Profile): Promise<GoogleAuthentication> {
  const email = verifiedGoogleEmail(profile).trim();
  const normalizedEmail = normalizeEmail(email);
  const [googleUser, emailUser] = await Promise.all([
    User.findOne({ googleId: profile.id }),
    User.findOne({ normalizedEmail }),
  ]);
  if (googleUser && emailUser && !googleUser._id.equals(emailUser._id)) {
    throw new Error('Google identity conflicts with an existing account');
  }
  const user = googleUser ?? emailUser;
  if (user) {
    if (user.status !== 'active') throw new Error('Account is unavailable');
    user.googleId = profile.id;
    user.avatarUrl = profile.photos?.[0]?.value ?? user.avatarUrl;
    user.lastLoginAt = new Date();
    await user.save();
    return { kind: 'existing', user };
  }
  return {
    kind: 'new',
    identity: {
      googleId: profile.id,
      email,
      normalizedEmail,
      name: (profile.displayName || normalizedEmail.split('@')[0]!).trim().slice(0, 120),
      avatarUrl: profile.photos?.[0]?.value?.slice(0, 2_000),
    },
  };
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
          const authentication = await resolveGoogleProfile(profile);
          return done(null, authentication as unknown as Express.User);
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
