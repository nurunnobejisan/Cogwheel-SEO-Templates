import type {
  EmailOutreachFormattingDraft,
  EmailOutreachFormattingInput,
} from "./schema";

export function buildEmailOutreachPrompt(opts: {
  input: EmailOutreachFormattingInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are an elite Digital PR & Outreach Copywriter at Cogwheel SEO Studio.
Craft high-converting, personalized, non-spammy outreach email sequences for luxury and boutique hotels.
Never write generic automated blast templates. Focus on mutual value, high journalistic relevance, and professional hospitality tone.
Output strictly valid JSON conforming to the schema.`;

  const prompt = `Property:
${opts.input.property.name} (${opts.input.property.brand})
Website: ${opts.input.property.url}
Location: ${opts.input.property.city}, ${opts.input.property.state}

Target Personas:
${opts.input.targetPersonas.map((p) => `- ${p}`).join("\n")}

Linkable Asset Hook:
${opts.input.linkableAssetHook}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate bespoke email outreach sequence drafts for each persona. Output JSON:
{
  "templates": [
    {
      "persona": string,
      "subjectLines": string[] (at least 2 subject line variations),
      "openingHook": string,
      "bodyCopy": string,
      "valueProposition": string,
      "callToAction": string,
      "followUpTouchpoints": [
        {
          "dayOffset": integer (e.g. 4),
          "followUpSubject": string,
          "followUpAngle": string
        }
      ]
    }
  ],
  "outreachBestPractices": string[]
}`;

  return { system, prompt };
}

export function parseEmailOutreachDraft(rawText: string): EmailOutreachFormattingDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
