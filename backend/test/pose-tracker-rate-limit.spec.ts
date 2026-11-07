import { describe, expect, it, vi } from 'vitest';
import { PoseTrackerRateLimitGuard } from '../src/pose-tracker/pose-tracker-rate-limit.guard.js';

function harness() {
  const buckets=new Map<string,number>();
  const model={findOneAndUpdate:vi.fn(async (filter:{_id:string})=>{const hits=(buckets.get(filter._id)??0)+1;buckets.set(filter._id,hits);return {hits};})};
  const guard=new PoseTrackerRateLimitGuard(model as never);
  const request=(userId:string,ip:string)=>{const response={setHeader:vi.fn()};return {response,context:{switchToHttp:()=>({getRequest:()=>({user:{userId},ip}),getResponse:()=>response})} as never};};
  return {guard,model,request};
}
describe('PoseTracker shared launch limits',()=>{
  it('limits each user across changing IPs',async()=>{const h=harness();for(let i=0;i<10;i++)expect(await h.guard.canActivate(h.request('one',`ip${i}`).context)).toBe(true);const next=h.request('one','different');await expect(h.guard.canActivate(next.context)).rejects.toMatchObject({status:429});expect(next.response.setHeader).toHaveBeenCalledWith('Retry-After',expect.any(String));});
  it('limits a shared IP across different users',async()=>{const h=harness();for(let i=0;i<30;i++)expect(await h.guard.canActivate(h.request(`user${i}`,'same-ip').context)).toBe(true);await expect(h.guard.canActivate(h.request('other','same-ip').context)).rejects.toMatchObject({status:429});});
  it('fails closed without identity or when storage fails, without disclosing the error',async()=>{const h=harness();await expect(h.guard.canActivate(h.request('','ip').context)).rejects.toMatchObject({status:503});h.model.findOneAndUpdate.mockRejectedValueOnce(new Error('private diagnostic'));await expect(h.guard.canActivate(h.request('user','ip').context)).rejects.toThrow('temporarily unavailable');});
});
