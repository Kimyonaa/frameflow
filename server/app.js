import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { User, Session, Workspace, Asset, Share } from './lib/models.js';
import {
  identify,
  requireAuth,
  createUser,
  newSession,
  publicUser,
  passwordCheck,
  hash,
} from './lib/auth.js';
import {
  readWorkspace,
  mutateWorkspace,
  findProject,
  findVersion,
  HttpError,
} from './lib/store.js';
import { uid, now, event } from './lib/seed.js';
import {
  projectInput,
  annotationInput,
  taskInput,
  taskPatch,
  authInput,
  text,
} from './lib/validation.js';
import { inspectFile } from './lib/files.js';
import { assist, assistantMode } from './lib/assistant.js';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 6 },
});
const cleanObjectId = (id) => /^[a-f\d]{24}$/.test(id);
const emit = (req) => req.app.get('io')?.to(req.identity.workspaceId).emit('workspace:changed');
function annotationsOpen(p, v) {
  return p.annotations.filter((n) => n.version === v && n.status === 'open');
}
function approve(p, v, author, revision) {
  if ((v.revision || 0) !== revision)
    throw new HttpError(
      409,
      'This version changed since you opened it. Refresh and review it again.',
    );
  if (annotationsOpen(p, v.id).length)
    throw new HttpError(409, 'Resolve the open feedback on this version before approving.');
  const ids = new Set(p.annotations.filter((n) => n.version === v.id).map((n) => n.id));
  if (p.tasks.some((t) => ids.has(t.annotationId) && t.status !== 'done'))
    throw new HttpError(409, 'Complete linked tasks before approving.');
  v.status = 'approved';
  v.approvedAt = now();
  v.approvedBy = author;
  event(p, 'version.approved', `${v.label} approved by ${author}.`, author);
}
function invalidate(v) {
  v.revision = (v.revision || 0) + 1;
  if (v.status === 'approved') {
    v.status = 'in_review';
    delete v.approvedAt;
    delete v.approvedBy;
  }
}
export function createApp({ testing = false } = {}) {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws://127.0.0.1:5173'],
          workerSrc: ["'self'", 'blob:'],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '80kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      const origins = (
        process.env.ALLOWED_ORIGINS ||
        'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4310,http://localhost:4310'
      ).split(',');
      if (!origins.includes(req.headers.origin))
        return next(new HttpError(403, 'Origin not allowed.'));
    }
    next();
  });
  if (!testing)
    app.use(
      '/api',
      rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }),
    );
  app.get('/api/health', (req, res) =>
    res.json({ ok: true, storage: 'mongodb', assistant: assistantMode() }),
  );
  app.use('/api', identify);
  const authLimiter = testing
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60000,
        limit: 25,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
      });
  app.post('/api/auth/demo', authLimiter, async (req, res) => {
    if (req.identity)
      return res.json({ user: publicUser(req.identity.user), csrf: req.identity.csrf });
    const { user } = await createUser({ name: 'Anupam Nainiwal', demo: true });
    res.status(201).json({ user: publicUser(user), csrf: await newSession(user, res) });
  });
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const input = authInput.extend({ name: text(80) }).parse(req.body);
    const { user } = await createUser(input);
    res.status(201).json({ user: publicUser(user), csrf: await newSession(user, res) });
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const input = authInput.parse(req.body),
      user = await User.findOne({ email: input.email }).lean();
    if (!user?.password || !(await passwordCheck(input.password, user.password)))
      throw new HttpError(401, 'Email or password is incorrect.');
    res.json({ user: publicUser(user), csrf: await newSession(user, res) });
  });
  app.get('/api/auth/me', requireAuth, (req, res) =>
    res.json({ user: publicUser(req.identity.user), csrf: req.identity.csrf }),
  );
  app.post('/api/auth/logout', requireAuth, async (req, res) => {
    await Session.deleteOne({ tokenHash: hash(req.cookies.ff_session) });
    res.clearCookie('ff_session', { path: '/' });
    res.json({ ok: true });
  });
  // Review links are version-scoped capabilities, never whole-workspace credentials.
  async function shared(req) {
    const token = req.params.token;
    if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, 'Review link not found.');
    const link = await Share.findOne({
      tokenHash: hash(token),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!link) throw new HttpError(404, 'This review link expired or was revoked.');
    return link;
  }
  app.get('/api/review/:token', async (req, res) => {
    const link = await shared(req),
      w = await readWorkspace(link.workspaceId),
      p = findProject(w.data, link.projectId),
      v = findVersion(p, link.versionId);
    const notes = p.annotations.filter((n) => n.version === v.id);
    res.json({
      project: {
        id: p.id,
        name: p.name,
        client: p.client,
        requirements: p.requirements,
        versions: [v],
        annotations: notes,
        tasks: p.tasks.filter((t) => notes.some((n) => n.id === t.annotationId)),
      },
      version: v,
      expiresAt: link.expiresAt,
    });
  });
  app.post('/api/review/:token/comments', async (req, res) => {
    const link = await shared(req),
      input = annotationInput
        .omit({ version: true })
        .extend({ name: text(80) })
        .parse(req.body);
    const note = {
      ...input,
      version: link.versionId,
      id: uid(),
      status: 'open',
      author: input.name,
      createdAt: now(),
    };
    delete note.name;
    await mutateWorkspace(link.workspaceId, (data) => {
      const p = findProject(data, link.projectId);
      if (p.annotations.length >= 500)
        throw new HttpError(400, 'This project has reached its comment limit.');
      if (note.requirementId && !p.requirements.some((r) => r.id === note.requirementId))
        throw new HttpError(400, 'Unknown requirement.');
      invalidate(findVersion(p, link.versionId));
      p.annotations.push(note);
      event(p, 'comment.added', `${note.author} left feedback on ${link.versionId}.`, note.author);
    });
    app.get('io')?.to(link.workspaceId).emit('workspace:changed');
    res.status(201).json(note);
  });
  app.post('/api/review/:token/approve', async (req, res) => {
    const link = await shared(req),
      input = z.object({ name: text(80), revision: z.number().int().min(0) }).parse(req.body);
    await mutateWorkspace(link.workspaceId, (data) => {
      const p = findProject(data, link.projectId);
      approve(p, findVersion(p, link.versionId), input.name, input.revision);
    });
    app.get('io')?.to(link.workspaceId).emit('workspace:changed');
    res.json({ ok: true });
  });
  app.get('/api/review/:token/asset/:id', async (req, res) => {
    const link = await shared(req),
      w = await readWorkspace(link.workspaceId),
      v = findVersion(findProject(w.data, link.projectId), link.versionId);
    if (v.assetId !== req.params.id) throw new HttpError(404, 'Asset not found.');
    const a = await Asset.findById(v.assetId);
    if (!a) throw new HttpError(404, 'Asset not found.');
    res.type(a.mime).send(a.bytes);
  });
  app.use('/api', requireAuth);
  app.get('/api/workspace', async (req, res) => {
    const w = await readWorkspace(req.identity.workspaceId);
    res.json({
      ...w.data,
      revision: w.__v,
      storage: 'mongodb',
      assistant: assistantMode(),
      user: publicUser(req.identity.user),
    });
  });
  app.post('/api/projects', async (req, res) => {
    const input = projectInput.parse(req.body);
    const p = {
      ...input,
      id: uid(),
      status: 'in_progress',
      createdAt: now(),
      requirements: [],
      versions: [],
      annotations: [],
      tasks: [],
      proposals: [],
      activity: [],
    };
    event(p, 'project.created', 'Project created from a client brief.', req.identity.user.name);
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      if (data.projects.length >= 20)
        throw new HttpError(400, 'Maximum of 20 projects per workspace.');
      data.projects.push(p);
    });
    emit(req);
    res.status(201).json(p);
  });
  app.patch('/api/projects/:pid', async (req, res) => {
    const input = projectInput.partial().parse(req.body);
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid);
      Object.assign(p, input);
      event(p, 'brief.updated', 'Project brief updated.', req.identity.user.name);
    });
    emit(req);
    res.json({ ok: true });
  });
  app.post('/api/projects/:pid/requirements', async (req, res) => {
    const input = z.object({ title: text(160), description: text(2000) }).parse(req.body);
    const item = { ...input, id: uid() };
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid);
      if (p.requirements.length >= 50) throw new HttpError(400, 'Maximum of 50 requirements.');
      p.requirements.push(item);
      event(p, 'requirement.added', `Requirement added: ${item.title}`, req.identity.user.name);
    });
    emit(req);
    res.status(201).json(item);
  });
  app.post('/api/projects/:pid/versions', upload.single('file'), async (req, res) => {
    const input = z
      .object({ name: text(100), description: z.string().max(1000).default('') })
      .parse(req.body);
    const w = await readWorkspace(req.identity.workspaceId);
    findProject(w.data, req.params.pid);
    const inspected = await inspectFile(req.file);
    const asset = await Asset.create({
      ...inspected,
      workspaceId: req.identity.workspaceId,
      projectId: req.params.pid,
    });
    let version;
    try {
      await mutateWorkspace(req.identity.workspaceId, (data) => {
        const p = findProject(data, req.params.pid);
        if (p.versions.length >= 30)
          throw new HttpError(400, 'Maximum of 30 versions per project.');
        version = {
          id: uid(),
          name: input.name,
          description: input.description,
          label: `Version ${p.versions.length + 1}`,
          assetId: String(asset._id),
          mime: asset.mime,
          width: asset.width,
          height: asset.height,
          status: 'in_review',
          revision: 0,
          createdAt: now(),
        };
        p.versions.push(version);
        event(
          p,
          'version.uploaded',
          `${version.label} uploaded: ${version.name}`,
          req.identity.user.name,
        );
      });
    } catch (e) {
      await Asset.deleteOne({ _id: asset._id });
      throw e;
    }
    emit(req);
    res.status(201).json(version);
  });
  app.get('/api/assets/:id', async (req, res) => {
    if (!cleanObjectId(req.params.id)) throw new HttpError(404, 'Asset not found.');
    const a = await Asset.findOne({ _id: req.params.id, workspaceId: req.identity.workspaceId });
    if (!a) throw new HttpError(404, 'Asset not found.');
    res.set('Content-Disposition', `inline; filename="${a.name.replace(/"/g, '')}"`);
    res.type(a.mime).send(a.bytes);
  });
  app.post('/api/projects/:pid/annotations', async (req, res) => {
    const input = annotationInput.parse(req.body),
      note = {
        ...input,
        id: uid(),
        status: 'open',
        author: req.identity.user.name,
        createdAt: now(),
      };
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid);
      if (p.annotations.length >= 500) throw new HttpError(400, 'Maximum of 500 comments.');
      if (input.requirementId && !p.requirements.some((r) => r.id === input.requirementId))
        throw new HttpError(400, 'Unknown requirement.');
      invalidate(findVersion(p, note.version));
      p.annotations.push(note);
      event(p, 'comment.added', `Feedback added: ${note.text.slice(0, 100)}`, note.author);
    });
    emit(req);
    res.status(201).json(note);
  });
  app.patch('/api/projects/:pid/annotations/:id', async (req, res) => {
    const input = z.object({ status: z.enum(['open', 'resolved']) }).parse(req.body);
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid),
        note = p.annotations.find((n) => n.id === req.params.id);
      if (!note) throw new HttpError(404, 'Comment not found.');
      if (
        input.status === 'resolved' &&
        p.tasks.some((t) => t.annotationId === note.id && t.status !== 'done')
      )
        throw new HttpError(409, 'Complete this comment’s linked task before resolving it.');
      note.status = input.status;
      invalidate(findVersion(p, note.version));
      event(
        p,
        'comment.' + input.status,
        `Feedback ${input.status}: ${note.text.slice(0, 80)}`,
        req.identity.user.name,
      );
    });
    emit(req);
    res.json({ ok: true });
  });
  app.post('/api/projects/:pid/tasks', async (req, res) => {
    const input = taskInput.parse(req.body);
    let task;
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid);
      if (input.annotationId && !p.annotations.some((n) => n.id === input.annotationId))
        throw new HttpError(400, 'Unknown comment.');
      if (input.requirementId && !p.requirements.some((r) => r.id === input.requirementId))
        throw new HttpError(400, 'Unknown requirement.');
      const existing =
        input.annotationId && p.tasks.find((t) => t.annotationId === input.annotationId);
      if (existing) {
        task = existing;
        return;
      }
      if (p.tasks.length >= 500) throw new HttpError(400, 'Maximum of 500 tasks.');
      task = { ...input, id: uid(), status: 'todo', createdAt: now() };
      p.tasks.push(task);
      event(p, 'task.created', `Task created: ${task.title}`, req.identity.user.name);
    });
    emit(req);
    res.status(201).json(task);
  });
  app.patch('/api/projects/:pid/tasks/:id', async (req, res) => {
    const input = taskPatch.parse(req.body);
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid),
        task = p.tasks.find((t) => t.id === req.params.id);
      if (!task) throw new HttpError(404, 'Task not found.');
      Object.assign(task, input);
      if (input.status && input.status !== 'done' && task.annotationId) {
        const note = p.annotations.find((n) => n.id === task.annotationId);
        if (note) {
          note.status = 'open';
          invalidate(findVersion(p, note.version));
        }
      }
      event(p, 'task.updated', `${task.title}: ${task.status}`, req.identity.user.name);
    });
    emit(req);
    res.json({ ok: true });
  });
  app.post('/api/projects/:pid/versions/:vid/approve', async (req, res) => {
    const { revision } = z.object({ revision: z.number().int().min(0) }).parse(req.body);
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid);
      approve(p, findVersion(p, req.params.vid), req.identity.user.name, revision);
    });
    emit(req);
    res.json({ ok: true });
  });
  app.post('/api/projects/:pid/versions/:vid/share', async (req, res) => {
    const w = await readWorkspace(req.identity.workspaceId);
    findVersion(findProject(w.data, req.params.pid), req.params.vid);
    const token = randomBytes(32).toString('hex');
    const link = await Share.create({
      tokenHash: hash(token),
      workspaceId: req.identity.workspaceId,
      projectId: req.params.pid,
      versionId: req.params.vid,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    res
      .status(201)
      .json({ id: String(link._id), path: '/review/' + token, expiresAt: link.expiresAt });
  });
  app.get('/api/projects/:pid/shares', async (req, res) =>
    res.json(
      await Share.find({
        workspaceId: req.identity.workspaceId,
        projectId: req.params.pid,
        expiresAt: { $gt: new Date() },
      })
        .select('_id versionId expiresAt')
        .lean(),
    ),
  );
  app.delete('/api/shares/:id', async (req, res) => {
    if (!cleanObjectId(req.params.id)) throw new HttpError(404, 'Link not found.');
    await Share.deleteOne({ _id: req.params.id, workspaceId: req.identity.workspaceId });
    res.json({ ok: true });
  });
  const aiLimiter = testing
    ? (req, res, next) => next()
    : rateLimit({ windowMs: 60000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
  app.post('/api/projects/:pid/assistant', aiLimiter, async (req, res) => {
    const input = z
      .object({
        kind: z.enum(['plan', 'tasks', 'ask']),
        question: z.string().max(1500).default(''),
        annotationId: z.string().optional(),
      })
      .parse(req.body);
    const w = await readWorkspace(req.identity.workspaceId),
      p = findProject(w.data, req.params.pid);
    if (input.annotationId && !p.annotations.some((n) => n.id === input.annotationId))
      throw new HttpError(400, 'Unknown feedback.');
    const output = await assist(p, input);
    const proposal = {
      ...output,
      id: uid(),
      kind: input.kind,
      status: 'pending',
      createdAt: now(),
    };
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid);
      p.proposals.unshift(proposal);
      p.proposals = p.proposals.slice(0, 30);
    });
    res.json(proposal);
  });
  app.post('/api/projects/:pid/proposals/:id/apply', async (req, res) => {
    await mutateWorkspace(req.identity.workspaceId, (data) => {
      const p = findProject(data, req.params.pid),
        proposal = p.proposals.find((x) => x.id === req.params.id);
      if (!proposal) throw new HttpError(404, 'Proposal not found.');
      if (proposal.status === 'applied') return;
      if (proposal.kind === 'ask') throw new HttpError(400, 'Answers do not modify projects.');
      const changes = z
        .object({
          requirements: z
            .array(
              z.object({
                title: text(160),
                description: text(2000),
                evidenceIds: z.array(text(100)),
              }),
            )
            .max(12),
          tasks: z
            .array(
              z.object({
                title: text(200),
                description: z.string().max(3000),
                evidenceIds: z.array(text(100)),
              }),
            )
            .max(12),
        })
        .parse(req.body);
      if (
        p.requirements.length + changes.requirements.length > 50 ||
        p.tasks.length + changes.tasks.length > 500
      )
        throw new HttpError(400, 'Project limit reached.');
      const sourceIds = new Set([
        'brief',
        ...p.requirements.map((r) => r.id),
        ...p.annotations.map((n) => n.id),
        ...p.tasks.map((t) => t.id),
      ]);
      for (const item of [...changes.requirements, ...changes.tasks])
        if (!item.evidenceIds.length || item.evidenceIds.some((id) => !sourceIds.has(id)))
          throw new HttpError(400, 'A cited source no longer exists.');
      for (const r of changes.requirements) p.requirements.push({ ...r, id: uid() });
      for (const t of changes.tasks) {
        const noteId = t.evidenceIds.find((id) => p.annotations.some((n) => n.id === id)) || null;
        if (noteId && p.tasks.some((t) => t.annotationId === noteId)) continue;
        p.tasks.push({
          ...t,
          id: uid(),
          status: 'todo',
          annotationId: noteId,
          requirementId:
            t.evidenceIds.find((id) => p.requirements.some((r) => r.id === id)) || null,
          assignee: 'Unassigned',
          due: null,
          createdAt: now(),
        });
      }
      proposal.status = 'applied';
      event(
        p,
        'proposal.applied',
        `Reviewed ${proposal.mode === 'local' ? 'local' : 'AI'} proposal applied.`,
        req.identity.user.name,
      );
    });
    emit(req);
    res.json({ ok: true });
  });
  app.get('/api/projects/:pid/export', async (req, res) => {
    const w = await readWorkspace(req.identity.workspaceId),
      p = findProject(w.data, req.params.pid);
    res.attachment('frameflow-project.json').json(p);
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  app.use((err, req, res, next) => {
    let status = err.status || 500,
      message = err.message;
    if (err instanceof z.ZodError) {
      status = 400;
      message = err.issues[0]?.message || 'Invalid input.';
    }
    if (err.code === 11000) {
      status = 409;
      message = 'This email is already registered.';
    }
    if (err instanceof multer.MulterError) {
      status = 400;
      message = 'Upload one supported file under 10 MB.';
    }
    if (status >= 500) {
      console.error(err.message);
      message = 'The request could not be completed. Please try again.';
    }
    res.status(status).json({ error: message });
  });
  return app;
}
