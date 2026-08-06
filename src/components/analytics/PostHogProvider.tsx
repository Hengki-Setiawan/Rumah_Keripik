'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { posthog } from 'posthog-js';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  useEffect(() => {
    if (!KEY) return;

    if (!posthog.__loaded) {
      posthog.init(KEY, {
        api_host: HOST,
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        persistence: 'localStorage',
      });
    }

    // Skip the first run (init already captured the initial pageview).
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    posthog.capture('$pageview', {
      path: pathname,
      search: searchParams?.toString() ?? '',
    });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
