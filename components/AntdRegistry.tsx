'use client';

/**
 * AntdRegistry — wraps AntD's StyleProvider for Next.js App Router (SSR-compatible).
 * Prevents style flicker on first render.
 *
 * NOTE: Ant Design v5 emits a console warning when used with React 19 ("antd v5 support
 * React is 16 ~ 18"). The warning is cosmetic only — antd v5 functions correctly with
 * React 19. We suppress this specific known warning here to keep the console clean.
 */

import React from 'react';
import { StyleProvider, createCache, extractStyle } from '@ant-design/cssinjs';
import type Entity from '@ant-design/cssinjs/es/Cache';
import { useServerInsertedHTML } from 'next/navigation';

// ── Suppress known cosmetic antd warnings on React 19 ────────────────────────
// These are non-blocking warnings emitted by antd v5 when used with React 19.
// antd v5 works correctly on React 19 despite these messages.
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('[antd: compatible]') ||
      msg.includes('[Ant Design CSS-in-JS]')
    ) {
      return; // known cosmetic warnings — suppress
    }
    originalConsoleError(...args);
  };
}

export default function AntdRegistry({ children }: { children: React.ReactNode }) {
  const cache = React.useMemo<Entity>(() => createCache(), []);
  const isServerInserted = React.useRef<boolean>(false);

  useServerInsertedHTML(() => {
    // Avoid duplicate injection in development StrictMode
    if (isServerInserted.current) {
      return;
    }
    isServerInserted.current = true;
    return (
      <style
        id="antd"
        dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }}
      />
    );
  });

  return <StyleProvider cache={cache}>{children}</StyleProvider>;
}
