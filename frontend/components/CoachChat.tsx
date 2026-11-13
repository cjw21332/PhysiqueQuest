'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '../sections/Home/icons';
import { api, ApiRequestError, ApiTimeoutError, getApiBaseUrl } from '../lib/api';
import { session } from '../lib/session';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

// Replies are plain text. Metadata may still be returned by older API versions.
function visibleReply(reply: string) {
  const footer = /(?:^|\s)(?:sources?|references?)\s*:/i.exec(reply);
  return (footer ? reply.slice(0, footer.index) : reply).trim() || 'Ask me about a PhysiqueQuest page or your saved records.';
}

function sessionIdentity() {
  try {
    const base = getApiBaseUrl();
    const current = session.current(base);
    return current ? `${base}:${current.id}:${current.sessionKey}` : null;
  } catch { return null; }
}

export default function CoachChat() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [includePersonalData, setIncludePersonalData] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const submitted = useRef<{ text: string; previous: ChatMessage[] } | null>(null);

  const clearChat = () => {
    generation.current++;
    activeRequest.current?.abort();
    activeRequest.current = null;
    submitted.current = null;
    pending.current = false;
    setMessages([]);
    setText('');
    setError('');
    setNotice('');
    setBusy(false);
  };

  useEffect(() => {
    let identity = sessionIdentity();
    const endSession = () => {
      clearChat();
      setIncludePersonalData(false);
      dialog.current?.close();
    };
    const checkSession = () => {
      const nextIdentity = sessionIdentity();
      // Access-token refresh keeps the same account and session generation.
      if (identity !== nextIdentity) endSession();
      identity = nextIdentity;
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'physiquequest-runtime-api-url') checkSession();
    };
    const unsubscribe = session.subscribe(checkSession);
    window.addEventListener('physiquequest:session-ended', endSession);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', checkSession);
    return () => {
      generation.current++;
      activeRequest.current?.abort();
      unsubscribe();
      window.removeEventListener('physiquequest:session-ended', endSession);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', checkSession);
    };
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);

  const ask = async (question: string) => {
    const value = question.trim();
    if (!value || pending.current) return;
    const currentGeneration = generation.current;
    const next: ChatMessage[] = [...messages, { role: 'user', text: value }];
    pending.current = true;
    const controller = new AbortController();
    activeRequest.current = controller;
    submitted.current = { text: value, previous: messages };
    setMessages(next);
    setText('');
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await api.chat(next.slice(-11).map(({ role, text }) => ({ role, text })), includePersonalData, pathname ?? undefined, controller.signal);
      if (currentGeneration === generation.current) {
        setMessages(current => [...current, { role: 'assistant', text: visibleReply(result.reply) }]);
      }
    } catch (failure) {
      if (currentGeneration === generation.current) {
        setError(failure instanceof ApiRequestError && failure.statusCode === 503
          ? 'Phiq’s private AI is unavailable right now. Please try again later.'
          : failure instanceof ApiRequestError && failure.statusCode === 429
            ? 'Phiq is busy. Please wait a moment before trying again.'
            : failure instanceof ApiTimeoutError
              ? 'Phiq took too long to respond. Please try again.'
              : 'Phiq couldn’t respond right now. Please try again.');
        setText(value);
        setMessages(messages);
      }
    } finally {
      if (currentGeneration === generation.current) {
        pending.current = false;
        activeRequest.current = null;
        submitted.current = null;
        setBusy(false);
        requestAnimationFrame(() => input.current?.focus());
      }
    }
  };

  const send = (event: React.FormEvent) => { event.preventDefault(); void ask(text); };
  const stopWaiting = () => {
    const current = submitted.current;
    generation.current++;
    activeRequest.current?.abort();
    activeRequest.current = null;
    submitted.current = null;
    pending.current = false;
    setBusy(false);
    setError('');
    setNotice('Stopped waiting for this response. You can edit your question and try again.');
    if (current) { setMessages(current.previous); setText(current.text); }
    requestAnimationFrame(() => input.current?.focus());
  };

  return <>
    <button ref={opener} type="button" className="coach-chat-launcher" aria-label="Open Phiq coach" onClick={() => { dialog.current?.showModal(); input.current?.focus(); }}>
      <img src="/phiq-logo.png" alt="" /><span aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="coach-chat-dialog" aria-labelledby="coach-chat-title" onClose={() => opener.current?.focus()}>
      <header className="coach-chat-header">
        <span className="coach-chat-avatar"><img src="/phiq-logo.png" alt="" /></span>
        <div><h2 id="coach-chat-title">Phiq</h2><p>Your PhysiqueQuest guide</p></div>
        <button type="button" className="coach-chat-clear" onClick={clearChat}>Clear chat</button>
        <button type="button" aria-label="Close Phiq" onClick={() => dialog.current?.close()}><Icon name="close" size={20}/></button>
      </header>
      <div className="coach-chat-messages">
        {!messages.length && <div className="coach-chat-welcome">
          <div className="coach-chat-message"><span className="coach-chat-avatar"><img src="/phiq-logo.png" alt="" /></span><p>Hi, I’m Phiq. Ask me a question, explore the app, or turn on access to discuss your saved fitness data.</p></div>
          <div className="coach-chat-prompts" role="group" aria-label="Suggested questions">
            <button type="button" disabled={busy} onClick={() => void ask('How do I use this page?')}>Explain this page</button>
            <button type="button" disabled={busy} onClick={() => void ask('Where can I find the features in PhysiqueQuest?')}>Find a feature</button>
            <button type="button" disabled={busy} onClick={() => void ask(includePersonalData ? 'What personal data can you read from my account?' : 'How do privacy controls work in PhysiqueQuest?')}>{includePersonalData ? 'My data access' : 'Privacy controls'}</button>
          </div>
        </div>}
        {messages.map((message, index) => <div className={`coach-chat-message ${message.role}`} key={index}>
          {message.role === 'assistant' && <span className="coach-chat-avatar"><img src="/phiq-logo.png" alt="" /></span>}
          <div className="coach-chat-content"><p>{message.text}</p></div>
        </div>)}
        {busy && <div className="coach-chat-pending"><p className="coach-chat-privacy" role="status">Phiq is thinking…</p><button type="button" onClick={stopWaiting}>Stop waiting</button></div>}
        {error && <div className="coach-chat-retry"><p className="coach-chat-error" role="alert">{error}</p><button type="button" disabled={!text.trim()} onClick={() => void ask(text)}>Try again</button></div>}
        {notice && <p className="coach-chat-privacy" role="status">{notice}</p>}
        <div ref={bottom}/>
      </div>
      <footer className="coach-chat-dock">
        <div className={`coach-chat-access ${includePersonalData ? 'is-enabled' : ''}`}>
          <div className="coach-chat-access-row">
            <label className="coach-chat-consent"><input type="checkbox" checked={includePersonalData} onChange={event => { clearChat(); setIncludePersonalData(event.target.checked); }} aria-describedby="coach-chat-consent-note" /><span>Use my saved fitness data</span></label>
            <span className="coach-chat-access-state" aria-live="polite">{includePersonalData ? 'On' : 'Off'}</span>
          </div>
          <p className="coach-chat-consent-note" id="coach-chat-consent-note">{includePersonalData ? 'Only relevant records from your account' : 'Turn on to ask about your saved records'}</p>
          <details className="coach-chat-access-details">
            <summary>What can Phiq access?</summary>
            <p>With access on, Phiq uses relevant records linked to your signed-in account: profile, goals, training, nutrition, progress, Quests, health profile and emergency contact. Health and contact details are included only when access is on and you ask for them. Messages are processed by PhysiqueQuest’s private AI service, not an external AI provider. Other accounts, passwords, photos and videos are never included. Chat history is not saved or used to train the assistant. Turning access off or changing accounts clears this chat.</p>
          </details>
        </div>
        <form className="coach-chat-composer" onSubmit={send}><label className="visually-hidden" htmlFor="coach-chat-input">Ask Phiq a question</label><input ref={input} id="coach-chat-input" placeholder="Ask Phiq a question…" maxLength={2000} value={text} onChange={event => setText(event.target.value)} disabled={busy} /><button type="submit" aria-label="Send message" disabled={busy || !text.trim()}><Icon name="arrow-up" size={20}/></button></form>
      </footer>
    </dialog>
  </>;
}
