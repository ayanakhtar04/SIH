import React, { useEffect, useRef } from 'react';
import { useDarkMode } from './DarkModeContext';

// Enhanced theme transition: radial ripple expanding from last pointer (or center) +
// subtle per-surface fade/scale. Respects prefers-reduced-motion.
const ThemeTransition: React.FC = () => {
  const { dark } = useDarkMode();
  const prev = useRef<boolean>(dark);
  const lastPoint = useRef<{x:number,y:number} | null>(null);

  // Capture last pointer to originate ripple
  useEffect(() => {
    const handler = (e: PointerEvent) => { lastPoint.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointerdown', handler, { passive: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  useEffect(() => {
    if (prev.current === dark) return; // first mount or no change
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      prev.current = dark;
      return;
    }
    // Determine origin
    const origin = lastPoint.current || { x: window.innerWidth/2, y: window.innerHeight/2 };
    const furthestCornerDist = Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(window.innerWidth-origin.x, origin.y),
      Math.hypot(origin.x, window.innerHeight-origin.y),
      Math.hypot(window.innerWidth-origin.x, window.innerHeight-origin.y)
    );
    const el = document.createElement('div');
    el.className = 'pk-theme-ripple';
    el.style.setProperty('--pk-ripple-x', origin.x + 'px');
    el.style.setProperty('--pk-ripple-y', origin.y + 'px');
    el.style.setProperty('--pk-ripple-radius', furthestCornerDist + 'px');
    el.setAttribute('data-from', prev.current ? 'dark' : 'light');
    el.setAttribute('data-to', dark ? 'dark' : 'light');
    document.body.appendChild(el);
    // Force reflow
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight;
    el.classList.add('animate');
    const remove = () => { el.classList.add('fade'); setTimeout(() => el.remove(), 400); };
    const t = setTimeout(remove, 900);
    prev.current = dark;

    // Surface fade/scale
    const surfaces = Array.from(document.querySelectorAll('.MuiPaper-root, .MuiAppBar-root, .MuiCard-root')) as HTMLElement[];
    surfaces.forEach((s,i)=> {
      s.classList.add('pk-surface-transition');
      s.style.setProperty('--pk-surface-delay', (40 + i*12) + 'ms');
    });
    const cleanup = () => surfaces.forEach(s=> s.classList.remove('pk-surface-transition'));
    const t2 = setTimeout(cleanup, 1000);
    return () => { clearTimeout(t); clearTimeout(t2); el.remove(); cleanup(); };
  }, [dark]);

  return null;
};

export default ThemeTransition;
