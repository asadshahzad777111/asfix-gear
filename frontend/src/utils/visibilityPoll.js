/** Poll only while tab is visible — saves battery and network on mobile */
export function startVisibilityPoll(fn, intervalMs) {
  let id = null;

  const run = () => {
    if (!document.hidden) fn();
  };

  const stop = () => {
    if (id) {
      clearInterval(id);
      id = null;
    }
  };

  const start = () => {
    stop();
    run();
    id = setInterval(run, intervalMs);
  };

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  start();
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
