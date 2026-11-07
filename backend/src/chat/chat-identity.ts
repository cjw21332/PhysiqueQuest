// Project credit supplied by the PhysiqueQuest team.
const PROJECT = 'PhysiqueQuest: An AI-Assisted Gamified Mobile Fitness Application for Real-Time Exercise Tracking and Safety Monitoring';
const MEMBERS = ['Anjao Jr., Michael R.', 'Boco, Christian Jodel D.', 'Garcia, Nikko Ivan', 'Guion, Dave B.', 'Ibale, Cy O.', 'Latorre, Bart Daniel R.', 'Mangahas, Levi T.', 'Nebriaga, Kurt JM D.', 'Oñas, Aeon Flux Y.', 'Tagumpay, Lolito Jr. C.', 'Velitario, Ylyza Shean Q.', 'Walet, Charles James “CJ” J.'];
export function phiqCreatorAnswer(question: string): string {
  if (/\b(?:members?|team|group|physique\s?quest|this app|project)\b/i.test(question)) {
    return `PhysiqueQuest is a capstone project by Group 2, SBIT-4I, entitled “${PROJECT}”. The group members are: ${MEMBERS.join('; ')}. Phiq specifically was created by Charles James “CJ” J. Walet.`;
  }
  return `I’m Phiq, the assistant for PhysiqueQuest, and I was specifically created by Charles James “CJ” J. Walet. PhysiqueQuest is the capstone project “${PROJECT}” by Group 2, SBIT-4I.`;
}

export function asksAboutPhiqCreators(question: string): boolean {
  const q = question.toLowerCase().trim().replace(/[?!.,]+$/g, '').replace(/\s+/g, ' ');
  return /^(?:(?:hey|hi|hello|please|phiq)[, ]+)*(?:who (?:created|made|built|developed|designed) (?:you|phiq|this (?:assistant|chatbot)|physique\s?quest|this app)|who (?:is|are) (?:your|phiq'?s|the (?:app|chatbot|assistant)'?s) (?:creator|creators|developer|developers)|who (?:is|are) (?:behind|responsible for) (?:you|phiq|physique\s?quest|this app)|which (?:team|group) (?:created|made|built|developed) (?:you|phiq|physique\s?quest|this app)|who (?:are|were) (?:the )?(?:group|team|project) members|who (?:are|were) (?:the )?members of (?:group 2|the (?:project|team|group)))$/.test(q);
}
