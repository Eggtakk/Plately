'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme';
import styles from './ThemeToggle.module.css';

const order: Theme[] = ['system', 'light', 'dark'];

export function ThemeToggle() {
  const t = useTranslations('theme');
  const [theme, setLocal] = useState<Theme>('system');
  useEffect(() => setLocal(getStoredTheme()), []);

  function cycle() {
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    setLocal(next);
  }
  return (
    <button type="button" className={styles.btn} onClick={cycle} aria-label={`${t(theme)}`}>
      {theme === 'dark' ? '◑' : theme === 'light' ? '☀' : '◐'}
    </button>
  );
}
