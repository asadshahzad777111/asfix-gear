/** Secondary display fonts — after first paint */
export function loadDisplayFonts() {
  if (typeof window === 'undefined') return;

  const run = () => {
    if (document.getElementById('asfix-display-fonts')) return;
    const link = document.createElement('link');
    link.id = 'asfix-display-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&display=swap';
    document.head.appendChild(link);
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 1200);
  }
}
