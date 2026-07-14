import { useEffect, useLayoutEffect, useState } from 'react';

const PHONE_MAX_WIDTH = 820;

function standaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function currentViewportWidth() {
  return Math.round(window.visualViewport?.width ?? window.innerWidth ?? document.documentElement.clientWidth);
}

export function detectPhoneLayout() {
  if (typeof window === 'undefined') return false;
  const width = currentViewportWidth();
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return width <= PHONE_MAX_WIDTH || (standaloneMode() && coarsePointer && width <= 1024);
}

function markDevice(phone: boolean) {
  document.documentElement.dataset.device = phone ? 'phone' : 'desktop';
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && detectPhoneLayout());

  useLayoutEffect(() => {
    const update = () => {
      const next = detectPhoneLayout();
      markDevice(next);
      setMobile(next);
    };

    update();
    const media = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    media.addEventListener('change', update);
    window.addEventListener('resize', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });

    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return mobile;
}

export function resetAppScroll() {
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
  const scrollers = document.querySelectorAll<HTMLElement>('[data-app-scroll], .m-career-content, .m-public-scroll');
  scrollers.forEach(scroller => scroller.scrollTo(0, 0));
}

export function useScrollReset(...keys: unknown[]) {
  useLayoutEffect(() => {
    resetAppScroll();
    const frameOne = window.requestAnimationFrame(resetAppScroll);
    const frameTwo = window.requestAnimationFrame(() => window.requestAnimationFrame(resetAppScroll));
    const timer = window.setTimeout(resetAppScroll, 90);
    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
      window.clearTimeout(timer);
    };
    // Navigation keys intentionally define reset points.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys);
}
