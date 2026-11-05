import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const levels = ['info', 'low', 'moderate', 'high', 'critical'];
const minimatchAdvisory = 'https://github.com/advisories/GHSA-g3hv-75wg-m249';

// This exact release does not have optimizationLevel or firstPhasePreProcess.
// The advisory's <11.0.1 range includes it, but its vulnerable code does not.
// Do not extend this exception to newer releases or other advisories.
const unaffectedMinimatchVersions = new Set(['3.1.5']);

export function assessAudit(report, lock) {
  if (
    report.error ||
    report.auditReportVersion !== 2 ||
    !report.vulnerabilities
  ) {
    throw new Error('npm did not return a valid version 2 audit report.');
  }

  const findings = new Map();
  const exceptions = new Set();
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
      throw new Error(`Missing advisory information for ${name}.`);
    }
    for (const advisory of vulnerability.via) {
      if (typeof advisory === 'string') {
        if (!report.vulnerabilities[advisory]) {
          throw new Error(`Missing dependency advisory: ${advisory}.`);
        }
        continue;
      }
      if (!advisory || !levels.includes(advisory.severity) || !advisory.url) {
        throw new Error(`Invalid advisory for ${name}.`);
      }
      const unaffected =
        name === 'minimatch' &&
        advisory.name === 'minimatch' &&
        advisory.url === minimatchAdvisory &&
        advisory.severity === 'moderate' &&
        vulnerability.nodes?.length > 0 &&
        vulnerability.nodes.every(
          node =>
            /(^|\/)node_modules\/minimatch$/.test(node) &&
            unaffectedMinimatchVersions.has(lock.packages?.[node]?.version)
        );
      if (unaffected) {
        exceptions.add(advisory.url);
      } else if (
        levels.indexOf(advisory.severity) >= levels.indexOf('moderate')
      ) {
        findings.set(advisory.url, advisory);
      }
    }
  }
  // Reject reports whose dependency findings have no underlying advisory.
  const hasAdvisory = (name, visited = new Set()) => {
    if (visited.has(name)) return false;
    visited.add(name);
    return report.vulnerabilities[name].via.some(
      via => typeof via !== 'string' || hasAdvisory(via, visited)
    );
  };
  for (const name of Object.keys(report.vulnerabilities)) {
    if (!hasAdvisory(name))
      throw new Error(`No underlying advisory for ${name}.`);
  }
  return { findings: [...findings.values()], exceptions: [...exceptions] };
}

function main() {
  const root = new URL('../', import.meta.url);
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(
      result.error?.message || result.stderr || 'npm audit failed.'
    );
  }
  const report = JSON.parse(result.stdout);
  const lock = JSON.parse(
    readFileSync(new URL('package-lock.json', root), 'utf8')
  );
  const { findings, exceptions } = assessAudit(report, lock);
  for (const url of exceptions) {
    console.log(
      `Not affected: minimatch 3.1.5 lacks the reported preprocessing code (${url}).`
    );
  }
  for (const finding of findings) {
    console.error(`${finding.severity}: ${finding.title} (${finding.url})`);
  }
  console.log(
    `Security audit: ${findings.length} blocking advisories at moderate or higher.`
  );
  process.exitCode = findings.length > 0 ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(`Security audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
