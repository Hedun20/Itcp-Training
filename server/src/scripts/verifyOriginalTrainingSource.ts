import { pathToFileURL } from 'node:url';
import {
  comparePrototypeTrainingContent,
  compareStructuredTrainingContent,
  type LegacyProjection,
} from '../data/trainingContentParity';
import { structuredSeedCourses } from '../seeds/courses';

async function main() {
  const prototypePath = process.argv[2];
  let prototypeAudit;
  if (prototypePath) {
    const prototypeModule = (await import(pathToFileURL(prototypePath).href)) as {
      TRAININGS?: ReadonlyArray<LegacyProjection>;
    };
    if (!prototypeModule.TRAININGS) throw new Error(`TRAININGS export not found in ${prototypePath}`);
    prototypeAudit = comparePrototypeTrainingContent(prototypeModule.TRAININGS);
  }

  const structuredAudit = compareStructuredTrainingContent(structuredSeedCourses());
  const report = { prototypePath: prototypePath ?? null, prototypeAudit: prototypeAudit ?? null, structuredAudit };
  console.log(JSON.stringify(report, null, 2));
  if (
    !structuredAudit.sourceMatchesAuthoritativeManifest ||
    !structuredAudit.exactMatch ||
    (prototypeAudit && (!prototypeAudit.exactMatch || !prototypeAudit.prototypeMatchesManifest))
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Original training source verification failed', error);
  process.exitCode = 1;
});
