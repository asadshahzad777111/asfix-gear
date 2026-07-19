/** Secondary display fonts — after first paint */
export function loadDisplayFonts() {
  if (typeof window === 'undefined') return;

  const run = () => {
    if (document.getElementById('asfix-display-fonts')) return;
    const link = document.createElement('link');
    link.id = 'asfix-display-fonts';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap';
    document.head.appendChild(link);
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 1200);
  }
}

/** Noto Nastaliq for Urdu UI — loaded on demand when lang=ur */
export function loadUrduFont() {
  if (typeof window === 'undefined') return;
  if (document.getElementById('asfix-urdu-font')) return;
  const link = document.createElement('link');
  link.id = 'asfix-urdu-font';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}
