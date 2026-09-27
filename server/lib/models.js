import mongoose from 'mongoose';
const { Schema } = mongoose;
export const User = mongoose.model(
  'User',
  new Schema({
    name: String,
    email: { type: String, unique: true, sparse: true },
    password: String,
    demo: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }),
);
export const Session = mongoose.model(
  'Session',
  new Schema({
    tokenHash: { type: String, unique: true },
    userId: String,
    csrf: String,
    expiresAt: { type: Date, index: { expires: 0 } },
  }),
);
export const Workspace = mongoose.model(
  'FrameWorkspace',
  new Schema(
    { ownerId: { type: String, unique: true }, data: Schema.Types.Mixed },
    { optimisticConcurrency: true },
  ),
);
export const Asset = mongoose.model(
  'Asset',
  new Schema({
    workspaceId: { type: String, index: true },
    projectId: String,
    name: String,
    mime: String,
    size: Number,
    width: Number,
    height: Number,
    sha256: String,
    bytes: Buffer,
    createdAt: { type: Date, default: Date.now },
  }),
);
export const Share = mongoose.model(
  'Share',
  new Schema({
    tokenHash: { type: String, unique: true },
    workspaceId: String,
    projectId: String,
    versionId: String,
    expiresAt: { type: Date, index: { expires: 0 } },
  }),
);
