import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const PRODUCT_POP_MS = 220;

export default function useProductPop() {
  const navigate = useNavigate();
  const [popping, setPopping] = useState(false);
  const navigatingRef = useRef(false);

  const startPop = useCallback(() => {
    if (!navigatingRef.current) setPopping(true);
  }, []);

  const endPop = useCallback(() => {
    if (!navigatingRef.current) setPopping(false);
  }, []);

  const handleProductLinkClick = useCallback(
    (e, path) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      e.preventDefault();
      navigatingRef.current = true;
      setPopping(true);

      window.setTimeout(() => {
        navigate(path);
        navigatingRef.current = false;
        setPopping(false);
      }, PRODUCT_POP_MS);
    },
    [navigate]
  );

  const linkPopHandlers = {
    onPointerDown: startPop,
    onPointerUp: endPop,
    onPointerLeave: endPop,
    onPointerCancel: endPop,
  };

  return {
    popping,
    popClass: popping ? 'is-popping' : '',
    handleProductLinkClick,
    linkPopHandlers,
  };
}
