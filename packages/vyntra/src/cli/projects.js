const { discover } = require('./discover');
const { resolveSetupFile } = require('./config');

// Options of the whole run, which a project can not set for itself.
const RUN_OPTIONS = [
  'projects',
  'reporter',
  'shard',
  'outputDir',
  'lastFailed',
  'failOnFlaky',
  'bail',
  'passWithNoTests',
  'coverage',
  'coverageDirectory',
  'coverageReporters',
  'coverageThreshold',
  'collectCoverageFrom',
  'coverageInclude',
];

// A project's own, not inherited from the top level: the top level's are the whole run's.
const OWN_OPTIONS = ['name', 'dependsOn', 'globalSetup', 'globalTeardown', 'server'];

const list = (value) => [value ?? []].flat().filter(Boolean);

function hooksOf(config) {
  return {
    globalSetup: list(config.globalSetup).map((file) => resolveSetupFile(file, config.rootDir)),
    globalTeardown: list(config.globalTeardown).map((file) => resolveSetupFile(file, config.rootDir)),
    server: config.server ?? null,
  };
}

function projectConfig(base, project, index) {
  const inherited = Object.fromEntries(
    Object.entries(base).filter(([key]) => !RUN_OPTIONS.includes(key) && !OWN_OPTIONS.includes(key))
  );
  const own = Object.fromEntries(Object.entries(project).filter(([key]) => !OWN_OPTIONS.includes(key)));
  const config = { ...inherited, ...own, rootDir: base.rootDir, projectName: project.name, projectIndex: index };
  if (own.setupFiles) {
    config.setupFiles = own.setupFiles.map((file) => resolveSetupFile(file, base.rootDir));
  }
  if (own.use) {
    config.use = { ...base.use, ...own.use };
  }
  // Workers load a project's plugins from the config file too.
  config.transformPlugins = [config.plugins ?? []]
    .flat(Infinity)
    .some((plugin) => typeof plugin?.transform === 'function');
  return config;
}

// Projects whose dependencies form a cycle, or name projects that do not exist: what is wrong, or null.
function problemsOf(projects) {
  const names = projects.map((project) => project.name);
  const duplicate = names.find((name, i) => names.indexOf(name) !== i);
  if (duplicate) {
    return `Two projects are named "${duplicate}"`;
  }
  const missing = projects.flatMap((project) =>
    project.dependsOn.filter((dep) => !names.includes(dep)).map((dep) => `${project.name} depends on ${dep}`)
  );
  if (missing.length > 0) {
    return `Unknown projects in dependsOn: ${missing.join(', ')}`;
  }
  const visiting = new Set();
  const done = new Set();
  const byName = new Map(projects.map((project) => [project.name, project]));
  const cycle = (name, trail) => {
    if (done.has(name)) {
      return null;
    }
    if (visiting.has(name)) {
      return [...trail, name];
    }
    visiting.add(name);
    const found = byName.get(name).dependsOn.reduce((result, dep) => result ?? cycle(dep, [...trail, name]), null);
    visiting.delete(name);
    done.add(name);
    return found;
  };
  const found = names.reduce((result, name) => result ?? cycle(name, []), null);
  return found ? `Projects depend on each other: ${found.join(' -> ')}` : null;
}

// The projects of the run: { name, config, dependsOn, globalSetup, globalTeardown, server }, and the setup of the run
// itself (the top level's globalSetup and server, around every project). A config without projects is one project,
// with no name, which the run's setup is the setup of. Throws on a config that can not run.
function resolveProjects(config, selected = []) {
  if (!config.projects) {
    return {
      run: hooksOf({ rootDir: config.rootDir }),
      projects: [{ name: null, config, dependsOn: [], ...hooksOf(config) }],
    };
  }
  if (!Array.isArray(config.projects) || config.projects.length === 0) {
    throw new Error('projects is a list of projects: [{ name, include, ... }]');
  }
  const all = config.projects.map((project, index) => {
    if (typeof project !== 'object' || project === null) {
      throw new Error(`Project ${index + 1} is not an object: a project is { name, include, ... }`);
    }
    const name = project.name ?? `project-${index + 1}`;
    return {
      name,
      config: projectConfig(config, { ...project, name }, index),
      dependsOn: list(project.dependsOn),
      ...hooksOf({ ...project, rootDir: config.rootDir }),
    };
  });
  const problem = problemsOf(all);
  if (problem) {
    throw new Error(problem);
  }
  const wanted = list(selected).flatMap((name) =>
    String(name)
      .split(',')
      .map((one) => one.trim())
  );
  const unknown = wanted.filter((name) => !all.some((project) => project.name === name));
  if (unknown.length > 0) {
    throw new Error(`Unknown project: ${unknown.join(', ')} (${all.map((project) => project.name).join(', ')})`);
  }
  // Every project, as files belong to the first that includes them whichever are selected; selected: those to run.
  return { run: hooksOf(config), projects: all, selected: wanted.length > 0 ? new Set(wanted) : null };
}

// The test files of each project: a file belongs to the first project that includes it.
function assignFiles(projects, patterns) {
  const taken = new Set();
  return projects.map((project) => {
    const files = discover(project.config, patterns).filter((file) => !taken.has(file));
    files.forEach((file) => taken.add(file));
    return { ...project, files };
  });
}

module.exports = { resolveProjects, assignFiles };
