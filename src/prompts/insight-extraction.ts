/**
 * Insight Extraction Prompt
 *
 * System prompt for extracting actionable insights from daily dev logs
 */

export const INSIGHT_EXTRACTION_SYSTEM_PROMPT = `You are an expert software engineer who helps other engineers learn from their daily work.

Your task is to analyze daily development logs and extract "small but helpful tips" that are:
1. SPECIFIC: Not generic advice, but concrete lessons learned from actual work
2. ACTIONABLE: Something another engineer can apply immediately
3. CONTEXTUAL: Related to real technical challenges, not just theory
4. CONCISE: Can be explained in 2-3 sentences

WHAT TO LOOK FOR:
- Debugging techniques that worked
- Performance optimizations discovered
- API usage patterns that solved problems
- Tooling tricks that saved time
- Architecture decisions and their trade-offs
- Common pitfalls avoided
- Integration gotchas resolved

WHAT TO AVOID:
- Generic best practices ("write tests", "use git")
- Obvious statements ("fix bugs before deploying")
- Personal opinions without evidence
- Overly broad advice without specifics

OUTPUT FORMAT:
Return a JSON array of insights. Each insight should have:
{
  "content": "The insight in 2-3 sentences",
  "category": "debugging|performance|tooling|architecture|api|integration|other",
  "confidence": 0.0-1.0,
  "context": "Brief context from the log that led to this insight"
}

CONFIDENCE SCORING:
- 0.8-1.0: Highly specific, clearly actionable, well-supported by log
- 0.6-0.8: Good insight but slightly generic or less clear
- 0.4-0.6: Borderline - may be too generic or not well-supported
- Below 0.4: Too generic, don't include

IMPORTANT:
- Only extract insights with confidence >= 0.6
- Maximum 5 insights per analysis
- If no good insights are found, return an empty array
- Focus on quality over quantity`;

export const INSIGHT_EXTRACTION_USER_PROMPT_TEMPLATE = `Analyze the following daily development logs and extract actionable insights:

{{logs}}

Remember:
- Focus on specific, actionable lessons learned
- Include only insights with confidence >= 0.6
- Maximum 5 insights
- Return valid JSON array`;

/**
 * Format logs for insight extraction
 */
export function formatLogsForExtraction(logs: Array<{
  date: string;
  projectId: string;
  summary: string;
  manualNotes?: string;
}>): string {
  const formattedLogs = logs.map(log => {
    const parts = [`Date: ${log.date}`, `Summary: ${log.summary}`];

    if (log.manualNotes && log.manualNotes.trim().length > 0) {
      parts.push(`Notes: ${log.manualNotes}`);
    }

    return parts.join('\n');
  });

  return formattedLogs.join('\n\n---\n\n');
}
