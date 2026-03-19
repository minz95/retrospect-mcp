/**
 * LinkedIn API Integration
 *
 * Publishes posts using LinkedIn UGC (User Generated Content) API
 */

export interface LinkedInConfig {
  accessToken: string;
  userId: string; // LinkedIn user URN (e.g., "urn:li:person:XXXXXX")
}

export interface PublishLinkedInPostInput {
  content: string;
}

export interface PublishLinkedInPostResult {
  postId: string;
  url: string;
}

/**
 * Publish a post to LinkedIn
 */
export async function publishLinkedInPost(
  input: PublishLinkedInPostInput,
  config: LinkedInConfig
): Promise<PublishLinkedInPostResult> {
  const { content } = input;

  if (content.length === 0) {
    throw new Error('LinkedIn post content cannot be empty');
  }

  if (content.length > 3000) {
    throw new Error(`LinkedIn post exceeds 3000 characters (${content.length} chars)`);
  }

  console.error('  - Publishing LinkedIn post...');

  // Prepare UGC post request
  const ugcPost = {
    author: config.userId,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  try {
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(ugcPost),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LinkedIn API error (${response.status}): ${errorText}`
      );
    }

    const result = await response.json() as { id: string };
    const postId = result.id;

    // LinkedIn post URLs are in the format: https://www.linkedin.com/feed/update/{postId}
    // Note: The actual URL format may vary based on the post URN
    const url = `https://www.linkedin.com/feed/update/${postId}`;

    console.error(`  - LinkedIn post published successfully: ${url}`);

    return {
      postId,
      url,
    };
  } catch (error) {
    console.error('  - Failed to publish LinkedIn post:', error);
    throw new Error(
      `Failed to publish LinkedIn post: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verify LinkedIn API credentials
 */
export async function verifyLinkedInCredentials(config: LinkedInConfig): Promise<boolean> {
  try {
    // Test credentials by fetching user profile
    const response = await fetch('https://api.linkedin.com/v2/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`  - LinkedIn API credentials invalid: ${response.status}`);
      return false;
    }

    const profile = await response.json() as { id: string };
    console.error(`  - LinkedIn credentials verified for user: ${profile.id}`);
    return true;
  } catch (error) {
    console.error('  - Failed to verify LinkedIn credentials:', error);
    return false;
  }
}

/**
 * Get LinkedIn user profile
 */
export async function getLinkedInProfile(config: LinkedInConfig): Promise<{
  id: string;
  firstName: string;
  lastName: string;
}> {
  try {
    const response = await fetch('https://api.linkedin.com/v2/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }

    const profile = await response.json() as { id: string };

    // Fetch localized name
    const nameResponse = await fetch(
      `https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      }
    );

    const nameData = await nameResponse.json() as { localizedFirstName?: string; localizedLastName?: string };

    return {
      id: profile.id,
      firstName: nameData.localizedFirstName || '',
      lastName: nameData.localizedLastName || '',
    };
  } catch (error) {
    throw new Error(
      `Failed to get LinkedIn profile: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
