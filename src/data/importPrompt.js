// Versioned so a future schema change never breaks a prompt a user already
// copied and saved somewhere — bump this and add a new adapter in
// src/core/roadmap/schemaAdapter.js instead of mutating the existing shape.
export const IMPORT_PROMPT_VERSION = 1;

const VALID_PRIORITIES = 'P0|P1|P2|P3';

// Customization inputs (issue #64 Part 2) only ever add lines to the
// free-text instructions block below — never to the JSON schema contract
// above, so a prompt copied before this existed still parses identically.
// Each field is omitted entirely when unset, never rendered as an empty or
// placeholder line, matching how the topic line already behaves.
function buildOptionLines(options = {}) {
  const lines = [];
  if (options.experienceLevel) lines.push(`Experience level: ${options.experienceLevel}`);
  if (options.timeframe) lines.push(`Target timeframe: ${options.timeframe}`);
  if (options.goal) lines.push(`Goal / context: ${options.goal}`);
  const alreadyKnow = (options.alreadyKnow || '').trim();
  if (alreadyKnow) lines.push(`Already know: ${alreadyKnow}`);
  return lines;
}

// The `topic` line is rendered as the last line of the prompt so a user
// copies one complete, ready-to-paste block — never a template with a blank
// left for them to fill in after pasting.
export function buildImportPrompt(topic, options) {
  const topicLine = (topic || '').trim() || '[describe what this roadmap should cover]';
  const optionLines = buildOptionLines(options);
  const optionsBlock = optionLines.length ? `\n${optionLines.join('\n')}` : '';
  return `You are generating an Ascent roadmap JSON file.
Output ONLY valid JSON — no markdown fences, no commentary.
Follow this exact schema (version ${IMPORT_PROMPT_VERSION}):

{
  "schemaVersion": ${IMPORT_PROMPT_VERSION},
  "title": "<roadmap title>",
  "phases": [
    {
      "title": "<phase title>",
      "priority": "<${VALID_PRIORITIES}>",
      "sections": [
        {
          "title": "<section title>",
          "items": [
            "<item title>",
            ["<item title>", "<${VALID_PRIORITIES}>"]
          ]
        }
      ]
    }
  ]
}

Rules:
- priority at the phase level indicates how critical the whole phase is (P0 = must-do, P3 = optional).
- An item is either a plain string (inherits the phase's priority) or a ["title","priority"] tuple.
- Do not add any fields beyond those listed above.
- "phases" must have at least 1 entry; each phase must have at least 1 section; each section at least 1 item.
- Keep the total number of items at or under 500.

Generate a roadmap for: ${topicLine}${optionsBlock}`;
}
