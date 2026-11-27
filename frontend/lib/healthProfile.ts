export const INJURY_OPTIONS = ['Knee injury', 'Lower back pain', 'Shoulder impingement'];
export const RISK_OPTIONS = ['Hypertension', 'Asthma', 'Heart condition'];
export const NONE_OF_THESE = 'None of these';

/**
 * Health profile uses one checklist instead of separate Injuries / Health risks / Existing conditions lists that
 * repeated the same labels. Saving still fills all three stored fields: conditions always; injuries and healthRisks
 * only with health-coaching consent. Custom labels saved earlier keep the field they came from.
 */
export function healthPatch(selected: string[], consentAt: string | null, savedInjuries: string[] = [], savedRisks: string[] = []) {
  const chosen = selected.filter(item => item !== NONE_OF_THESE);
  return {
    conditions: selected,
    injuries: consentAt ? chosen.filter(item => INJURY_OPTIONS.includes(item) || (savedInjuries.includes(item) && !RISK_OPTIONS.includes(item))) : [],
    healthRisks: consentAt ? chosen.filter(item => RISK_OPTIONS.includes(item) || (savedRisks.includes(item) && !INJURY_OPTIONS.includes(item))) : [],
  };
}
