import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAMERA_ACQUIRE_TIMEOUT_MS, createCameraRecovery } from '../cameraRecovery';
afterEach(()=>vi.useRealTimers());
function setup() {
  vi.useFakeTimers();let eligible=true;const starts:number[]=[],released=vi.fn(),states:any[]=[];
  const c=createCameraRecovery({start:t=>starts.push(t),release:released,eligible:()=>eligible,changed:s=>states.push(s)});
  return {c,starts,released,states,setEligible:(v:boolean)=>eligible=v};
}
describe('bounded camera recovery',()=>{
  it('background/foreground retains session ownership and clears only the pending cycle',()=>{
    const p=setup();let totals=8,cycle=true;
    p.c.start();p.c.ready(p.starts[0]);p.c.activity(false);cycle=false;
    p.c.activity(true);vi.advanceTimersByTime(500);expect(p.starts).toHaveLength(2);
    expect(totals).toBe(8);expect(cycle).toBe(false);p.c.ready(p.starts[1]);expect(p.c.snapshot().phase).toBe('ready');
  });
  it('bounds three rapid blur/focus recoveries and then provides a failed state',()=>{
    const p=setup();p.c.start();p.c.ready(p.starts[0]);
    for(const delay of [500,1000,2000]){p.c.activity(false);p.c.activity(true);vi.advanceTimersByTime(delay);p.c.ready(p.starts.at(-1)!);}
    expect(p.starts).toHaveLength(4);p.c.activity(false);p.c.activity(true);
    expect(p.c.snapshot()).toMatchObject({phase:'failed',reason:'interrupted_too_often'});
  });
  it('rechecks activity at retry execution rather than at scheduling',()=>{
    const p=setup();p.c.start();p.c.error(p.starts[0]);p.setEligible(false);vi.advanceTimersByTime(500);
    expect(p.starts).toHaveLength(1);expect(p.c.snapshot().phase).toBe('interrupted');
  });
  it('rechecks exercise lifetime and rejects obsolete readiness after a new start',()=>{
    const p=setup();p.c.start();const old=p.starts[0];p.c.error(old);p.c.stop();p.c.start();
    vi.advanceTimersByTime(500);p.c.ready(old);expect(p.c.current(old)).toBe(false);expect(p.c.snapshot().phase).toBe('acquiring');
  });
  it('never waits indefinitely for acquisition and bounds timeout retries',()=>{
    const p=setup();p.c.start();vi.runAllTimers();expect(p.starts).toHaveLength(4);
    expect(p.c.snapshot()).toMatchObject({phase:'failed',reason:'timeout'});expect(vi.getTimerCount()).toBe(0);
  });
  it('switch during recovery invalidates old tickets and uses the latest facing',()=>{
    const p=setup();let facing='front';p.c.start();const old=p.starts[0];p.c.error(old);facing='back';p.c.start();
    vi.advanceTimersByTime(500);expect(p.c.current(old)).toBe(false);expect(facing).toBe('back');expect(p.starts).toHaveLength(2);
    p.c.ready(p.starts[1]);expect(p.c.snapshot().phase).toBe('ready');
  });
  it('terminal permission failure needs manual retry; disposing cancels all work',()=>{
    const p=setup();p.c.start();p.c.error(p.starts[0],'permission_denied');expect(p.c.snapshot().phase).toBe('failed');
    vi.advanceTimersByTime(CAMERA_ACQUIRE_TIMEOUT_MS*5);expect(p.starts).toHaveLength(1);p.c.start();p.c.dispose();vi.runAllTimers();expect(p.starts).toHaveLength(2);
  });
});
