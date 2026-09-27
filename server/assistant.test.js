import test from 'node:test';
import assert from 'node:assert/strict';
import { assist, validateOutput, localAssistant } from './lib/assistant.js';
import { projectSeed } from './lib/seed.js';
test('local assistant refuses to invent unsupported answers', () => {
  const p = projectSeed();
  const answer = localAssistant(p, 'ask', 'xyzunknown');
  assert.equal(answer.evidenceIds.length, 0);
  assert.match(answer.summary, /could not find/);
});
test('proposal references must exist in the project', () => {
  assert.throws(() =>
    validateOutput(
      { summary: 'Advice', requirements: [], tasks: [], evidenceIds: ['unknown-source'] },
      projectSeed(),
    ),
  );
});
test('model provider sends a strict schema and parses grounded responses', async () => {
  const oldKey = process.env.OPENAI_API_KEY,
    oldModel = process.env.OPENAI_MODEL,
    oldFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'test-not-a-real-key';
  process.env.OPENAI_MODEL = 'test-model';
  let sent;
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    sent = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  summary: 'The brief asks for clear plans.',
                  requirements: [],
                  tasks: [],
                  evidenceIds: ['brief'],
                }),
              },
            ],
          },
        ],
      }),
    };
  };
  try {
    const output = await assist(projectSeed(), {
      kind: 'ask',
      question: 'What does the brief say?',
    });
    assert.equal(output.mode, 'openai');
    assert.equal(sent.text.format.strict, true);
    assert.equal(sent.store, false);
    assert.equal(sent.text.format.type, 'json_schema');
    assert.deepEqual(output.evidenceIds, ['brief']);
  } finally {
    global.fetch = oldFetch;
    if (oldKey) process.env.OPENAI_API_KEY = oldKey;
    else delete process.env.OPENAI_API_KEY;
    if (oldModel) process.env.OPENAI_MODEL = oldModel;
    else delete process.env.OPENAI_MODEL;
  }
});
