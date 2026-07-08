'use client';

import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'full' | 'mark';
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ variant = 'full', className, priority = false }: BrandLogoProps) {
  const isMark = variant === 'mark';

  return (
    <Image
      src={isMark ? '/brand/rumah-keripik-mark.png' : '/brand/rumah-keripik-logo.png'}
      alt="Logo Rumah Keripik"
      width={isMark ? 512 : 951}
      height={isMark ? 512 : 500}
      priority={priority}
      className={className}
    />
  );
}
