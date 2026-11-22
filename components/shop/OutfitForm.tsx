'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveOutfit } from '@/lib/shop/actions';
import { measurementDefinition, type Product } from '@/lib/shop/catalog';
import { compatibility, preferences } from '@/lib/shop/fit';
import type { MeasurementKey } from '@/lib/measurement/types';

export type FitChoice = { id: string; label: string; keys: MeasurementKey[] };
type ExistingOutfit = {
  revisionId: string | null;
  variant: string;
  preference: string;
  extra: Record<string, number>;
};

export function OutfitForm({
  userId,
  product,
  groupId,
  profiles,
  existing,
}: {
  userId: string;
  product: Product;
  groupId: string | null;
  profiles: FitChoice[];
  existing?: ExistingOutfit;
}) {
  const [state, submit, pending] = useActionState(
    saveOutfit.bind(null, userId, product.key, groupId),
    {},
  );
  const [revision, setRevision] = useState(
    existing ? (existing.revisionId ?? '') : (profiles[0]?.id ?? ''),
  );
  const [variant, setVariant] = useState(
    existing?.variant ?? product.variants[0].key,
  );
  const [preference, setPreference] = useState(
    existing?.preference ?? preferences[0],
  );
  const [extra, setExtra] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(existing?.extra ?? {}).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
  );
  const matches = compatibility(
    product.requirements,
    profiles.find(({ id }) => id === revision)?.keys ?? [],
  );
  const availableProfile = profiles.some(({ id }) => id === revision)
    ? revision
    : '';

  return (
    <form action={submit} className="studio-form">
      <fieldset disabled={pending}>
        <legend>Personalize the outfit</legend>
        <div className="form-grid">
          <label>
            Color and fabric
            <select
              name="variant"
              value={variant}
              onChange={(event) => setVariant(event.target.value)}
            >
              {product.variants.map(({ key, color, fabric }) => (
                <option key={key} value={key}>
                  {color} · {fabric}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fit preference
            <select
              name="preference"
              value={preference}
              onChange={(event) => setPreference(event.target.value)}
            >
              {preferences.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">Fit preference is a note for a future fitting.</p>
        <label>
          Fit profile
          <select
            name="revision"
            value={availableProfile}
            onChange={(event) => setRevision(event.target.value)}
          >
            {profiles.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
            <option value="">Enter dimensions for this outfit</option>
          </select>
        </label>
        {!profiles.length && (
          <p className="muted">
            <Link className="inline-link" href="/my-measurements">
              Save a fit profile
            </Link>{' '}
            to reuse body dimensions across outfits.
          </p>
        )}
        <p className="fit-coverage" role="status">
          {matches.fromProfile.length} of {product.requirements.length}{' '}
          dimensions from your saved profile.{' '}
          {matches.missing.length
            ? 'Add the remaining details by tape.'
            : 'Confirm your measurements with a tape before production.'}
        </p>
        {!!matches.fromProfile.length && (
          <p className="muted">
            From your profile ·{' '}
            {matches.fromProfile
              .map((key) => measurementDefinition(key).label)
              .join(', ')}
          </p>
        )}
        {(['body', 'garment'] as const).map((kind) => {
          const fields = matches.missing.filter(
            (key) => measurementDefinition(key).kind === kind,
          );
          if (!fields.length) return null;
          return (
            <div className="studio-section" key={kind}>
              <h3>
                {kind === 'body'
                  ? 'Additional body measurements'
                  : 'Garment dimensions'}
              </h3>
              {fields.map((key) => {
                const field = measurementDefinition(key);
                return (
                  <label key={key} className="extra-field">
                    {field.label} (cm)
                    <input
                      name={`extra-${key}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0.01"
                      max="300"
                      value={extra[key] ?? ''}
                      onChange={(event) =>
                        setExtra((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                    {field.guide && (
                      <span className="muted">{field.guide}</span>
                    )}
                  </label>
                );
              })}
            </div>
          );
        })}
        <p className="muted">
          {groupId
            ? 'Saving updates your one outfit for this group. The organizer can see your outfit and fit progress. Your dimensions stay private.'
            : 'Save this preview outfit with any details you have. You can fill in the rest later.'}
        </p>
        <button type="submit" className="button">
          {pending ? 'Saving…' : 'Save my outfit'}
        </button>
      </fieldset>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="status-message" role="status">
          Outfit saved.
        </p>
      )}
    </form>
  );
}
