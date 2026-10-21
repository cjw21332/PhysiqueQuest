import { outboundFetch } from '../common/outbound.js';
export type PushResult = { id?: string; error?: string; dryRun?: boolean };
export interface PushProvider {
  send(token: string): Promise<PushResult>;
  receipt(id: string): Promise<PushResult>;
}

export class DryRunPushProvider implements PushProvider {
  async send() { return { dryRun: true }; }
  async receipt() { return { dryRun: true }; }
}

export class ExpoPushProvider implements PushProvider {
  constructor(private readonly fetcher: typeof fetch = outboundFetch as typeof fetch) {}
  private async request(path: string, body: unknown) {
    const response = await this.fetcher(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Push provider unavailable');
    return await response.json() as { data: Record<string, any> };
  }
  async send(token: string): Promise<PushResult> {
    const { data } = await this.request('send', { to: token, title: 'PhysiqueQuest', body: 'You have a new notification.', sound: 'default' });
    return data.status === 'ok' && typeof data.id === 'string' ? { id: data.id } : { error: data.details?.error ?? 'ProviderError' };
  }
  async receipt(id: string): Promise<PushResult> {
    const { data } = await this.request('getReceipts', { ids: [id] });
    const receipt = data[id];
    if (!receipt) return { error: 'ReceiptPending' };
    return receipt.status === 'ok' ? {} : { error: receipt.details?.error ?? 'ProviderError' };
  }
}
