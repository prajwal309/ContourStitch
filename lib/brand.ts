import { measurementCopy } from './measurement/copy';

export const brand = {
  name: 'ContourStitch',
  tagline: 'One measure. Endless fits.',
  description:
    `Use ${measurementCopy.camera} or ${measurementCopy.manual} to find your fit. Review, save and reuse your measurements for tailoring, online size guides and family fittings.`,
} as const;
