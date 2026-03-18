/**
 * MCP Resource: projects
 *
 * Provides access to project information
 */

import { getProject, getAllProjects } from '../storage/db.js';

/**
 * List projects resources
 */
export function listProjectsResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return [
    {
      uri: 'projects://list',
      name: 'Projects',
      description: 'List all projects or get specific project (use projects://{id})',
      mimeType: 'application/json',
    },
  ];
}

/**
 * Read projects resource
 */
export function readProjectsResource(uri: string): string {
  // Parse URI: projects://list or projects://{id}
  const match = uri.match(/^projects:\/\/(.+)$/);
  if (!match) {
    throw new Error(
      `Invalid projects URI: ${uri}. Expected format: projects://list or projects://{id}`
    );
  }

  const param = match[1];

  // List all projects
  if (param === 'list') {
    return readAllProjects();
  }

  // Read specific project by ID
  if (param.startsWith('prj')) {
    return readProjectById(param);
  }

  throw new Error(
    `Invalid projects parameter: ${param}. Expected 'list' or project ID (prj...)`
  );
}

/**
 * Read all projects
 */
function readAllProjects(): string {
  const projects = getAllProjects();

  if (projects.length === 0) {
    return JSON.stringify(
      {
        projects: [],
        total: 0,
        message: 'No projects found',
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        createdDate: project.createdDate,
        obsidianPath: project.obsidianPath,
        notionPageId: project.notionPageId,
      })),
      total: projects.length,
    },
    null,
    2
  );
}

/**
 * Read specific project by ID
 */
function readProjectById(id: string): string {
  const project = getProject(id);

  if (!project) {
    return JSON.stringify(
      {
        error: `Project not found: ${id}`,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      id: project.id,
      name: project.name,
      description: project.description,
      createdDate: project.createdDate,
      obsidianPath: project.obsidianPath,
      notionPageId: project.notionPageId,
    },
    null,
    2
  );
}
