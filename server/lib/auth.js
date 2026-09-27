import { randomBytes, createHash, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Session, User, Workspace } from './models.js';
import { workspaceSeed } from './seed.js';
import { HttpError } from './store.js';
const scrypt = promisify(scryptCb);
export const hash = (s) => createHash('sha256').update(s).digest('hex');
export async function passwordHash(value) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(value, salt, 64);
  return salt + ':' + key.toString('hex');
}
export async function passwordCheck(value, stored) {
  const [salt, hex] = stored.split(':');
  const key = await scrypt(value, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export async function newSession(user, res) {
  const token = randomBytes(32).toString('hex'),
    csrf = randomBytes(24).toString('hex');
  await Session.create({
    tokenHash: hash(token),
    csrf,
    userId: String(user._id),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie('ff_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 7 * 86400000,
    path: '/',
  });
  return csrf;
}
export async function identify(req, res, next) {
  try {
    const token = req.cookies.ff_session;
    if (!token) return next();
    const session = await Session.findOne({
      tokenHash: hash(token),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!session) return next();
    const user = await User.findById(session.userId).lean();
    if (!user) return next();
    const w = await Workspace.findOne({ ownerId: String(user._id) })
      .select('_id')
      .lean();
    req.identity = { user, workspaceId: String(w._id), csrf: session.csrf };
    next();
  } catch (e) {
    next(e);
  }
}
export function requireAuth(req, res, next) {
  if (!req.identity) return next(new HttpError(401, 'Sign in to continue.'));
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers['x-csrf-token'] !== req.identity.csrf
  )
    return next(new HttpError(403, 'Refresh the page and try again.'));
  next();
}
export async function createUser({ name, email, password, demo = false }) {
  const user = await User.create({
    name,
    ...(email ? { email, password: await passwordHash(password) } : {}),
    demo,
  });
  const workspace = await Workspace.create({ ownerId: String(user._id), data: workspaceSeed() });
  return { user, workspace };
}
export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email || null,
  demo: u.demo,
});
