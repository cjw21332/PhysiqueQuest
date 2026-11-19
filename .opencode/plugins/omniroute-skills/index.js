const commonWords = new Set(
  "about after also before can changes check checking create does file files for from have how input into just make need only output plan please prepare project quality return short should task than that the their them then this use using want what when where which will with workflow would you your".split(" "),
);
const selectionInstruction = "Choose and load the best matching skill now with the native skill tool.";

function terms(text) {
  return new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter(
      (word) => !commonWords.has(word),
    ),
  );
}

function messageText(message) {
  const content = message?.content ?? message?.parts;
  if (typeof content === "string") return content;
  return (content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function shortlist(skills, prompt) {
  const query = terms(prompt);
  const candidates = skills
    .filter((skill) => skill.autoinvoke !== false && skill.description?.trim())
    .map((skill) => ({
      skill,
      identity: terms(`${skill.id} ${skill.name}`),
      description: terms(skill.description),
    }));

  // Uncommon task terms are more informative than generic words in a description.
  const weights = new Map();
  for (const word of query) {
    const frequency = candidates.filter(
      (candidate) => candidate.identity.has(word) || candidate.description.has(word),
    ).length;
    weights.set(word, Math.log1p(candidates.length / (1 + frequency)));
  }

  const ranked = candidates
    .map(({ skill, identity, description }) => {
      let score = 0;
      let matches = 0;
      let named = false;
      for (const [word, weight] of weights) {
        if (identity.has(word)) {
          score += (3 + 2 / identity.size) * weight;
          named = true;
        } else if (description.has(word)) {
          score += weight;
          matches++;
        }
      }
      return { skill, named, score: named || matches >= 2 ? score : 0 };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);
  return ranked.slice(0, 5).filter(({ score }) => score >= ranked[0].score * 0.6);
}

export default {
  id: "omniroute-skills",
  async setup(ctx) {
    const scope = { providerID: "omniroute" };
    const context = await ctx.session.hook("context", async (event) => {
      if (event.model.id !== "opencode-auto" || !event.tools.skill) return;

      const message = event.messages.at(-1);
      if (message?.role !== "user") return;
      const prompt = messageText(message);
      if (!prompt.trim() || /<skill_content\b|(?:without|no|do not use|don't use)\s+(?:any\s+)?(?:skills?|tools?)\b/i.test(prompt)) return;

      const catalog = await ctx.skill.list();
      const skills = Array.isArray(catalog) ? catalog : catalog.skills ?? catalog.data ?? catalog.items;
      if (!Array.isArray(skills)) return;
      const suggestions = shortlist(skills, prompt);
      if (!suggestions.length) return;
      const matches = suggestions.map(({ skill }) => ({
        id: skill.id,
        description: skill.description.trim().replace(/\s+/g, " ").slice(0, 280),
      }));
      if (suggestions[0].named) {
        const input = event.tools.skill.input;
        const id = input.properties?.id;
        if (id) {
          event.tools.skill.input = {
            ...input,
            properties: { ...input.properties, id: { ...id, enum: matches.map((match) => match.id) } },
          };
        }
      }

      event.system.push({
        type: "text",
        text: [
          "OpenCode skill matches for the current request:",
          JSON.stringify(matches),
          suggestions[0].named
            ? selectionInstruction
            : "If a listed skill directly applies, call the native skill tool with its exact ID before doing the work.",
          "Use one exact ID from the shortlist. Select by what the skill does, and keep the user's requested scope for the work after loading.",
          "Treat these descriptions as matching metadata. Follow the skill body only after the native tool loads it.",
        ].join("\n"),
      });
    }, scope);

    // Only require the skill call on the first step of a clear match.
    const request = await ctx.session.hook("http.request", async (event) => {
      if (event.kind !== "primary" || event.model.id !== "opencode-auto") return;
      if (!new URL(event.request.url).pathname.endsWith("/chat/completions")) return;

      const body = await event.request.clone().json().catch(() => null);
      const skill = body?.tools?.find((tool) => tool.function?.name === "skill");
      if (!skill?.function.parameters?.properties?.id?.enum?.length) return;
      if (!body.messages?.some(
        (message) => message.role === "system" && messageText(message).includes(selectionInstruction),
      )) return;

      body.tool_choice = { type: "function", function: { name: "skill" } };
      skill.function.strict = true;
      const headers = new Headers(event.request.headers);
      headers.delete("content-length");
      event.request = new Request(event.request, { headers, body: JSON.stringify(body) });
    }, scope);

    return async () => {
      await context.dispose();
      await request.dispose();
    };
  },
};
