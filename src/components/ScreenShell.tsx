import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  topLabel?: string;
  rightLabel?: string;
  onBack?: () => void;
  onPrint?: () => void;
};

export function ScreenShell({ children, topLabel = 'ALPINE LEGACY', rightLabel = 'FIELD ARCHIVE / 01', onBack, onPrint }: Props) {
  const appIcon = `${import.meta.env.BASE_URL}icons/icon-48.png`;
  return (
    <main className="screen-shell">
      <header className="museum-header">
        <div className="museum-header__left">
          {onBack
            ? <button className="text-button" onClick={onBack}>← Назад</button>
            : <span className="museum-header__brand"><img src={appIcon} alt="" width="48" height="48" draggable={false} /><b>ALPINE LEGACY</b></span>}
        </div>
        <div className="museum-header__center">{topLabel}</div>
        <div className="museum-header__right">
          <span>{rightLabel}</span>
          {onPrint && <button className="icon-button" onClick={onPrint} aria-label="Печать">⎙</button>}
        </div>
      </header>
      {children}
    </main>
  );
}
