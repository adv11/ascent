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
  if (options.weeklyTime) lines.push(`Weekly time commitment: ${options.weeklyTime}`);
  if (Array.isArray(options.resourceTypes) && options.resourceTypes.length) {
    lines.push(`Preferred resource types: ${options.resourceTypes.join(', ')}`);
  }
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
            ["<item title>", "<${VALID_PRIORITIES}>"],
            {
              "title": "<item title>",
              "priority": "<${VALID_PRIORITIES}>",
              "resources": [
                { "label": "<short resource name>", "url": "<https:// link>" }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- priority at the phase level indicates how critical the whole phase is (P0 = must-do, P3 = optional).
- An item is a plain string (inherits the phase's priority), a ["title","priority"] tuple, or an object
  { "title", "priority" (optional, inherits the phase's priority if omitted), "resources" (optional) }.
- Use the object form with "resources" for MOST items — this is expected and encouraged, not an edge
  case. Include 1-2 resources per item wherever a well-known, stable reference exists, which is true
  for the vast majority of standard technical/educational/professional topics. Good, safe choices:
  an official documentation site's homepage or a top-level section of it (e.g. https://docs.docker.com,
  https://developer.mozilla.org/en-US/docs/Web/JavaScript), a well-known learning platform's subject
  page (freeCodeCamp, Khan Academy, W3Schools, Coursera, MDN), or a reputable, widely-known YouTube
  channel or search results page for the topic. It is fine if a link is a general/top-level page rather
  than a highly specific one — a broad but correct link is far more useful than no link at all.
  Only skip "resources" for a genuinely niche or ambiguous item where you cannot recall any real,
  well-known source — never invent a URL or guess at one you are not confident exists.
  "url" must be a genuine http(s) link — each a { "label", "url" } pair, up to 5 per item.
- Do not add any fields beyond those listed above.
- "phases" must have at least 1 entry; each phase must have at least 1 section; each section at least 1 item.
- Keep the total number of items at or under 500.

Generate a roadmap for: ${topicLine}${optionsBlock}`;
}

// Ready-to-copy message a user can hand straight back to their AI assistant
// once validateImportText() finds errors in the pasted output — restates the
// schema-version-1 contract, lists the specific errors verbatim, and asks for
// the complete corrected JSON (not a diff/patch), so the round trip reliably
// produces something importable without the user having to translate the
// technical error strings themselves. Pure — no DOM/store/Firebase.
export function buildImportFixPrompt(errors) {
  const errorLines = (errors || []).map(message => `- ${message}`).join('\n');
  return `The roadmap JSON you generated (schema version ${IMPORT_PROMPT_VERSION}) has the following problem${errors && errors.length === 1 ? '' : 's'}:

${errorLines}

Please resend the complete corrected JSON — the full roadmap, not just the changed part — output ONLY valid JSON with no markdown fences and no commentary.`;
}
