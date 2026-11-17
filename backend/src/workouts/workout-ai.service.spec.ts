import { describe, expect, it, vi } from 'vitest';
import { WorkoutAiService } from './workout-ai.service.js';
import { openAIResponse } from '../common/openai.js';

vi.mock('../common/openai.js', () => ({ openAIResponse: vi.fn() }));

describe('workout AI insight', () => {
  it('uses the signed-in user’s completed workout and omits unrelated profile data', async () => {
    const workouts = { detail: vi.fn().mockResolvedValue({ status: 'completed', durationSeconds: 600, exercises: [{ exerciseId: 'x', name: 'Squat', equipment: 'Bodyweight' }], sets: [{ exerciseId: 'x', reps: 10, status: 'completed' }], privateNotes: 'do not send' }) };
    vi.mocked(openAIResponse).mockResolvedValueOnce({ content: JSON.stringify({ summary: 'You logged one squat set.', suggestion: 'Allow time to recover.' }), usage: undefined });
    const result = await new WorkoutAiService(workouts as never).summarize('owner', 'workout');
    expect(workouts.detail).toHaveBeenCalledWith('owner', 'workout');
    expect(result.summary).toContain('squat');
    expect(JSON.stringify(vi.mocked(openAIResponse).mock.calls[0])).not.toContain('do not send');
  });
  it('does not send an active workout', async () => {
    const workouts = { detail: vi.fn().mockResolvedValue({ status: 'active' }) };
    vi.mocked(openAIResponse).mockClear();
    await expect(new WorkoutAiService(workouts as never).summarize('owner', 'workout')).rejects.toMatchObject({ status: 400 });
    expect(openAIResponse).not.toHaveBeenCalled();
  });
});
