/**
 * Project Ideation Prompt
 *
 * MCP prompt for conversational project ideation and brainstorming
 */

export const PROJECT_IDEATION_PROMPT_NAME = 'project-ideation';

export const PROJECT_IDEATION_PROMPT_DESCRIPTION =
  'Interactive brainstorming session for new project ideas';

/**
 * Get project ideation prompt
 */
export async function getProjectIdeationPrompt(args?: {
  topic?: string;
  constraints?: string[];
  goals?: string[];
}): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
  const topic = args?.topic || 'new software project';
  const constraints = args?.constraints || [];
  const goals = args?.goals || [];

  let promptText = `Let's brainstorm ideas for a ${topic}.

I'll help you explore different angles, validate ideas, and structure your thoughts.`;

  if (constraints.length > 0) {
    promptText += `\n\n**Constraints to consider:**\n${constraints.map(c => `- ${c}`).join('\n')}`;
  }

  if (goals.length > 0) {
    promptText += `\n\n**Goals:**\n${goals.map(g => `- ${g}`).join('\n')}`;
  }

  promptText += `\n\n**I can help you with:**

1. **Idea Generation**: Brainstorm potential approaches and features
2. **Technical Stack**: Discuss appropriate technologies
3. **Architecture**: Outline high-level system design
4. **MVP Scope**: Define minimum viable product
5. **Challenges**: Identify potential roadblocks early
6. **Next Steps**: Create actionable plan

What aspect would you like to start with, or do you have a specific idea you'd like to explore?`;

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: promptText,
        },
      },
    ],
  };
}
