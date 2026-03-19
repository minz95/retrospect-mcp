/**
 * Notion Client Wrapper
 *
 * Wrapper around @notionhq/client for database and page operations
 */

import { Client } from '@notionhq/client';

export interface NotionClientConfig {
  token: string;
  parentPageId?: string; // Default parent page for databases
}

export interface CreateDatabaseInput {
  title: string;
  parentPageId?: string;
  properties?: Record<string, any>;
}

export interface CreateDatabaseResult {
  databaseId: string;
  url: string;
}

export interface CreatePageInput {
  databaseId: string;
  properties: Record<string, any>;
  content?: any[]; // Notion block objects
}

export interface CreatePageResult {
  pageId: string;
  url: string;
}

export interface UpdatePageInput {
  pageId: string;
  properties?: Record<string, any>;
  content?: any[]; // Notion block objects to append
}

/**
 * Notion Client
 */
export class NotionClient {
  private client: Client;
  private defaultParentPageId?: string;

  constructor(config: NotionClientConfig) {
    this.client = new Client({
      auth: config.token,
    });
    this.defaultParentPageId = config.parentPageId;
  }

  /**
   * Create a database
   */
  async createDatabase(input: CreateDatabaseInput): Promise<CreateDatabaseResult> {
    const { title, parentPageId, properties = {} } = input;

    const parent = parentPageId || this.defaultParentPageId;
    if (!parent) {
      throw new Error('Parent page ID is required');
    }

    console.error(`  - Creating Notion database: ${title}`);

    try {
      const response = await this.client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parent,
        },
        title: [
          {
            type: 'text',
            text: {
              content: title,
            },
          },
        ],
        properties: {
          // Default properties
          Name: {
            title: {},
          },
          ...properties,
        },
      });

      const databaseId = response.id;
      const url = 'url' in response && typeof response.url === 'string'
        ? response.url
        : `https://www.notion.so/${databaseId.replace(/-/g, '')}`;

      console.error(`  - Notion database created: ${url}`);

      return {
        databaseId,
        url,
      };
    } catch (error) {
      console.error('  - Failed to create Notion database:', error);
      throw new Error(
        `Failed to create Notion database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a page in a database
   */
  async createPage(input: CreatePageInput): Promise<CreatePageResult> {
    const { databaseId, properties, content = [] } = input;

    console.error(`  - Creating Notion page in database: ${databaseId}`);

    try {
      const response = await this.client.pages.create({
        parent: {
          type: 'database_id',
          database_id: databaseId,
        },
        properties,
        children: content,
      });

      const pageId = response.id;
      const url = (response as any).url;

      console.error(`  - Notion page created: ${url}`);

      return {
        pageId,
        url,
      };
    } catch (error) {
      console.error('  - Failed to create Notion page:', error);
      throw new Error(
        `Failed to create Notion page: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update a page
   */
  async updatePage(input: UpdatePageInput): Promise<void> {
    const { pageId, properties, content } = input;

    console.error(`  - Updating Notion page: ${pageId}`);

    try {
      // Update properties if provided
      if (properties) {
        await this.client.pages.update({
          page_id: pageId,
          properties,
        });
      }

      // Append content blocks if provided
      if (content && content.length > 0) {
        await this.client.blocks.children.append({
          block_id: pageId,
          children: content,
        });
      }

      console.error('  - Notion page updated successfully');
    } catch (error) {
      console.error('  - Failed to update Notion page:', error);
      throw new Error(
        `Failed to update Notion page: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a page
   */
  async getPage(pageId: string): Promise<any> {
    try {
      const response = await this.client.pages.retrieve({
        page_id: pageId,
      });

      return response;
    } catch (error) {
      throw new Error(
        `Failed to get Notion page: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a database
   */
  async getDatabase(databaseId: string): Promise<any> {
    try {
      const response = await this.client.databases.retrieve({
        database_id: databaseId,
      });

      return response;
    } catch (error) {
      throw new Error(
        `Failed to get Notion database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Query a database
   */
  async queryDatabase(databaseId: string, filter?: any, sorts?: any[]): Promise<any[]> {
    try {
      const response = await this.client.databases.query({
        database_id: databaseId,
        filter,
        sorts,
      });

      return response.results;
    } catch (error) {
      throw new Error(
        `Failed to query Notion database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Verify credentials
   */
  async verifyCredentials(): Promise<boolean> {
    try {
      // Try to list users (requires proper permissions)
      await this.client.users.me({});
      console.error('  - Notion credentials verified');
      return true;
    } catch (error) {
      console.error('  - Notion credentials invalid:', error);
      return false;
    }
  }
}
