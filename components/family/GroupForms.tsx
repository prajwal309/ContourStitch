'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  createGroup,
  createInvitation,
  revokeInvitation,
} from '@/lib/family/actions';
import { collections } from '@/lib/shop/catalog';

export function CreateGroupForm({ userId }: { userId: string }) {
  const [state, submit, pending] = useActionState(
    createGroup.bind(null, userId),
    {},
  );
  const [name, setName] = useState('');

  return (
    <form action={submit} className="studio-form">
      <fieldset disabled={pending}>
        <legend>Create a group</legend>
        <label>
          Group name
          <input
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Our wedding"
            autoComplete="off"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <input type="hidden" name="collection" value={collections[0].key} />
        <button type="submit" className="button">
          {pending ? 'Creating…' : 'Create group'}
        </button>
      </fieldset>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function InvitationPanel({
  userId,
  groupId,
  invitations,
}: {
  userId: string;
  groupId: string;
  invitations: {
    id: string;
    expiry: string;
    state: 'Active' | 'Expired' | 'Used' | 'Revoked';
  }[];
}) {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function createLink() {
    setError('');
    setStatus('');
    setLink('');
    start(async () => {
      try {
        const result = await createInvitation(userId, groupId);
        if (result.code) {
          setLink(
            new URL(`/family-fit/invite#${result.code}`, window.location.origin)
              .href,
          );
          setStatus('Invitation created.');
        } else setError(result.error ?? 'The invitation could not be created.');
      } catch {
        setError('The invitation could not be created.');
      }
    });
  }

  function revoke(id: string) {
    setError('');
    setStatus('');
    setLink('');
    start(async () => {
      try {
        const result = await revokeInvitation(userId, groupId, id);
        if (result.error) setError(result.error);
        else setStatus('Invitation updated.');
      } catch {
        setError('The invitation could not be revoked.');
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Invitation copied.');
    } catch {
      setStatus('Select the invitation link and copy it manually.');
    }
  }

  return (
    <section className="studio-panel">
      <h2>Invite family</h2>
      <p>
        Share each link privately with one person. A link expires after seven
        days and lets the first signed-in recipient join.
      </p>
      <button
        type="button"
        className="secondary-button"
        onClick={createLink}
        disabled={pending}
      >
        Create invitation
      </button>
      {link && (
        <div className="invite-share">
          <label>
            Invitation link
            <input
              type="url"
              readOnly
              value={link}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <button type="button" className="text-button" onClick={copyLink}>
            Copy link
          </button>
          <p className="muted">
            Copy this link now. You can create another when needed.
          </p>
        </div>
      )}
      <p role="status" className="status-message">
        {status}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!!invitations.length && (
        <ul className="studio-list" aria-label="Invitation status">
          {invitations.map(({ id, expiry, state }) => (
            <li key={id}>
              <span>
                <strong>{state}</strong>
                <br />
                <span className="muted">Expires {expiry}</span>
              </span>
              {state === 'Active' && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => revoke(id)}
                  disabled={pending}
                >
                  Revoke invitation
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
