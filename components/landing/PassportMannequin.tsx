import Image from 'next/image';

export function PassportMannequin() {
  return (
    <Image
      className="passport-mannequin"
      src="/models/quaternius-female/passport-front.svg"
      width={260}
      height={280}
      alt="Front-view wireframe mannequin with chest, waist and hip measurement rings."
      unoptimized
    />
  );
}
