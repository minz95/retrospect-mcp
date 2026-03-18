/**
 * Notion Page Builder
 *
 * Converts daily logs to Notion format with properties and blocks
 */

import type { GitCommit } from '../../types/index.js';

export interface DailyLogData {
  date: string;
  projectName: string;
  summary: string;
  commits: GitCommit[];
  manualNotes?: string;
  actionItems: string[];
}

export interface NotionPageData {
  properties: Record<string, any>;
  content: any[]; // Notion block objects
}

/**
 * Build Notion page from daily log data
 */
export function buildDailyLogPage(data: DailyLogData): NotionPageData {
  const { date, projectName, summary, commits, manualNotes, actionItems } = data;

  // Build properties
  const properties = {
    Name: {
      title: [
        {
          text: {
            content: `${projectName} - ${date}`,
          },
        },
      ],
    },
    Date: {
      date: {
        start: date,
      },
    },
    Summary: {
      rich_text: [
        {
          text: {
            content: summary.substring(0, 2000), // Notion limit
          },
        },
      ],
    },
    Commits: {
      number: commits.length,
    },
  };

  // Build content blocks
  const content: any[] = [];

  // Summary section
  content.push({
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: 'Summary',
          },
        },
      ],
    },
  });

  content.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: summary,
          },
        },
      ],
    },
  });

  // Commits section
  if (commits.length > 0) {
    content.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Commits',
            },
          },
        ],
      },
    });

    commits.forEach(commit => {
      content.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `${commit.sha.substring(0, 7)} - ${commit.message} (${commit.author})`,
              },
            },
          ],
        },
      });

      // Add commit stats as nested item
      content.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `Files: ${commit.filesChanged.length}, +${commit.additions} / -${commit.deletions}`,
              },
            },
          ],
        },
      });
    });
  }

  // Manual notes section
  if (manualNotes && manualNotes.trim().length > 0) {
    content.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Notes',
            },
          },
        ],
      },
    });

    // Split notes into paragraphs
    const paragraphs = manualNotes.split('\n\n');
    paragraphs.forEach(paragraph => {
      if (paragraph.trim().length > 0) {
        content.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: paragraph.trim(),
                },
              },
            ],
          },
        });
      }
    });
  }

  // Action items section
  if (actionItems.length > 0) {
    content.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Action Items',
            },
          },
        ],
      },
    });

    actionItems.forEach(item => {
      content.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: item,
              },
            },
          ],
          checked: false,
        },
      });
    });
  }

  return {
    properties,
    content,
  };
}

/**
 * Build properties for project database
 */
export function buildProjectDatabaseProperties(): Record<string, any> {
  return {
    Name: {
      title: {},
    },
    Date: {
      date: {},
    },
    Summary: {
      rich_text: {},
    },
    Commits: {
      number: {},
    },
  };
}

/**
 * Convert markdown to Notion blocks (simple implementation)
 */
export function markdownToNotionBlocks(markdown: string): any[] {
  const blocks: any[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.length === 0) {
      i++;
      continue;
    }

    // Heading 1
    if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: line.substring(2),
              },
            },
          ],
        },
      });
      i++;
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: line.substring(3),
              },
            },
          ],
        },
      });
      i++;
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: line.substring(4),
              },
            },
          ],
        },
      });
      i++;
      continue;
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: line.substring(2),
              },
            },
          ],
        },
      });
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: codeLines.join('\n'),
              },
            },
          ],
          language: 'plain text',
        },
      });
      i++;
      continue;
    }

    // Paragraph (default)
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: line,
            },
          },
        ],
      },
    });
    i++;
  }

  return blocks;
}
