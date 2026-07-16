import { lazy, Suspense } from 'react';
import type { TopoExpeditionProps } from '../topography/TopoExpeditionPrototype';

const LazyTopoExpedition = lazy(async () => {
  const module = await import('../topography/TopoExpeditionPrototype');
  return { default: module.TopoExpeditionPrototype };
});

export function TopoExpeditionLoader(props: TopoExpeditionProps) {
  return (
    <Suspense fallback={<main className="mg-app"><header className="mg-header"><div><span>ALPINE LEGACY / 0.20.0</span><h1>Загрузка экспедиции</h1></div></header></main>}>
      <LazyTopoExpedition {...props} />
    </Suspense>
  );
}
