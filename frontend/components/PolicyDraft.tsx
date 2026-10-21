import Link from 'next/link';

export default function PolicyDraft({ title }: { title: string }) {
  return <main className="policy-draft">
    <h1>{title}</h1>
    <p>Draft, pending team review</p>
    <section aria-label={`${title} content`} />
    <Link href="/register">Back to registration</Link>
  </main>;
}
