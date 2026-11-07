export function exerciseMediaStatus(url: string, viewed = false): Promise<boolean> {
  return new Promise(resolve => {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) { resolve(false); return; }
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => { channel.port1.close(); resolve(false); }, 3000);
    channel.port1.onmessage = event => { window.clearTimeout(timer); channel.port1.close(); resolve(event.data?.cached === true); };
    worker.postMessage({ type: viewed ? 'MEDIA_VIEWED' : 'MEDIA_STATUS', url }, [channel.port2]);
  });
}
