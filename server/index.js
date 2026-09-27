import 'dotenv/config';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { Session, Workspace } from './lib/models.js';
import { hash } from './lib/auth.js';
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/frameflow', {
  serverSelectionTimeoutMS: 10000,
});
const app = createApp(),
  server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: (
      process.env.ALLOWED_ORIGINS ||
      'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4310'
    ).split(','),
    credentials: true,
  },
});
app.set('io', io);
io.use(async (socket, next) => {
  try {
    const token = socket.request.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('ff_session='))
      ?.slice(11);
    if (!token) return next(Error('Unauthorized'));
    const session = await Session.findOne({
      tokenHash: hash(token),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!session || socket.handshake.auth?.csrf !== session.csrf)
      return next(Error('Unauthorized'));
    const w = await Workspace.findOne({ ownerId: session.userId }).select('_id').lean();
    socket.data.workspaceId = String(w._id);
    next();
  } catch (e) {
    next(Error('Unauthorized'));
  }
});
io.on('connection', (socket) => socket.join(socket.data.workspaceId));
server.listen(process.env.PORT || 4310, process.env.HOST || '127.0.0.1', () =>
  console.log('FrameFlow API connected to MongoDB on port ' + (process.env.PORT || 4310)),
);
async function shutdown() {
  io.close();
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
