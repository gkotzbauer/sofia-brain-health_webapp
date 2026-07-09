import { useEffect, useState } from 'react';

const SIZES = ['S', 'M', 'L', 'XL'] as const;
export type TextSize = (typeof SIZES)[number];

const SCALE: Record<TextSize, number> = { S: 0.9, M: 1, L: 1.15, XL: 1.35 };
const STORAGE_KEY = 'sofia_text_size';

export function useTextSize() {
  const [size, setSize] = useState<TextSize>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as TextSize | null;
    return stored && (SIZES as readonly string[]).includes(stored) ? stored : 'M';
  });

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(SCALE[size]));
    localStorage.setItem(STORAGE_KEY, size);
  }, [size]);

  return { size, setSize, sizes: SIZES };
}
