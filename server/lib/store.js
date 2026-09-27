import { Workspace } from './models.js';
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export async function readWorkspace(id) {
  const w = await Workspace.findById(id).lean();
  if (!w) throw new HttpError(404, 'Workspace not found.');
  return w;
}
// A compare-and-swap revision check makes each aggregate mutation atomic across server instances.
export async function mutateWorkspace(id, fn) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const w = await readWorkspace(id);
    const result = await fn(w.data);
    const changed = await Workspace.updateOne(
      { _id: id, __v: w.__v },
      { $set: { data: w.data }, $inc: { __v: 1 } },
    );
    if (changed.modifiedCount) return result;
  }
  throw new HttpError(409, 'The project changed during your update. Please try again.');
}
export function findProject(data, id) {
  const p = data.projects.find((p) => p.id === id);
  if (!p) throw new HttpError(404, 'Project not found.');
  return p;
}
export function findVersion(project, id) {
  const v = project.versions.find((v) => v.id === id);
  if (!v) throw new HttpError(404, 'Version not found.');
  return v;
}
