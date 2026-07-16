import { useEffect, useState } from 'react';

export type RuntimeNoticeDetail = {
  id?: string;
  tone?: 'INFO' | 'WARNING' | 'DANGER';
  title: string;
  message: string;
  timeoutMs?: number;
};

export const RUNTIME_NOTICE_EVENT = 'alpine-runtime-notice';

export function pushRuntimeNotice(detail: RuntimeNoticeDetail) {
  window.dispatchEvent(new CustomEvent<RuntimeNoticeDetail>(RUNTIME_NOTICE_EVENT, { detail }));
}

export function RuntimeNotice() {
  const [notice, setNotice] = useState<(RuntimeNoticeDetail & { key: string }) | null>(null);

  useEffect(() => {
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<RuntimeNoticeDetail>).detail;
      if (!detail?.title || !detail?.message) return;
      setNotice({ ...detail, key: detail.id ?? `${Date.now()}-${Math.random()}` });
    };
    window.addEventListener(RUNTIME_NOTICE_EVENT, onNotice);
    return () => window.removeEventListener(RUNTIME_NOTICE_EVENT, onNotice);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(current => current?.key === notice.key ? null : current), notice.timeoutMs ?? 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <aside className={`runtime-notice is-${(notice.tone ?? 'INFO').toLowerCase()}`} role="status" aria-live="polite">
      <div><strong>{notice.title}</strong><p>{notice.message}</p></div>
      <button onClick={() => setNotice(null)} aria-label="Закрыть уведомление">×</button>
    </aside>
  );
}
