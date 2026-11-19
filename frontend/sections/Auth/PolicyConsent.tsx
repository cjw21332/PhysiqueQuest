'use client';

import { useEffect, useRef, useState } from 'react';
import { PolicyDocument } from '../../components/PolicyDocuments';

export default function PolicyConsent({ checked, onChange, disabled = false, openInitially = false }: {
  checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; openInitially?: boolean;
}) {
  const [open, setOpen] = useState(openInitially);
  const [reachedEnd, setReachedEnd] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  const show = () => { setReachedEnd(false); setOpen(true); };
  const onScroll = () => {
    const element = content.current;
    if (element && element.scrollTop + element.clientHeight >= element.scrollHeight - 4) setReachedEnd(true);
  };

  return <>
    <div className="consent policy-consent">
      <input id="policy-agreement" type="checkbox" required disabled={disabled} checked={checked} aria-label="Agree to the Terms and acknowledge the privacy and camera notices" onChange={event => { if (event.target.checked) show(); else onChange(false); }}/>
      <div className="policy-consent-copy"><label htmlFor="policy-agreement">I agree to the Terms and Conditions and acknowledge the Privacy and Camera notices.</label><button type="button" className="policy-inline-link" onClick={show}>Read the agreements</button></div>
    </div>
    <dialog ref={dialog} className="policy-dialog" aria-labelledby="policy-dialog-title" onCancel={event => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)}>
      <header className="policy-dialog-header"><div><p>BEFORE YOU CONTINUE</p><h2 id="policy-dialog-title">Review your agreement</h2></div><button type="button" className="policy-dialog-close" aria-label="Close agreement" onClick={() => setOpen(false)}>×</button></header>
      <div ref={content} className="policy-dialog-content" tabIndex={0} role="region" aria-label="Terms and privacy notices" onScroll={onScroll}>
        <p>Please review all three documents. Scroll to the end to continue.</p>
        <PolicyDocument kind="terms"/><PolicyDocument kind="privacy"/><PolicyDocument kind="camera"/>
      </div>
      <footer className="policy-dialog-footer"><p aria-live="polite">{reachedEnd ? 'You have reached the end.' : 'Scroll to the end to enable agreement.'}</p><button type="button" className="primary" disabled={!reachedEnd} onClick={() => { onChange(true); setOpen(false); }}>Agree and continue</button><button type="button" className="policy-not-now" onClick={() => setOpen(false)}>Not now</button></footer>
    </dialog>
  </>;
}
