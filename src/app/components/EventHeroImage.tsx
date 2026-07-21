'use client';

import Image from 'next/image';
import { useManagementClasses } from './ManagementSurface';

export function EventHeroImage({
  image,
  title,
}: {
  image?: { url: string; alt?: string | null } | null;
  title: string;
}) {
  const classes = useManagementClasses();
  const placeholderLogo = classes.isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';

  return (
    <div
      className={`${classes.subtlePanel} relative mb-6 aspect-[16/7] overflow-hidden rounded-lg`}
    >
      <Image
        alt={image?.alt || `${title} event`}
        className={image?.url ? 'object-cover' : 'object-contain p-10'}
        fill
        priority
        sizes="(min-width: 1024px) 896px, 100vw"
        src={image?.url || placeholderLogo}
        unoptimized={Boolean(image?.url)}
      />
    </div>
  );
}
