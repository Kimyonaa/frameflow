import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import supertest from 'supertest';
import sharp from 'sharp';
import { createApp } from './app.js';
import { User, Session, Workspace, Share, Asset } from './lib/models.js';
import { validateOutput, localAssistant } from './lib/assistant.js';
const name = 'frameflow_test_' + process.pid;
let app, a, b, csrfA, csrfB, pid, pidB;
before(async () => {
  delete process.env.OPENAI_API_KEY;
  await mongoose.connect('mongodb://127.0.0.1:27017/' + name);
  await Promise.all([User.init(), Session.init(), Workspace.init(), Share.init(), Asset.init()]);
  app = createApp({ testing: true });
  a = supertest.agent(app);
  b = supertest.agent(app);
  csrfA = (await a.post('/api/auth/demo').send({}).expect(201)).body.csrf;
  csrfB = (await b.post('/api/auth/demo').send({}).expect(201)).body.csrf;
  pid = (await a.get('/api/workspace')).body.projects[0].id;
  pidB = (await b.get('/api/workspace')).body.projects[0].id;
});
after(async () => {
  if (mongoose.connection.name !== name) throw Error('Refusing to drop a non-test database');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
const post = (path, body) =>
  a
    .post('/api/' + path)
    .set('X-CSRF-Token', csrfA)
    .send(body);
const patch = (path, body) =>
  a
    .patch('/api/' + path)
    .set('X-CSRF-Token', csrfA)
    .send(body);
test('sessions, CSRF and workspace boundaries are enforced', async () => {
  await supertest(app).get('/api/workspace').expect(401);
  await a.post('/api/projects').send({}).expect(403);
  await a
    .post('/api/projects')
    .set('Origin', 'https://foreign.example')
    .set('X-CSRF-Token', csrfA)
    .send({})
    .expect(403);
  await b.get(`/api/projects/${pid}/export`).expect(404);
  assert.notEqual(pid, pidB);
});
test('registration and login use hashed credentials', async () => {
  const agent = supertest.agent(app);
  const input = {
    name: 'Reviewer',
    email: 'person@example.test',
    password: 'long-enough-password',
  };
  const r = await agent.post('/api/auth/register').send(input).expect(201);
  const stored = await User.findOne({ email: input.email }).lean();
  assert.notEqual(stored.password, input.password);
  await agent.post('/api/auth/logout').set('X-CSRF-Token', r.body.csrf).send({}).expect(200);
  await agent.get('/api/workspace').expect(401);
  await agent
    .post('/api/auth/login')
    .send({ ...input, password: 'incorrect-password' })
    .expect(401);
  await agent.post('/api/auth/login').send(input).expect(200);
});
test('concurrent comments survive without overwriting each other', async () => {
  const input = (i) => ({ text: 'Concurrent comment ' + i, x: 12 + i, y: 20, version: 'v1' });
  const responses = await Promise.all([
    post(`projects/${pid}/annotations`, input(1)),
    post(`projects/${pid}/annotations`, input(2)),
  ]);
  responses.forEach((r) => assert.equal(r.status, 201));
  const p = (await a.get('/api/workspace')).body.projects[0];
  assert.equal(p.annotations.filter((n) => n.text.startsWith('Concurrent')).length, 2);
  await post(`projects/${pid}/annotations`, {
    text: 'Bad coordinate',
    x: 101,
    y: 2,
    version: 'v1',
  }).expect(400);
});
test('task evidence and approval rules remain consistent', async () => {
  const path = `projects/${pid}`;
  const input = {
    title: 'Preserve the warm palette',
    annotationId: 'note-2',
    requirementId: 'req-brand',
  };
  const one = await post(path + '/tasks', input).expect(201),
    two = await post(path + '/tasks', input).expect(201);
  assert.equal(one.body.id, two.body.id);
  await patch(path + '/annotations/note-2', { status: 'resolved' }).expect(409);
  await post(path + '/versions/v2/approve', { revision: 0 }).expect(409);
  await patch(path + '/tasks/' + one.body.id, { status: 'done' }).expect(200);
  await patch(path + '/annotations/note-2', { status: 'resolved' }).expect(200);
  let p = (await a.get('/api/workspace')).body.projects[0];
  const revision = p.versions.find((v) => v.id === 'v2').revision;
  await post(path + '/versions/v2/approve', { revision: revision - 1 }).expect(409);
  await post(path + '/versions/v2/approve', { revision }).expect(200);
  await patch(path + '/tasks/' + one.body.id, { status: 'doing' }).expect(200);
  p = (await a.get('/api/workspace')).body.projects[0];
  assert.equal(p.versions.find((v) => v.id === 'v2').status, 'in_review');
  assert.equal(p.annotations.find((n) => n.id === 'note-2').status, 'open');
});
test('uploads verify content, persist and stay inside the workspace', async () => {
  await a
    .post(`/api/projects/${pid}/versions`)
    .set('X-CSRF-Token', csrfA)
    .field('name', 'Fake image')
    .attach('file', Buffer.from('<svg onload="alert(1)"></svg>'), {
      filename: 'image.png',
      contentType: 'image/png',
    })
    .expect(400);
  const bytes = await sharp({
    create: { width: 30, height: 20, channels: 3, background: '#ddccbb' },
  })
    .png()
    .toBuffer();
  const r = await a
    .post(`/api/projects/${pid}/versions`)
    .set('X-CSRF-Token', csrfA)
    .field('name', 'Test revision')
    .attach('file', bytes, { filename: 'revision.png', contentType: 'image/png' })
    .expect(201);
  await a
    .get('/api/assets/' + r.body.assetId)
    .expect('Content-Type', /image\/webp/)
    .expect(200);
  await b.get('/api/assets/' + r.body.assetId).expect(404);
  assert.ok(await Asset.findById(r.body.assetId));
});
test('review link exposes only one version and can be revoked', async () => {
  const link = await post(`projects/${pid}/versions/v1/share`, {}).expect(201);
  const token = link.body.path.split('/').at(-1),
    guest = supertest(app);
  let shared = (await guest.get('/api/review/' + token).expect(200)).body;
  assert.equal(shared.project.versions.length, 1);
  assert.equal(shared.version.id, 'v1');
  assert.ok(shared.project.annotations.every((n) => n.version === 'v1'));
  await guest
    .post('/api/review/' + token + '/comments')
    .send({ name: 'Client', text: 'Please increase the heading contrast.', x: 40, y: 20 })
    .expect(201);
  await guest
    .post('/api/review/' + token + '/approve')
    .send({ name: 'Client', revision: 0 })
    .expect(409);
  await a
    .delete('/api/shares/' + link.body.id)
    .set('X-CSRF-Token', csrfA)
    .send({})
    .expect(200);
  await guest.get('/api/review/' + token).expect(404);
});
test('assistant proposals cite actual evidence and require explicit apply', async () => {
  const path = `projects/${pid}`,
    before = (await a.get('/api/workspace')).body.projects[0].requirements.length;
  const r = await post(path + '/assistant', { kind: 'plan' }).expect(200);
  assert.equal(r.body.mode, 'local');
  assert.ok(r.body.requirements.length > 0);
  let p = (await a.get('/api/workspace')).body.projects[0];
  assert.equal(p.requirements.length, before);
  const payload = { requirements: r.body.requirements, tasks: [] };
  await post(path + '/proposals/' + r.body.id + '/apply', payload).expect(200);
  await post(path + '/proposals/' + r.body.id + '/apply', payload).expect(200);
  p = (await a.get('/api/workspace')).body.projects[0];
  assert.equal(p.requirements.length, before + payload.requirements.length);
  assert.throws(() =>
    validateOutput({ summary: 'Test', requirements: [], tasks: [], evidenceIds: ['made-up'] }, p),
  );
  const answer = localAssistant(p, 'ask', 'somethingunsupportedxyz');
  assert.match(answer.summary, /could not find/i);
});
