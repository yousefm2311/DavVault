#!/usr/bin/env node
'use strict';

const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'backend', 'node_modules', 'mongoose'));

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/devvault';
const apply = process.env.APPLY_REINDEX === 'true';

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const snippets = await db.collection('snippets').find({
    sourceProjectId: { $exists: true, $ne: null },
  }, {
    projection: { _id: 1, userId: 1, sourceProjectId: 1 },
  }).toArray();

  let candidates = 0;
  let updated = 0;

  for (const snippet of snippets) {
    if (!snippet._id || !snippet.userId || !snippet.sourceProjectId) continue;
    const filter = {
      sourceType: 'snippet',
      sourceId: snippet._id,
      userId: snippet.userId,
      $or: [{ projectId: { $exists: false } }, { projectId: null }],
    };
    const count = await db.collection('embeddings').countDocuments(filter);
    candidates += count;
    if (apply && count > 0) {
      const result = await db.collection('embeddings').updateMany(filter, {
        $set: { projectId: snippet.sourceProjectId },
      });
      updated += result.modifiedCount;
    }
  }

  console.log(JSON.stringify({
    dryRun: !apply,
    candidateEmbeddings: candidates,
    updatedEmbeddings: updated,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      error: 'Snippet embedding reindex failed.',
      code: 'SNIPPET_EMBEDDING_REINDEX_FAILED',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
