import { memo } from 'react';

export const BodyGuide = memo(function BodyGuide({
  side = false,
  focus,
}: {
  side?: boolean;
  focus?: string;
}) {
  return (
    <svg
      viewBox="0 0 300 500"
      className="body-guide"
      data-focus={focus}
      aria-label={
        side
          ? 'Side body positioning outline'
          : 'Front body positioning outline'
      }
      role="img"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="7 6"
      >
        <ellipse cx="150" cy="59" rx={side ? 23 : 28} ry="35" />
        <path
          d={
            side
              ? 'M141 94 Q115 110 125 175 L119 238 Q122 262 140 277 L129 425 L124 458 L159 458 L158 420 L171 278 Q187 244 172 209 L174 136 Q177 107 159 94'
              : 'M135 94 L115 106 L93 122 L55 242 L68 249 L111 153 L115 247 L102 436 L99 458 L128 458 L150 289 L172 458 L201 458 L198 436 L185 247 L189 153 L232 249 L245 242 L207 122 L185 106 L165 94'
          }
        />
      </g>
      <g stroke="currentColor" opacity=".4">
        <path d="M84 156 H216 M104 210 H196 M105 254 H195" />
        <path d="M150 16 V481" strokeDasharray="2 8" />
      </g>
      <g
        className="body-guide__regions"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <path
          className="body-guide__region body-guide__region--neck"
          d="M133 94 H167"
        />
        <path
          className="body-guide__region body-guide__region--shoulders"
          d="M113 105 H187"
        />
        {focus === undefined ? (
          <path
            className="body-guide__region body-guide__region--torso"
            d="M112 175 H188 M106 240 H194"
          />
        ) : (
          <>
            <path
              className="body-guide__region body-guide__region--chest"
              d={side ? 'M125 175 H174' : 'M112 175 H188'}
            />
            <path
              className="body-guide__region body-guide__region--waist"
              d={side ? 'M120 214 H174' : 'M118 214 H182'}
            />
            <path
              className="body-guide__region body-guide__region--hips"
              d={side ? 'M124 252 H180' : 'M115 252 H185'}
            />
            <path
              className="body-guide__region body-guide__region--torso"
              d="M150 113 V242"
            />
            <path
              className="body-guide__region body-guide__region--legs"
              d="M133 286 L117 432 M167 286 L183 432"
            />
          </>
        )}
        <path
          className="body-guide__region body-guide__region--arms"
          d="M112 111 L61 243 M188 111 L239 243"
        />
      </g>
    </svg>
  );
});
