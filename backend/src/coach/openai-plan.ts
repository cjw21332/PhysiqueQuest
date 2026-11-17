import { openAIResponse } from '../common/openai.js';
import { CoachPlanner } from './coach-planner.js';

type Plan = ReturnType<CoachPlanner['build']>;

/** The model may reorder pre-approved exercises only; it cannot add movements or alter prescriptions. */
export async function orderPlanWithOpenAI(plan: Plan): Promise<Plan> {
  const days = plan.days.filter(day => day.isWorkoutDay && day.exercises.length > 0);
  if (!days.length) return plan;
  const input = days.map(day => ({ index: day.index, exercises: day.exercises.map(exercise => ({ id: exercise.exerciseId, name: exercise.name, group: exercise.group })) }));
  const result = await openAIResponse([
    { role: 'system', content: 'Order each workout for a practical training session, generally larger compound movements before isolation. Return JSON {"days":[{"index":number,"exerciseIds":[string]}]}. Include each input day and each exercise ID exactly once. Never invent IDs.' },
    { role: 'user', content: JSON.stringify({ goal: plan.goal, days: input }) },
  ], 1500, AbortSignal.timeout(20000));
  const parsed: unknown = JSON.parse(result.content);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { days?: unknown }).days)) throw new Error('Invalid workout plan');
  const orders = (parsed as { days: Array<{ index?: unknown; exerciseIds?: unknown }> }).days;
  if (orders.length !== days.length) throw new Error('Invalid workout days');
  const used = new Set<number>();
  const mapped = plan.days.map(day => {
    if (!day.isWorkoutDay || !day.exercises.length) return day;
    const order = orders.find(item => item.index === day.index);
    if (!order || used.has(day.index) || !Array.isArray(order.exerciseIds) || order.exerciseIds.length !== day.exercises.length) throw new Error('Invalid workout order');
    used.add(day.index);
    const ids = order.exerciseIds;
    if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !day.exercises.some(exercise => exercise.exerciseId === id))) throw new Error('Invalid workout exercises');
    return { ...day, exercises: ids.map(id => day.exercises.find(exercise => exercise.exerciseId === id)!) };
  });
  return { ...plan, days: mapped as Plan['days'] };
}
