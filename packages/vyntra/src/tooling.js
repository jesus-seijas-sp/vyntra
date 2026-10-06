// What tools around the runner use (the MCP server's live sessions), as `require('vyntra/tooling')`: a project of
// the config, with the servers its tests run against, and the class that starts them as a run does.
const { loadConfig } = require('./cli/config');
const { resolveProjects } = require('./cli/projects');
const { TestServer, answers } = require('./cli/server');

const usesWeb = (config) => [config.engine ?? []].flat().includes('web');

// The project named (or the first one with the web engine, or the first one) of the config at rootDir: { name,
// config, servers }, its servers being the run's and the project's `server` options, in the order a run starts them.
async function loadProject(rootDir, name = null) {
  const config = await loadConfig({ rootDir });
  const { run, projects } = resolveProjects(config);
  const project = name
    ? projects.find((candidate) => candidate.name === name)
    : (projects.find((candidate) => usesWeb(candidate.config)) ?? projects[0]);
  if (!project) {
    const names = projects.map((candidate) => candidate.name).filter(Boolean);
    throw new Error(`There is no project ${name}${names.length > 0 ? `: ${names.join(', ')}` : ''}`);
  }
  return { name: project.name, config: project.config, servers: [run.server, project.server].filter(Boolean) };
}

module.exports = { loadProject, TestServer, answers };
