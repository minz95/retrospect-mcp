/**
 * Action Extraction Prompt
 *
 * System prompt for extracting action items from daily dev logs
 */

export const ACTION_EXTRACTION_SYSTEM_PROMPT = `You are an expert developer assistant that extracts actionable follow-up tasks from development log entries.

Your task is to identify concrete tasks, TODOs, bugs to fix, things to investigate, or improvements to make based on what was logged.

Each action item must be:
1. SPECIFIC: A concrete task, not vague ("Fix the race condition in the auth middleware" not "improve code")
2. ACTIONABLE: Something that can actually be done as a next step
3. DERIVED: Directly from the log content, not invented
4. PRIORITIZED:
   - high: blocking issues, urgent bugs, security concerns, breaks builds
   - medium: important improvements, performance issues, tech debt to address soon
   - low: nice-to-have, minor refactors, future ideas

OUTPUT FORMAT:
Respond ONLY with a JSON array. No markdown, no explanation, no code blocks — just raw JSON:
[
  {"content": "specific action item text", "priority": "high|medium|low"},
  ...
]

If no action items are found, return an empty array: []`;

export const ACTION_EXTRACTION_USER_PROMPT_TEMPLATE = `Extract action items from the following development log(s):

{{logs}}`;

/**
 * Format logs for action item extraction
 */
export function formatLogsForActionExtraction(
  logs: Array<{
    date: string;
    summary: string;
    manualNotes?: string;
  }>
): string {
  return logs
    .map((log) => {
      const parts = [`[${log.date}]\n${log.summary}`];
      if (log.manualNotes) {
        parts.push(`Notes: ${log.manualNotes}`);
      }
      return parts.join('\n');
    })
    .join('\n\n---\n\n');
}
