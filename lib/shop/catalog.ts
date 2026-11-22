import { labels, type MeasurementKey } from '@/lib/measurement/types';

const additionalMeasurements = {
  bust: {
    label: 'Bust circumference',
    kind: 'body',
    guide:
      'Measure horizontally around the fullest part of the bust using a flexible tape.',
  },
  neck: {
    label: 'Neck circumference',
    kind: 'body',
    guide: 'Measure around the base of the neck where a collar would sit.',
  },
  kurtaLength: {
    label: 'Preferred kurta length',
    kind: 'garment',
    guide:
      'Measure an existing kurta you like from the high shoulder to the hem.',
  },
  dressLength: {
    label: 'Preferred dress length',
    kind: 'garment',
    guide:
      'Measure from the high shoulder to the hem on a dress whose length you like.',
  },
  skirtLength: {
    label: 'Preferred skirt length',
    kind: 'garment',
    guide:
      'Measure from the waistband to the hem of a skirt whose length you like.',
  },
} as const;

export type RequiredMeasurement =
  MeasurementKey | keyof typeof additionalMeasurements;

export function measurementDefinition(key: RequiredMeasurement): {
  label: string;
  kind: 'body' | 'garment';
  guide?: string;
} {
  if (key in additionalMeasurements)
    return additionalMeasurements[key as keyof typeof additionalMeasurements];
  return { label: labels[key as MeasurementKey], kind: 'body' };
}

type Variant = {
  key: string;
  color: 'Ivory' | 'Copper';
  fabric: string;
};

export type Product = {
  key: string;
  collectionKey: string;
  name: string;
  type: string;
  age: 'Adults' | 'Children';
  style: string;
  occasions: readonly string[];
  description: string;
  image: string;
  imageAlt: string;
  variants: readonly Variant[];
  requirements: readonly RequiredMeasurement[];
};

const wedding = 'heritage-wedding';
const coordinatedVariants = [
  { key: 'ivory', color: 'Ivory', fabric: 'Textured cotton-silk blend' },
  { key: 'copper', color: 'Copper', fabric: 'Textured cotton-silk blend' },
  { key: 'ivory-linen', color: 'Ivory', fabric: 'Soft linen blend' },
  { key: 'copper-linen', color: 'Copper', fabric: 'Soft linen blend' },
] as const;

export const collections = [
  {
    key: wedding,
    name: 'The Heritage Wedding Collection',
    description:
      'A coordinated family wardrobe for wedding ceremonies and receptions. Ivory and copper carry across kurtas, lehengas and dresses, so each guest can choose their own silhouette.',
    cover: '/collections/adult-lehenga.webp',
  },
];

export const products: readonly Product[] = [
  {
    key: 'heritage-kurta',
    collectionKey: wedding,
    name: 'Heritage Kurta',
    type: 'Kurta',
    age: 'Adults',
    style: 'Classic',
    occasions: ['Wedding', 'Celebration'],
    description:
      'A straight long kurta with a band collar, clean side vents and restrained copper stitching. Pair it with the junior kurta or with the copper lehenga.',
    image: '/collections/adult-kurta.webp',
    imageAlt:
      'Ivory adult kurta with a copper embroidered neckline and straight trousers',
    variants: coordinatedVariants,
    requirements: ['chest', 'shoulder', 'sleeve', 'waist', 'kurtaLength'],
  },
  {
    key: 'heritage-lehenga',
    collectionKey: wedding,
    name: 'Heritage Lehenga',
    type: 'Lehenga',
    age: 'Adults',
    style: 'Embroidered',
    occasions: ['Wedding'],
    description:
      'A copper blouse and full skirt with a soft ivory dupatta. The woven finish picks up the same warm tones as the family kurtas.',
    image: '/collections/adult-lehenga.webp',
    imageAlt: 'Copper lehenga with a matching blouse and warm ivory dupatta',
    variants: [
      coordinatedVariants[1],
      coordinatedVariants[0],
      coordinatedVariants[3],
      coordinatedVariants[2],
    ],
    requirements: ['bust', 'waist', 'hip', 'skirtLength'],
  },
  {
    key: 'junior-kurta',
    collectionKey: wedding,
    name: 'Junior Heritage Kurta',
    type: 'Kurta',
    age: 'Children',
    style: 'Classic',
    occasions: ['Wedding', 'Celebration'],
    description:
      'An ivory junior kurta with a simple band collar and matching trousers. Copper piping echoes the adult version.',
    image: '/collections/child-kurta.webp',
    imageAlt: 'Child-size ivory kurta and trousers with copper collar piping',
    variants: coordinatedVariants,
    requirements: ['chest', 'shoulder', 'sleeve', 'waist', 'kurtaLength'],
  },
  {
    key: 'junior-occasion-dress',
    collectionKey: wedding,
    name: 'Junior Occasion Dress',
    type: 'Dress',
    age: 'Children',
    style: 'Gathered',
    occasions: ['Wedding', 'Celebration'],
    description:
      'A copper occasion dress with cap sleeves, a gathered skirt and a warm ivory sash.',
    image: '/collections/child-dress.webp',
    imageAlt: 'Child-size copper dress with cap sleeves and an ivory sash',
    variants: [
      coordinatedVariants[1],
      coordinatedVariants[0],
      coordinatedVariants[3],
      coordinatedVariants[2],
    ],
    requirements: ['chest', 'waist', 'hip', 'dressLength'],
  },
];

export const getProduct = (key: string) =>
  products.find((product) => product.key === key);
export const getCollection = (key: string) =>
  collections.find((collection) => collection.key === key);

export const facets = [
  {
    key: 'occasion',
    label: 'Occasion',
    options: [...new Set(products.flatMap((p) => p.occasions))],
  },
  {
    key: 'type',
    label: 'Clothing type',
    options: [...new Set(products.map((p) => p.type))],
  },
  {
    key: 'age',
    label: 'Age group',
    options: [...new Set(products.map((p) => p.age))],
  },
  {
    key: 'color',
    label: 'Color',
    options: [
      ...new Set(products.flatMap((p) => p.variants.map((v) => v.color))),
    ],
  },
  {
    key: 'style',
    label: 'Style',
    options: [...new Set(products.map((p) => p.style))],
  },
] as const;

export function filterCatalog(
  params: Record<string, string | string[] | undefined>,
) {
  const selected = Object.fromEntries(
    facets.map(({ key, options }) => {
      const value = params[key];
      return [
        key,
        typeof value === 'string' && options.some((option) => option === value)
          ? value
          : '',
      ];
    }),
  );
  return {
    selected,
    products: products.filter(
      (product) =>
        (!selected.occasion || product.occasions.includes(selected.occasion)) &&
        (!selected.type || product.type === selected.type) &&
        (!selected.age || product.age === selected.age) &&
        (!selected.style || product.style === selected.style) &&
        (!selected.color ||
          product.variants.some(({ color }) => color === selected.color)),
    ),
  };
}
