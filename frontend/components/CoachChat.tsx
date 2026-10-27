'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../sections/Home/icons';
import { api } from '../lib/api';
import './coach-chat.css';

export default function CoachChat() {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  useEffect(() => { const clear = () => { generation.current++; setMessages([]); setText(''); setError(''); setBusy(false); dialog.current?.close(); }; window.addEventListener('physiquequest:session-ended', clear); return () => { generation.current++; window.removeEventListener('physiquequest:session-ended', clear); }; }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim(); if (!value || busy) return;
    const currentGeneration = generation.current;
    const next = [...messages, { role: 'user' as const, text: value }];
    setMessages(next); setText(''); setError(''); setBusy(true);
    try { const result = await api.chat(next.slice(-11)); if (currentGeneration === generation.current) setMessages(current => [...current, { role: 'assistant', text: result.reply }]); }
    catch { if (currentGeneration === generation.current) { setError('Phiq couldn’t respond right now. Please try again.'); setText(value); setMessages(messages); } }
    finally { if (currentGeneration === generation.current) setBusy(false); }
  };
  return <>
    <button ref={opener} type="button" className="coach-chat-launcher" aria-label="Open Phiq coach" onClick={() => dialog.current?.showModal()}>
      <img src="/phiq-logo.png" alt="" /><span aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="coach-chat-dialog" aria-labelledby="coach-chat-title" onClose={() => opener.current?.focus()}>
      <header className="coach-chat-header">
        <span className="coach-chat-avatar"><img src="/phiq-logo.png" alt="" /></span>
        <div><h2 id="coach-chat-title">Phiq</h2><p>Your PhysiqueQuest coach</p></div>
        <button type="button" aria-label="Close Phiq" onClick={() => dialog.current?.close()}><Icon name="close" size={20}/></button>
      </header>
      <div className="coach-chat-messages"><div className="coach-chat-message"><span className="coach-chat-avatar"><img src="/phiq-logo.png" alt="" /></span><p>Hi! I’m Phiq. Ask me about your workouts, nutrition, or progress. PhysiqueQuest was created by Group 2 | SBIT-4I from Quezon City University.</p></div><p className="coach-chat-privacy">Your conversations with Phiq are personal to your fitness journey. Your messages and relevant summaries of your profile, meals, workouts, progress, quests and, when asked, your plan or ranking are sent to Google Gemini to generate replies. Please avoid sharing sensitive information.</p>{messages.map((message, index) => <div className={`coach-chat-message ${message.role}`} key={index}>{message.role === 'assistant' && <span className="coach-chat-avatar"><img src="/phiq-logo.png" alt="" /></span>}<p>{message.text}</p></div>)}{busy && <p className="coach-chat-privacy" role="status">Phiq is thinking…</p>}{error && <p className="coach-chat-error" role="alert">{error}</p>}<div ref={bottom}/></div>
      <form className="coach-chat-composer" onSubmit={send}><label className="visually-hidden" htmlFor="coach-chat-input">Ask Phiq anything</label><input id="coach-chat-input" placeholder="Ask Phiq anything…" maxLength={2000} value={text} onChange={event => setText(event.target.value)} disabled={busy} /><button type="submit" aria-label="Send message" disabled={busy || !text.trim()}>↑</button></form>
    </dialog>
  </>;
}
