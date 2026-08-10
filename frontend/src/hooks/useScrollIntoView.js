import { useEffect, useRef } from 'react';

export default function useScrollIntoView(deep) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (deep) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [deep]);

  return ref;
}