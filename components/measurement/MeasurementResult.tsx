'use client';
import { useState, type ReactNode } from 'react';
import { Pencil, ShieldCheck, Save, Trash2 } from 'lucide-react';
import {
  labels,
  measurementKeys,
  liveMeasurementKeys,
  type MeasurementKey,
  type MeasurementReport,
  type Unit,
} from '@/lib/measurement/types';
import { correctMeasurement, tapeMethod } from '@/lib/measurement/corrections';
import { displayValue } from '@/lib/measurement/units';
import { MeasurementEditor } from './MeasurementEditor';
import { saveProfile, loadProfile, deleteProfile } from '@/lib/storage/profile';
export function MeasurementResult({
  report,
  onChange,
  initialUnit = 'cm',
  onUnitChange,
  cloudActions,
}: {
  report: MeasurementReport;
  onChange: (report: MeasurementReport) => void;
  initialUnit?: Unit;
  onUnitChange?: (unit: Unit) => void;
  cloudActions?: ReactNode;
}) {
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [editing, setEditing] = useState<MeasurementKey | null>(null);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const keys =
    report.source === 'live-video' ? liveMeasurementKeys : measurementKeys;
  const estimateCount = keys.filter((key) =>
    report.estimates.some((estimate) => estimate.key === key),
  ).length;

  function changeUnit(next: Unit) {
    setEditing(null);
    setUnit(next);
    onUnitChange?.(next);
  }

  function correct(key: MeasurementKey, valueCm: number) {
    onChange(correctMeasurement(report, key, valueCm));
    setEditing(null);
    const destination = cloudActions ? 'to your account' : 'on this device';
    setNotice(
      `${labels[key]} updated. Save again to keep this change ${destination}.`,
    );
  }

  function storage(action: () => void) {
    try {
      action();
      setStorageError('');
    } catch {
      setStorageError(
        'Browser storage is unavailable. Your measurements remain in this session only.',
      );
    }
  }
  return (
    <>
      <div className="results-notice">
        <ShieldCheck size={23} />
        <div>
          <strong>Body measurements, with room for uncertainty.</strong>
          <p>
            Video estimates are experimental. A displayed interval is an
            unvalidated working allowance, not a confidence interval. When
            calibration is unavailable, no interval is assigned. Model
            confidence describes capture quality, not physical measurement
            error. Confirm every estimate with a tape before garment production.
            Garment ease is separate.
          </p>
        </div>
      </div>
      <div className="results-toolbar">
        <span>
          {estimateCount} of {keys.length} measurements
        </span>
        <div className="unit-toggle" aria-label="Measurement units">
          <button aria-pressed={unit === 'cm'} onClick={() => changeUnit('cm')}>
            cm
          </button>
          <button aria-pressed={unit === 'in'} onClick={() => changeUnit('in')}>
            inches
          </button>
        </div>
      </div>
      <p className="muted">
        Use a flexible tape without pulling it tight. Select any measurement to
        enter or correct it.
      </p>
      <div className="measurements">
        {keys.map((key) => {
          const estimate = report.estimates.find((e) => e.key === key);
          const manual = estimate?.method === tapeMethod;
          const original = report.originalEstimates?.find((e) => e.key === key);
          return (
            <article className="measurement-item" key={key}>
              <div className="measurement-heading">
                <h2>{labels[key]}</h2>
                <button
                  className="edit-button"
                  aria-label={`${estimate ? 'Edit' : 'Enter'} ${labels[key]}`}
                  onClick={() => setEditing(key)}
                >
                  <Pencil size={15} />
                  <span>{estimate ? 'Edit' : 'Enter'}</span>
                </button>
              </div>
              {editing === key ? (
                <MeasurementEditor
                  key={`${key}-${unit}`}
                  measurementKey={key}
                  valueCm={estimate?.valueCm}
                  unit={unit}
                  onSave={(cm) => correct(key, cm)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  {estimate ? (
                    <>
                      <div className="measurement-value">
                        {displayValue(estimate.valueCm, unit)}{' '}
                        <span>
                          {estimate.uncertaintyCm === null
                            ? unit
                            : `± ${range(estimate.uncertaintyCm, unit)} ${unit}`}
                        </span>
                        <span className={`confidence ${estimate.confidence}`}>
                          {manual
                            ? 'Tape entry'
                            : `Model confidence: ${estimate.confidence}`}
                        </span>
                      </div>
                      {estimate.uncertaintyCm === null && (
                        <p className="muted">
                          No validated uncertainty interval is assigned to this
                          {manual ? ' tape entry.' : ' estimate.'}
                        </p>
                      )}
                      {estimate.sidesCm && (
                        <p className="muted">
                          Left {displayValue(estimate.sidesCm.left, unit)}{' '}
                          {unit} · Right{' '}
                          {displayValue(estimate.sidesCm.right, unit)} {unit}
                        </p>
                      )}
                      {estimate.confidence === 'low' && (
                        <p className="tape-warning">
                          Confirm {labels[key].toLowerCase()} with a tape.
                        </p>
                      )}
                      <details>
                        <summary>How this was measured</summary>
                        <p>{estimate.method}</p>
                        {original && (
                          <p>
                            Original estimate{' '}
                            {displayValue(original.valueCm, unit)} {unit}
                            {original.uncertaintyCm === null
                              ? ' (experimental).'
                              : ` with a range of ± ${range(original.uncertaintyCm, unit)} ${unit} (${original.confidence} confidence).`}
                          </p>
                        )}
                        <ul>
                          {estimate.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      </details>
                    </>
                  ) : (
                    <>
                      <p className="unavailable">Not estimated</p>
                      <p className="muted">
                        {report.missing[key] ??
                          'Enter this measurement from a tape.'}
                      </p>
                    </>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="profile-actions">
        {cloudActions ?? (
          <>
            <button
              className="button"
              disabled={!report.estimates.length}
              onClick={() =>
                storage(() => {
                  saveProfile(report, unit);
                  setNotice(
                    'Measurements saved on this device. Camera images weren’t saved.',
                  );
                })
              }
            >
              <Save size={17} /> Save on this device
            </button>
            <button
              className="text-button"
              onClick={() =>
                storage(() => {
                  const profile = loadProfile();
                  if (profile) {
                    onChange(profile.report);
                    changeUnit(profile.unit);
                    setNotice('Saved measurements loaded from this device.');
                  } else
                    setNotice('No saved measurements found on this device.');
                })
              }
            >
              Load saved measurements
            </button>
            <p className="muted">
              Shared device? Skip saving. Your profile is stored only in this
              browser, without camera images.
            </p>
            {confirmDelete ? (
              <div className="delete-confirm">
                <p>Delete saved measurements and clear this session?</p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    onChange({
                      ...(report.source && { source: report.source }),
                      estimates: [],
                      missing: {},
                    });
                    setEditing(null);
                    setConfirmDelete(false);
                    storage(() => {
                      deleteProfile();
                      setNotice(
                        'Your measurements have been deleted from this browser and session.',
                      );
                    });
                  }}
                >
                  Yes, delete measurements
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep measurements
                </button>
              </div>
            ) : (
              <button
                className="text-button delete-button"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} /> Delete my measurements
              </button>
            )}
          </>
        )}
      </div>
      <p role="status" className="status-message">
        {notice}
      </p>
      {storageError && (
        <p role="alert" className="error">
          {storageError}
        </p>
      )}
    </>
  );
}

function range(uncertaintyCm: number, unit: Unit) {
  return unit === 'cm'
    ? Math.ceil(uncertaintyCm)
    : Math.ceil((uncertaintyCm / 2.54) * 2) / 2;
}
