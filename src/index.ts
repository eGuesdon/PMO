import BazefieldManager from './CustomerAndServiceManager/BazefieldManager';
import JiraInstanceManager from './CustomerAndServiceManager/JiraInstanceManager';
import { CountIssuesQueryParams, GetIssuesQueryParams } from './JiraService/jiraApiInterfaces/QueryParams';
import JiraServiceManager, { JiraProject } from './JiraService/JiraServiceManager';
import 'dotenv/config';

const jql: string = 'project = PBPD';

const params: GetIssuesQueryParams = {
  jql: jql,
  fields: ['key', 'summary', 'status', 'project', 'issuetype', 'priority', 'assignee', 'attachment', 'watcher', 'parent', 'created', 'updated'],
};

const countParams: CountIssuesQueryParams = {
  jql: jql,
};

const GetFieldsQueryParams = {};

const GetProjectsQueryParams = {
  startAt: 0,
  maxResults: 100,
  status: ['live', 'archived', 'deleted'],
  keys: ['PBP', 'PBPD'],
  expand: 'description,lead,issueTypes,url,projectKeys,permissions,insight',
};

async function main() {
  const bzf = await BazefieldManager.readyFromEnv(); // ⬅️ important
  const jpl: JiraProject[] = bzf.getBZFProject();

  jpl.forEach((jp) => {
    console.log(jp.key + ' ' + jp.id + ' ' + jp.name);
  });
}

async function main2() {
  const instMgr = await JiraInstanceManager.readyFromEnv();
  const projects = instMgr.getInstanceProjects(); // JiraProject[]
  const totalProj = instMgr.countProjects();
  const byType = instMgr.countProjectsByType();
  const totalIssues = instMgr.totalIssuesFromInsight();
  const lastUpd = instMgr.lastIssueUpdateTime();
  const withLead = instMgr.countProjectsWithActiveLead();
  const activeProject = instMgr.countActiveProjects();
  const projectHistory = instMgr.projectCreationHistory();

  console.log(instMgr);
  //console.log(projects);
  console.log(totalProj);
  console.log(byType);
  console.log(totalIssues);
  console.log(lastUpd);
  console.log(withLead);
  console.log(activeProject);
  console.log(projectHistory);
}

main2();
