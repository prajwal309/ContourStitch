type FocusRegion = 'upper-body' | 'arms' | 'torso' | 'neck' | null;

export function BodyGuide({
  side = false,
  focus = null,
}: {
  side?: boolean;
  focus?: FocusRegion;
}) {
  return (
    <svg
      viewBox="0 0 300 500"
      className="body-guide"
      data-focus={focus ?? undefined}
      aria-label={side ? 'Side body positioning outline' : 'Front body positioning outline'}
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
        <path className="body-guide__region body-guide__region--neck" d="M133 94 H167" />
        <path className="body-guide__region body-guide__region--shoulders" d="M113 105 H187" />
        <path className="body-guide__region body-guide__region--torso" d="M112 175 H188 M106 240 H194" />
        <path className="body-guide__region body-guide__region--arms" d="M112 111 L61 243 M188 111 L239 243" />
      </g>
    </svg>
  );
}
