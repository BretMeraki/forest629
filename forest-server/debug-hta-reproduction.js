// @ts-nocheck
// debug-hta-reproduction.js
// -------------------------------------------------------------
// Lightweight script to exercise the defensive logic inside the HTA
// processing pipeline.  It simulates malformed inputs that historically
// caused a TypeError (reading 'length' of undefined) and prints the
// outcome.  The script is intentionally dependency-free so it can run in
// any environment without requiring a full Forest.os setup.
// -------------------------------------------------------------

 

// --- Local replica of the critical helper methods -------------------------
const GENERATION_LIMITS = { MAX_HTA_DEPTH: 3, MAX_TASKS_PER_BRANCH: 12 };

function validateAndNormalizeTasks(tasks) {
  if (tasks == null) return [];
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(t => t && typeof t === 'object');
}

function createSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function _formatBranchTitle(slug) {
  return String(slug)
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function processHierarchicalBranch(branch, htaData, parentId, depth) {
  if (!branch || typeof branch !== 'object') branch = {};

  const subBranches = validateAndNormalizeTasks(branch.sub_branches);
  const tasksList  = validateAndNormalizeTasks(branch.tasks);

  const slug = createSlug(branch.branch_name || `branch_${depth}_${htaData.frontierNodes.length}`);
  const branchId = parentId ? `${parentId}_${slug}` : slug;

  // Recurse – respect depth cap
  if (depth < GENERATION_LIMITS.MAX_HTA_DEPTH) {
    for (const sb of subBranches) {
      await processHierarchicalBranch(sb, htaData, branchId, depth + 1);
    }
  }

  // Tasks (bounded slice)
  for (const task of tasksList.slice(0, GENERATION_LIMITS.MAX_TASKS_PER_BRANCH)) {
    htaData.frontierNodes.push({
      id: `node_${htaData.frontierNodes.length + 1}`,
      title: task.title || 'Untitled',
      branch: branchId,
      depth,
    });
  }
}

// ------------------- Malformed Payloads -----------------------------------
const malformedPayloads = [
  undefined,
  null,
  'string',
  123,
  {},
  { branch_name: 'bad_tasks', tasks: 'oops' },
  { branch_name: 'bad_subs', sub_branches: 'oops' },
  {
    branch_name: 'nested',
    sub_branches: [{ branch_name: 'lvl2', sub_branches: [{ branch_name: 'lvl3', sub_branches: [{ branch_name: 'lvl4', tasks: [{ title: 'Too deep' }] }] }] }]
  },
];

(async () => {
  const htaData = { frontierNodes: [] };
  let failures = 0;

  for (let i = 0; i < malformedPayloads.length; i++) {
    try {
      await processHierarchicalBranch(malformedPayloads[i], htaData, null, 1);
      console.info(`Case ${i}: ✅ processed without exception`);
    } catch (err) {
      failures++;
      console.error(`Case ${i}: ❌ threw error –`, err.message);
    }
  }

  console.info('\nSummary');
  console.info('================');
  console.info('Frontier nodes generated:', htaData.frontierNodes.length);
  console.info('Failures              :', failures);

  if (failures > 0) process.exitCode = 1;
})(); 