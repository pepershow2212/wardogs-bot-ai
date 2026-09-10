import { ingestWebKnowledge } from './lib/webKnowledge.js';

try {
  const result = await ingestWebKnowledge();
  console.log(`web knowledge ok sources=${result.sources} failed=${result.failed} chars=${result.chars}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
