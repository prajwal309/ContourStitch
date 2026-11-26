import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CircleUserRound,
  LockKeyhole,
  LogOut,
  Ruler,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  ChangePasswordForm,
  PreferencesForm,
  ProfilePictureForm,
  SessionManagementForm,
  UsernameForm,
} from '@/components/accounts/AccountSettingsForms';
import { DisplayNameForm } from '@/components/accounts/DisplayNameForm';
import { RecoveryCodeForm } from '@/components/accounts/RecoveryCodeForm';
import { PrivacySettings } from '@/components/consent/PrivacySettings';
import { leaveAccount, startOAuth } from '@/lib/auth/actions';
import { currentUser, enabledProviders } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { signInFor } from '@/lib/auth/return-path';
import { profileDate } from '@/lib/accounts/dates';
import { readAcceptedVersions, readConsent } from '@/lib/consent/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Account | ContourStitch' };

const accountSections = [
  { href: '#personal-profile', label: 'Personal Profile', Icon: UserRound },
  { href: '#fit-passport', label: 'Digital Fit Passport', Icon: Ruler },
  { href: '#family-fit', label: 'Family Fit Studio', Icon: UsersRound },
  { href: '#preferences', label: 'Preferences', Icon: Settings2 },
  { href: '#security', label: 'Security', Icon: ShieldCheck },
  { href: '#privacy-data', label: 'Privacy & Data', Icon: LockKeyhole },
];

const measurementLabels: Record<string, string> = {
  height: 'Height',
  shoulder: 'Shoulder breadth',
  chest: 'Chest',
  waist: 'Waist',
  hip: 'Hip',
  sleeve: 'Sleeve',
  inseam: 'Inseam',
  outseam: 'Outseam',
  arm: 'Arm',
  neck: 'Neck',
};

function initials(name: string | null | undefined) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join('') || 'CS'
  );
}

function storedProfileImage(image: string | null | undefined) {
  if (!image) return null;
  return image.startsWith('data:image/png;base64,') ||
    image.startsWith('data:image/jpeg;base64,') ||
    image.startsWith('data:image/webp;base64,')
    ? image
    : null;
}

function formatMeasurement(valueCm: number, unit: 'cm' | 'in') {
  return unit === 'cm'
    ? `${Math.round(valueCm)} cm`
    : `${(valueCm / 2.54).toFixed(1)} in`;
}

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect(signInFor('/account'));

  const db = database();
  const [
    accounts,
    consent,
    acceptedVersions,
    accountDetails,
    latestProfile,
    profileCount,
    activeSessionCount,
    memberships,
    organizedGroups,
  ] = await Promise.all([
    db.account.findMany({
      where: { userId: user.id },
      select: { provider: true },
    }),
    readConsent(user.id),
    readAcceptedVersions(user.id),
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        emailVerified: true,
        measurementUnit: true,
        fitPreference: true,
      },
    }),
    db.measurementProfile.findFirst({
      where: { userId: user.id },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        updatedAt: true,
        revisions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            measurements: {
              orderBy: { key: 'asc' },
              select: {
                key: true,
                valueCm: true,
                uncertaintyCm: true,
                confidence: true,
              },
            },
          },
        },
      },
    }),
    db.measurementProfile.count({ where: { userId: user.id } }),
    db.session.count({
      where: { userId: user.id, expires: { gt: new Date() } },
    }),
    db.familyMembership.findMany({
      where: { userId: user.id },
      select: { groupId: true },
    }),
    db.familyGroup.findMany({
      where: { organizerId: user.id },
      select: { id: true },
    }),
  ]);
  const passwordLogin = await db.passwordLogin.findUnique({
    where: { userId: user.id },
    select: { username: true, recoveryCodeHash: true },
  });
  const displayName = user.name?.trim() || 'Your ContourStitch account';
  const profileImage = storedProfileImage(user.image);
  const measurements = latestProfile?.revisions[0]?.measurements ?? [];
  const totalFamilyGroups = new Set([
    ...memberships.map(({ groupId }) => groupId),
    ...organizedGroups.map(({ id }) => id),
  ]).size;

  return (
    <main id="main" className="market-page account-page">
      <header className="account-heading">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Account overview</h1>
          <p>
            Keep your profile, fit preferences, and saved measurements up to
            date.
          </p>
        </div>
        <Link className="button account-primary-action" href="/measure">
          Take new measurements <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </header>

      <div className="account-dashboard">
        <aside className="account-sidebar" aria-label="Account overview">
          <div className="account-identity">
            {profileImage ? (
              <Image
                src={profileImage}
                alt=""
                width={44}
                height={44}
                unoptimized
                className="account-avatar-image"
              />
            ) : (
              <span className="account-avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
            )}
            <span className="account-identity-text">
              <strong>{displayName}</strong>
              <span>{user.email ?? 'No email address on file'}</span>
            </span>
          </div>
          <nav className="account-nav" aria-label="Account sections">
            {accountSections.map(({ href, label, Icon }) => (
              <Link href={href} key={href}>
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
            <form action={leaveAccount}>
              <button type="submit" className="account-signout">
                <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </form>
          </nav>
          <p className="account-sidebar-note">
            Your measurements stay private unless you choose to share a saved
            revision.
          </p>
        </aside>

        <div className="account-content">
          <section
            className="account-panel"
            id="personal-profile"
            aria-labelledby="personal-profile-heading"
          >
            <div className="account-panel-heading">
              <div>
                <p className="eyebrow">Profile</p>
                <h2 id="personal-profile-heading">Personal profile</h2>
                <p>Update the details associated with your account.</p>
              </div>
              <CircleUserRound aria-hidden="true" />
            </div>
            <ProfilePictureForm
              userId={user.id}
              initialImage={user.image ?? null}
            />
            <div className="account-email-row">
              <div>
                <span className="account-field-label">Email address</span>
                <strong>{user.email ?? 'No email address on file'}</strong>
                <span className="muted">
                  {accountDetails.emailVerified
                    ? `Verified ${profileDate(accountDetails.emailVerified)}`
                    : 'Not verified by a connected sign-in provider'}
                </span>
              </div>
              {accountDetails.emailVerified && (
                <span className="account-verified">
                  <BadgeCheck size={16} aria-hidden="true" />
                  Verified
                </span>
              )}
            </div>
            <p className="account-private-note">
              Email, first and last name, and phone number are private. Group
              organizers see only your display name and details you explicitly
              share with them.
            </p>
            <DisplayNameForm
              userId={user.id}
              initialName={user.name ?? ''}
              initialFirstName={accountDetails.firstName ?? ''}
              initialLastName={accountDetails.lastName ?? ''}
              initialPhone={accountDetails.phone ?? ''}
            />
          </section>

          <section
            className="account-panel"
            id="fit-passport"
            aria-labelledby="fit-passport-heading"
          >
            <div className="account-panel-heading">
              <div>
                <p className="eyebrow">Saved fit profile</p>
                <h2 id="fit-passport-heading">Digital Fit Passport</h2>
                <p>Your saved measurements and their revision history.</p>
              </div>
              <BookOpenCheck aria-hidden="true" />
            </div>
            <div className="account-passport-summary">
              <div>
                <strong>{profileCount}</strong>
                <span>saved {profileCount === 1 ? 'profile' : 'profiles'}</span>
              </div>
              {latestProfile ? (
                <div>
                  <strong>{profileDate(latestProfile.updatedAt)}</strong>
                  <span>last updated</span>
                </div>
              ) : (
                <div>
                  <strong>Not yet saved</strong>
                  <span>your passport is ready when you are</span>
                </div>
              )}
            </div>
            {measurements.length > 0 ? (
              <dl className="account-measurements">
                {measurements.map(
                  ({ key, valueCm, uncertaintyCm, confidence }) => (
                    <div key={key}>
                      <dt>{measurementLabels[key] ?? key}</dt>
                      <dd>
                        {formatMeasurement(
                          valueCm,
                          accountDetails.measurementUnit,
                        )}
                      </dd>
                      <span className="account-measurement-quality">
                        {confidence} confidence
                        {uncertaintyCm !== null &&
                          ` · ±${formatMeasurement(
                            uncertaintyCm,
                            accountDetails.measurementUnit,
                          )}`}
                      </span>
                    </div>
                  ),
                )}
              </dl>
            ) : (
              <p className="account-empty-state">
                Your measurements are processed in the browser. Save a profile
                from your results to see it here.
              </p>
            )}
            <div className="account-action-row">
              <Link className="secondary-button" href="/my-measurements">
                Open My Fit Profile
              </Link>
              <Link className="text-button" href="/measure">
                Take new measurements{' '}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section
            className="account-panel account-family-panel"
            id="family-fit"
            aria-labelledby="family-fit-heading"
          >
            <div className="account-panel-heading">
              <div>
                <p className="eyebrow">Shared fittings</p>
                <h2 id="family-fit-heading">Family Fit Studio</h2>
                <p>
                  {totalFamilyGroups
                    ? `You’re connected to ${totalFamilyGroups} ${totalFamilyGroups === 1 ? 'family group' : 'family groups'}.`
                    : 'Create a group or join one to coordinate a fitting.'}
                </p>
              </div>
              <UsersRound aria-hidden="true" />
            </div>
            <Link className="secondary-button" href="/family-fit">
              Open Family Fit Studio
            </Link>
          </section>

          <section
            className="account-panel"
            id="preferences"
            aria-labelledby="preferences-heading"
          >
            <div className="account-panel-heading">
              <div>
                <p className="eyebrow">Personalize</p>
                <h2 id="preferences-heading">Preferences</h2>
                <p>Choose the units and fit you prefer to work with.</p>
              </div>
              <Settings2 aria-hidden="true" />
            </div>
            <PreferencesForm
              userId={user.id}
              measurementUnit={accountDetails.measurementUnit}
              fitPreference={accountDetails.fitPreference}
            />
          </section>

          <section
            className="account-panel"
            id="security"
            aria-labelledby="security-heading"
          >
            <div className="account-panel-heading">
              <div>
                <p className="eyebrow">Sign-in and recovery</p>
                <h2 id="security-heading">Security</h2>
                <p>Review how you sign in and protect account access.</p>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>
            {passwordLogin ? (
              <>
                <UsernameForm
                  userId={user.id}
                  username={passwordLogin.username}
                />
                <ChangePasswordForm userId={user.id} />
                <RecoveryCodeForm
                  userId={user.id}
                  hasCode={Boolean(passwordLogin.recoveryCodeHash)}
                />
                <SessionManagementForm
                  userId={user.id}
                  activeSessionCount={activeSessionCount}
                />
                <p className="account-security-note">
                  Password recovery uses a one-time recovery code. Email
                  recovery is not available because this deployment has no email
                  delivery service.
                </p>
              </>
            ) : (
              <p className="account-empty-state">
                This account uses connected sign-in providers. Password recovery
                and session revocation are not available in this interface for
                provider-only accounts.
              </p>
            )}
            <div className="account-provider-list">
              <h3>Connected sign-in providers</h3>
              {enabledProviders.map(({ id, name }) =>
                accounts.some(({ provider }) => provider === id) ? (
                  <p className="account-provider-status" key={id}>
                    <BadgeCheck size={16} aria-hidden="true" />
                    {name} connected
                  </p>
                ) : (
                  <form
                    action={startOAuth.bind(null, id, user.id, '/account')}
                    key={id}
                  >
                    <button className="secondary-button" type="submit">
                      Connect {name}
                    </button>
                  </form>
                ),
              )}
              {enabledProviders.length === 0 && (
                <p className="muted">No connected provider is available.</p>
              )}
            </div>
          </section>

          <PrivacySettings
            userId={user.id}
            hasPassword={Boolean(passwordLogin)}
            state={consent}
            acceptedVersions={acceptedVersions}
          />
        </div>
      </div>
    </main>
  );
}
