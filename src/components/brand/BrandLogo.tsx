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
      src={isMark ? '/brand/rumah-keripik-mark.svg' : '/brand/rumah-keripik-logo.svg'}
      alt="Logo Rumah Keripik"
      width={isMark ? 256 : 720}
      height={isMark ? 256 : 220}
      priority={priority}
      className={className}
    />
  );
}
