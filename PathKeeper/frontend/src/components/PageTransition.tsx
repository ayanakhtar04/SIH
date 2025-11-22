import React, { useEffect, useRef, useState } from 'react';

// Minimal CSS class toggler that relies on index.css defined classes:
// .pk-page-fade-enter, .pk-page-fade-enter-active, .pk-page-fade-exit, .pk-page-fade-exit-active
// We clone the previous child to animate it out while animating new one in.

interface PageTransitionProps {
  pageKey: string; // unique key for current logical page
  children: React.ReactNode;
  variant?: 'fade' | 'slide' | 'scale' | 'stack';
  direction?: 'forward' | 'backward'; // used for slide horizontal direction
  durationEnter?: number; // ms (for cleanup timing only)
  durationExit?: number; // ms (for cleanup timing only)
}

const PageTransition: React.FC<PageTransitionProps> = ({ pageKey, children, variant='fade', direction='forward', durationEnter=500, durationExit=380 }) => {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [items, setItems] = useState<Array<{ key: string; node: React.ReactNode; state: 'enter' | 'exit' }>>([
    { key: pageKey, node: children, state: 'enter' }
  ]);
  const prevKeyRef = useRef(pageKey);

  useEffect(() => {
    if (pageKey === prevKeyRef.current) {
      // Same page, just update node in place.
      setItems([{ key: pageKey, node: children, state: 'enter' }]);
      return;
    }
    // Add new page as entering, mark old as exiting
    setItems(cur => {
      const prev = cur.find(i => i.key === prevKeyRef.current);
      const exiting: typeof cur = prev ? [{ ...prev, state: 'exit' }] : [];
      return [ ...exiting, { key: pageKey, node: children, state: 'enter' } ];
    });
    prevKeyRef.current = pageKey;
  }, [pageKey, children]);

  useEffect(() => {
    // Cleanup exit items after durationExit
    if (reduceMotion) return; // no delayed cleanup needed (no exit animation)
    if (items.some(i => i.state === 'exit')) {
      const t = setTimeout(() => {
        setItems(cur => cur.filter(i => i.state !== 'exit'));
      }, durationExit + 20);
      return () => clearTimeout(t);
    }
  }, [items, durationExit]);

  return (
    <div className="pk-page-container" style={{ position: 'relative', minHeight: '100%', width: '100%' }}>
      {items.map(item => {
        const base = (() => {
          switch (variant) {
            case 'slide': return 'pk-page-slide';
            case 'scale': return 'pk-page-scale';
            case 'stack': return 'pk-page-stack';
            case 'fade':
            default: return 'pk-page-fade';
          }
        })();
        const stageClass = reduceMotion
          ? ''
          : item.state === 'exit' ? `${base}-exit ${base}-exit-active` : `${base}-enter ${base}-enter-active`;
        return (
          <div
            key={item.key + item.state}
            className={stageClass}
            style={{
              position: (item.state === 'exit' ? 'absolute' : 'relative') as React.CSSProperties['position'],
              inset: 0,
              willChange: reduceMotion ? undefined : 'opacity, transform',
              ...(variant === 'slide' ? { ['--pk-dir' as any]: direction === 'forward' ? '48px' : '-48px' } : {})
            } as React.CSSProperties}
          >
            {item.node}
          </div>
        );
      })}
    </div>
  );
};

export default PageTransition;
