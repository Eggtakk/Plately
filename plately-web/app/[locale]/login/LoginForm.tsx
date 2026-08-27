'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/useSession';
import styles from './login.module.css';

export function LoginForm() {
  const t = useTranslations('login');
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function go(as: string | null) {
    signIn(as);
    router.replace('/onboarding/language');
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.h}>{t('title')}</h1>
      <p className={styles.sub}>{t('subtitle')}</p>
      <form
        className={styles.form}
        onSubmit={(e) => { e.preventDefault(); go(email.trim() ? email.trim() : null); }}
      >
        <label className={styles.field}>
          <span>{t('emailLabel')}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className={styles.field}>
          <span>{t('passwordLabel')}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button type="submit" className={styles.primary}>{t('signIn')}</button>
      </form>
      <button type="button" className={styles.ghost} onClick={() => go(null)}>{t('guest')}</button>
    </div>
  );
}
