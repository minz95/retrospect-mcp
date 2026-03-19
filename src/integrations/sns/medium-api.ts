/**
 * Medium API Integration
 *
 * Publishes articles using Medium REST API
 */

export interface MediumConfig {
  accessToken: string;
}

export interface PublishMediumPostInput {
  title: string;
  content: string; // Markdown or HTML
  contentFormat?: 'markdown' | 'html';
  publishStatus?: 'draft' | 'public' | 'unlisted';
  tags?: string[];
}

export interface PublishMediumPostResult {
  postId: string;
  url: string;
  publishStatus: string;
}

/**
 * Publish a post to Medium
 */
export async function publishMediumPost(
  input: PublishMediumPostInput,
  config: MediumConfig
): Promise<PublishMediumPostResult> {
  const {
    title,
    content,
    contentFormat = 'markdown',
    publishStatus = 'draft', // Default to draft for safety
    tags = [],
  } = input;

  if (!title || title.trim().length === 0) {
    throw new Error('Medium post must have a title');
  }

  if (!content || content.trim().length === 0) {
    throw new Error('Medium post content cannot be empty');
  }

  console.error(`  - Publishing Medium post as ${publishStatus}...`);

  try {
    // First, get the authenticated user's ID
    const userId = await getMediumUserId(config);

    // Prepare post data
    const postData = {
      title,
      contentFormat,
      content,
      publishStatus,
      tags: tags.slice(0, 5), // Medium allows max 5 tags
    };

    // Publish post
    const response = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8',
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Medium API error (${response.status}): ${errorText}`
      );
    }

    const result = await response.json() as {
      data: { id: string; url: string };
      errors?: Array<{ message: string }>;
    };

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Medium API errors: ${JSON.stringify(result.errors)}`);
    }

    const postId = result.data.id;
    const url = result.data.url;

    console.error(`  - Medium post published successfully: ${url}`);
    console.error(`  - Status: ${publishStatus}`);

    return {
      postId,
      url,
      publishStatus,
    };
  } catch (error) {
    console.error('  - Failed to publish Medium post:', error);
    throw new Error(
      `Failed to publish Medium post: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get authenticated user's Medium ID
 */
async function getMediumUserId(config: MediumConfig): Promise<string> {
  try {
    const response = await fetch('https://api.medium.com/v1/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user: ${response.status}`);
    }

    const result = await response.json() as { data?: { id?: string } };

    if (!result.data || !result.data.id) {
      throw new Error('Invalid response from Medium API');
    }

    return result.data.id;
  } catch (error) {
    throw new Error(
      `Failed to get Medium user ID: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verify Medium API credentials
 */
export async function verifyMediumCredentials(config: MediumConfig): Promise<boolean> {
  try {
    const response = await fetch('https://api.medium.com/v1/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`  - Medium API credentials invalid: ${response.status}`);
      return false;
    }

    const result = await response.json() as { data: { username: string } };
    console.error(`  - Medium credentials verified for user: ${result.data.username}`);
    return true;
  } catch (error) {
    console.error('  - Failed to verify Medium credentials:', error);
    return false;
  }
}

/**
 * Get Medium user profile
 */
export async function getMediumProfile(config: MediumConfig): Promise<{
  id: string;
  username: string;
  name: string;
  url: string;
}> {
  try {
    const response = await fetch('https://api.medium.com/v1/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }

    const result = await response.json() as {
      data: {
        id: string;
        username: string;
        name: string;
        url: string;
      };
    };

    return {
      id: result.data.id,
      username: result.data.username,
      name: result.data.name,
      url: result.data.url,
    };
  } catch (error) {
    throw new Error(
      `Failed to get Medium profile: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract title from markdown content
 */
export function extractTitleFromMarkdown(content: string): string {
  // Look for first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Fallback: use first line
  const firstLine = content.split('\n')[0].trim();
  return firstLine.substring(0, 100); // Limit to 100 chars
}
