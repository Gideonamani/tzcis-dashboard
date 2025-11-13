/***** DATA PIPELINE ORCHESTRATION ********************************************
 *
 * Central place to describe when each data collector should run and when the
 * RAW ➜ PARSED normalization should fire. Attach a time-driven trigger to
 * runDataPipelineTick() (e.g. every hour) and this file will decide whether a
 * given step is due based on the cadence below.
 *
 * - Edit PIPELINE_COLLECTORS to add/remove scraping entry points.
 * - Adjust intervalMinutes to taste.
 * - The parse step waits for the collectors to run recently before it fires.
 * - Script properties are used to remember the last successful execution time
 *   per step (key: pipeline:last:{stepId}).
 *
 *****************************************************************************/

const PIPELINE_COLLECTORS = [
  {
    id: 'selectors',
    label: 'Config-driven HTML table scrapers',
    handler: 'scrapeFromConfig',
    intervalMinutes: 180 // every 3 hours
  },
  {
    id: 'itrust',
    label: 'iTrust API collector',
    handler: 'updateFromConfig_ItrustOnly',
    intervalMinutes: 180
  },
  {
    id: 'utt',
    label: 'UTTAMIS NAV scrape',
    handler: 'scrapeUttamisFundPerformance',
    intervalMinutes: 180
  }
];

const PIPELINE_PARSE = {
  id: 'parse',
  label: 'Normalize RAW ➜ PARSED (processAllFunds)',
  handler: 'processAllFunds',
  intervalMinutes: 360,            // every 6 hours
  dependsOn: PIPELINE_COLLECTORS.map(step => step.id),
  dependsOnMaxAgeMinutes: 120      // collectors must be fresh within ~2 hours
};

const PIPELINE_LATEST = {
  id: 'latest',
  label: 'Refresh latest fund snapshots',
  handler: 'refreshLatestFundDataSheet',
  intervalMinutes: 360,
  dependsOn: ['parse'],
  dependsOnMaxAgeMinutes: 60
};

/***** PUBLIC ENTRY POINTS ****************************************************/

/**
 * Trigger target. Evaluates the cadence definitions and runs the steps that
 * are due (collectors first, parser last).
 */
function runDataPipelineTick() {
  runPipelineInternal_({ force: false });
}

/**
 * Manual helper to process every step regardless of the stored cadence.
 */
function runPipelineNow() {
  runPipelineInternal_({ force: true });
}

/**
 * Install a single hourly trigger for runDataPipelineTick().
 */
function installDataPipelineTrigger() {
  removeDataPipelineTriggers();
  ScriptApp.newTrigger('runDataPipelineTick').timeBased().everyHours(1).create();
}

/**
 * Remove any triggers that call runDataPipelineTick().
 */
function removeDataPipelineTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction && t.getHandlerFunction() === 'runDataPipelineTick')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/**
 * Clear the remembered last-run timestamps (e.g. after changing cadence).
 */
function resetPipelineCadenceState() {
  const props = PropertiesService.getScriptProperties();
  getAllPipelineSteps_().forEach(step => props.deleteProperty(stepKey_(step.id)));
}

/***** CORE IMPLEMENTATION ****************************************************/

function runPipelineInternal_(opts) {
  const force = !!(opts && opts.force);
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  const logs = [];

  getAllPipelineSteps_().forEach(step => {
    const { message } = maybeRunPipelineStep_(step, props, now, force);
    logs.push(message);
  });

  Logger.log(logs.join('\n'));
}

function maybeRunPipelineStep_(step, props, now, force) {
  if (!force) {
    const due = stepDue_(step, props, now);
    if (!due.shouldRun) {
      return {
        status: 'skipped',
        message: `↷ ${step.label}: ${due.reason}`
      };
    }
  }

  try {
    invokeHandler_(step.handler);
    props.setProperty(stepKey_(step.id), String(now));
    return {
      status: 'ran',
      message: `✔ ${step.label} (${step.handler})`
    };
  } catch (err) {
    return {
      status: 'error',
      message: `✖ ${step.label}: ${err && err.message ? err.message : err}`
    };
  }
}

function stepDue_(step, props, now) {
  const lastRun = Number(props.getProperty(stepKey_(step.id)) || 0);
  const intervalMs = Math.max(1, Number(step.intervalMinutes) || 60) * 60000;
  if (lastRun && (now - lastRun) < intervalMs) {
    const minsLeft = Math.ceil((intervalMs - (now - lastRun)) / 60000);
    return { shouldRun: false, reason: `next window in ~${minsLeft}m` };
  }

  if (Array.isArray(step.dependsOn) && step.dependsOn.length) {
    const maxAge = Math.max(1, Number(step.dependsOnMaxAgeMinutes) || 120) * 60000;
    for (const depId of step.dependsOn) {
      const depLast = Number(props.getProperty(stepKey_(depId)) || 0);
      if (!depLast) {
        return { shouldRun: false, reason: `waiting for ${depId} to run once` };
      }
      if ((now - depLast) > maxAge) {
        const mins = Math.floor((now - depLast) / 60000);
        return { shouldRun: false, reason: `${depId} is stale (${mins}m)` };
      }
    }
  }

  return { shouldRun: true, reason: '' };
}

function getAllPipelineSteps_() {
  return PIPELINE_COLLECTORS.concat([PIPELINE_PARSE, PIPELINE_LATEST]);
}

function stepKey_(id) {
  return `pipeline:last:${id}`;
}

function invokeHandler_(name) {
  const root = (typeof globalThis !== 'undefined') ? globalThis : this;
  const fn = root && root[name];
  if (typeof fn !== 'function') {
    throw new Error(`Handler '${name}' is not defined in the project.`);
  }
  return fn();
}
