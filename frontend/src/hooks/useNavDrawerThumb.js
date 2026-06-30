import { useEffect } from 'react';
import { createNavThumbAudio } from '../utils/navThumbSound';

const ITEM_SELECTOR = '.nav-drawer-item';
const ORB_BASE = 0.52;
const ORB_ITEM = 0.82;

/** Fast spring — one motion language for pill + orb scale */
function springStep(current, target, velocity, stiffness, damping) {
  velocity += (target - current) * stiffness;
  velocity *= damping;
  return { value: current + velocity, velocity };
}

export default function useNavDrawerThumb(menuOpen) {
  useEffect(() => {
    if (!menuOpen) return undefined;

    const drawer = document.getElementById('main-nav');
    if (!drawer) return undefined;

    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const touchMode = !finePointer;

    const audio = createNavThumbAudio();

    let raf = 0;
    let tracking = false;
    let hovering = false;
    let pointerId = null;

    let fingerX = 0;
    let fingerY = 0;
    let orbX = 0;
    let orbY = 0;
    let orbVelX = 0;
    let orbVelY = 0;
    let orbScale = ORB_BASE;
    let orbScaleTarget = ORB_BASE;
    let orbScaleVel = 0;

    let pillY = 0;
    let pillH = 48;
    let pillTargetY = 0;
    let pillTargetH = 48;
    let pillVelY = 0;
    let pillOpacity = 0;
    let pillOpacityTarget = 0;

    let lastHitX = 0;
    let lastHitY = 0;
    let activeItem = null;

    const pill = document.createElement('div');
    pill.className = 'nav-focus-pill';
    pill.setAttribute('aria-hidden', 'true');

    const orb = document.createElement('div');
    orb.className = 'nav-thumb-orb';
    orb.setAttribute('aria-hidden', 'true');
    orb.innerHTML = '<span class="nav-thumb-orb-glow"></span><span class="nav-thumb-orb-dot"></span>';

    drawer.prepend(pill);
    drawer.prepend(orb);

    if (finePointer) {
      drawer.classList.add('nav-drawer--fine-pointer');
    }
    if (touchMode) {
      drawer.classList.add('nav-drawer--touch-thumb');
    }

    const orbStiffness = touchMode ? 0.72 : 0.38;
    const orbDamping = touchMode ? 0.62 : 0.74;
    const pillStiffness = touchMode ? 0.52 : 0.34;
    const pillDamping = touchMode ? 0.72 : 0.78;
    const scaleStiffness = 0.48;
    const scaleDamping = 0.68;

    const paintOrb = () => {
      orb.style.setProperty('--orb-scale', orbScale.toFixed(3));
      orb.style.transform = `translate3d(${orbX}px, ${orbY}px, 0) translate(-50%, -50%)`;
    };

    const paintPill = () => {
      pill.style.transform = `translate3d(0, ${pillY}px, 0)`;
      pill.style.height = `${pillH}px`;
      pill.style.opacity = pillOpacity.toFixed(3);
    };

    const syncPillToItem = (item) => {
      if (!item) {
        pillOpacityTarget = 0;
        orbScaleTarget = ORB_BASE;
        return;
      }

      const drawerRect = drawer.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      pillTargetY = itemRect.top - drawerRect.top + drawer.scrollTop;
      pillTargetH = itemRect.height;
      pillOpacityTarget = 1;
      orbScaleTarget = ORB_ITEM;
    };

    const clearActive = () => {
      drawer.classList.remove('nav-drawer--thumb-visible');
      if (activeItem) {
        activeItem.classList.remove('nav-item--thumb-active');
        activeItem = null;
      }
      pillOpacityTarget = 0;
      orbScaleTarget = ORB_BASE;
    };

    const setActiveItem = (item) => {
      if (activeItem === item) return;

      if (activeItem) activeItem.classList.remove('nav-item--thumb-active');
      activeItem = item;

      if (item) {
        item.classList.add('nav-item--thumb-active');
        syncPillToItem(item);
        audio.hoverTick();
      } else {
        syncPillToItem(null);
      }
    };

    const highlightAt = (clientX, clientY) => {
      if (
        Math.abs(clientX - lastHitX) < 1.5
        && Math.abs(clientY - lastHitY) < 1.5
        && activeItem
      ) {
        return;
      }

      lastHitX = clientX;
      lastHitY = clientY;

      const target = document.elementFromPoint(clientX, clientY);
      const item = target?.closest(ITEM_SELECTOR) ?? null;
      setActiveItem(item);
    };

    const setFinger = (clientX, clientY) => {
      const rect = drawer.getBoundingClientRect();
      fingerX = clientX - rect.left;
      fingerY = clientY - rect.top + drawer.scrollTop;
      drawer.classList.add('nav-drawer--thumb-visible');

      if (touchMode && tracking) {
        orbX = fingerX;
        orbY = fingerY;
        orbVelX = 0;
        orbVelY = 0;
      }

      highlightAt(clientX, clientY);
    };

    const tick = () => {
      raf = 0;

      if (!touchMode || !tracking) {
        const orbSpringX = springStep(orbX, fingerX, orbVelX, orbStiffness, orbDamping);
        orbX = orbSpringX.value;
        orbVelX = orbSpringX.velocity;

        const orbSpringY = springStep(orbY, fingerY, orbVelY, orbStiffness, orbDamping);
        orbY = orbSpringY.value;
        orbVelY = orbSpringY.velocity;
      }

      const scaleSpring = springStep(orbScale, orbScaleTarget, orbScaleVel, scaleStiffness, scaleDamping);
      orbScale = scaleSpring.value;
      orbScaleVel = scaleSpring.velocity;

      const pillSpring = springStep(pillY, pillTargetY, pillVelY, pillStiffness, pillDamping);
      pillY = pillSpring.value;
      pillVelY = pillSpring.velocity;
      pillH += (pillTargetH - pillH) * (touchMode ? 0.42 : 0.28);
      pillOpacity += (pillOpacityTarget - pillOpacity) * (touchMode ? 0.38 : 0.22);

      paintOrb();
      paintPill();

      if (!touchMode || !tracking) {
        const rect = drawer.getBoundingClientRect();
        highlightAt(rect.left + orbX, rect.top + orbY - drawer.scrollTop);
      }

      const moving = tracking
        || hovering
        || Math.abs(orbVelX) > 0.08
        || Math.abs(orbVelY) > 0.08
        || Math.abs(pillVelY) > 0.08
        || Math.abs(orbScale - orbScaleTarget) > 0.004
        || Math.abs(pillY - pillTargetY) > 0.4
        || Math.abs(pillOpacity - pillOpacityTarget) > 0.02;

      if (moving) {
        raf = requestAnimationFrame(tick);
      }
    };

    const startLoop = () => {
      if (raf) return;
      raf = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      audio.unlock();
      tracking = true;
      pointerId = e.pointerId;
      drawer.setPointerCapture(e.pointerId);
      setFinger(e.clientX, e.clientY);
      if (touchMode) {
        orbX = fingerX;
        orbY = fingerY;
      }
      paintOrb();
      startLoop();
    };

    const onPointerMove = (e) => {
      if (tracking && pointerId === e.pointerId) {
        setFinger(e.clientX, e.clientY);
        if (touchMode) {
          orbX = fingerX;
          orbY = fingerY;
          paintOrb();
        }
        if (!raf) startLoop();
        return;
      }

      if (finePointer && e.pointerType === 'mouse') {
        hovering = true;
        setFinger(e.clientX, e.clientY);
        startLoop();
      }
    };

    const onPointerUp = (e) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;

      if (activeItem && tracking) {
        audio.selectClick();
        orb.style.setProperty('--orb-click', '1');
        window.setTimeout(() => orb.style.removeProperty('--orb-click'), 140);
      }

      tracking = false;
      if (drawer.hasPointerCapture?.(e.pointerId)) {
        drawer.releasePointerCapture(e.pointerId);
      }
      pointerId = null;

      if (finePointer && e.clientX) {
        hovering = true;
        setFinger(e.clientX, e.clientY);
        startLoop();
        return;
      }

      if (!hovering) {
        stopLoop();
        clearActive();
        paintOrb();
        paintPill();
      }
    };

    const onMouseEnter = (e) => {
      if (!finePointer) return;
      hovering = true;
      if (e.clientX) setFinger(e.clientX, e.clientY);
      startLoop();
    };

    const onMouseLeave = () => {
      hovering = false;
      if (!tracking) {
        stopLoop();
        clearActive();
        paintOrb();
        paintPill();
      }
    };

    drawer.addEventListener('pointerdown', onPointerDown);
    drawer.addEventListener('pointermove', onPointerMove);
    drawer.addEventListener('pointerup', onPointerUp);
    drawer.addEventListener('pointercancel', onPointerUp);
    drawer.addEventListener('mouseenter', onMouseEnter);
    drawer.addEventListener('mouseleave', onMouseLeave);

    return () => {
      stopLoop();
      drawer.removeEventListener('pointerdown', onPointerDown);
      drawer.removeEventListener('pointermove', onPointerMove);
      drawer.removeEventListener('pointerup', onPointerUp);
      drawer.removeEventListener('pointercancel', onPointerUp);
      drawer.removeEventListener('mouseenter', onMouseEnter);
      drawer.removeEventListener('mouseleave', onMouseLeave);
      drawer.classList.remove('nav-drawer--fine-pointer', 'nav-drawer--touch-thumb');
      pill.remove();
      orb.remove();
      clearActive();
    };
  }, [menuOpen]);
}
