'use client';

import { useState, useTransition } from 'react';
import { removeOutfit } from '@/lib/shop/actions';

export function RemoveOutfit({ userId, id }: { userId: string; id: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        type="button"
        className="text-button delete-button"
        disabled={pending}
        onClick={() => {
          if (!confirmed) {
            setConfirmed(true);
            return;
          }
          start(async () => {
            try {
              const result = await removeOutfit(userId, id);
              if (result.error) setError(result.error);
            } catch {
              setError('Your outfit could not be removed.');
            }
          });
        }}
      >
        {confirmed ? 'Confirm removal' : 'Remove outfit'}
      </button>
      {confirmed && (
        <button
          type="button"
          className="text-button"
          onClick={() => setConfirmed(false)}
          disabled={pending}
        >
          Keep outfit
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
