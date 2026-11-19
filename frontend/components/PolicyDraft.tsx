import Link from 'next/link';
import { PolicyDocument, policyTitles, type PolicyKind } from './PolicyDocuments';

export default function PolicyDraft({ kind }: { kind: PolicyKind }) {
  return <main className="policy-draft">
    <h1>{policyTitles[kind]}</h1>
    <PolicyDocument kind={kind}/>
    <Link href="/register">Back to registration</Link>
  </main>;
}
