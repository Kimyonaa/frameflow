import { randomUUID } from 'node:crypto';
export const uid = () => randomUUID();
export const now = () => new Date().toISOString();
export function projectSeed() {
  const today = new Date();
  const due = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  return {
    id: uid(),
    name: 'Forma — brand & website',
    client: 'Forma Studio',
    description: 'A clearer story. A better first impression.',
    brief:
      'Forma is an independent studio looking for a digital presence that feels as considered as its work. The website should explain what the team does, show its personality, and make starting a conversation effortless. Visitors should be able to compare three clearly priced plans. Keep the visual identity warm and editorial. The experience must work on mobile.',
    due,
    status: 'in_progress',
    createdAt: now(),
    requirements: [
      {
        id: 'req-pricing',
        title: 'Make plans easy to understand',
        description: 'Visitors should be able to compare the three plans without contacting sales.',
      },
      {
        id: 'req-brand',
        title: 'Build a confident visual identity',
        description: 'Warm, editorial, and considered. Avoid generic SaaS styling.',
      },
      {
        id: 'req-mobile',
        title: 'Make the experience work on mobile',
        description: 'Keep navigation, pricing and contact usable on small screens.',
      },
    ],
    versions: [
      {
        id: 'v1',
        name: 'Homepage exploration',
        label: 'Version 1',
        template: 'v1',
        status: 'changes_requested',
        createdAt: now(),
        description: 'An initial exploration of the studio’s visual identity.',
      },
      {
        id: 'v2',
        name: 'Homepage exploration',
        label: 'Version 2',
        template: 'v2',
        status: 'in_review',
        createdAt: now(),
        description: 'Starting prices now appear in the first screen.',
      },
    ],
    annotations: [
      {
        id: 'note-1',
        text: 'Can we make the starting price visible before someone opens a plan?',
        x: 72,
        y: 77,
        page: 1,
        version: 'v1',
        requirementId: 'req-pricing',
        status: 'open',
        author: 'Maya Chen',
        createdAt: now(),
      },
      {
        id: 'note-2',
        text: 'Love the direction. Keep this warm palette in the next version.',
        x: 35,
        y: 35,
        page: 1,
        version: 'v2',
        requirementId: 'req-brand',
        status: 'open',
        author: 'Alex Morgan',
        createdAt: now(),
      },
    ],
    tasks: [],
    proposals: [],
    activity: [
      {
        id: uid(),
        kind: 'project.created',
        text: 'Project created from the Forma studio brief.',
        author: 'Demo team',
        createdAt: now(),
      },
    ],
  };
}
export function workspaceSeed() {
  return { projects: [projectSeed()] };
}
export function event(project, kind, text, author) {
  project.activity.unshift({ id: uid(), kind, text, author, createdAt: now() });
  project.activity = project.activity.slice(0, 500);
}
