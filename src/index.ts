import BazefieldManager from './CustomerAndServiceManager/BazefieldManager';
import { CountIssuesQueryParams, GetIssuesQueryParams } from './JiraService/jiraApiInterfaces/QueryParams';
import JiraServiceManager, { JiraProject } from './JiraService/JiraServiceManager';

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

  console.log('Je suis ici');

  jpl.forEach((jp) => {
    console.log(jp.name);
  });
}

main();
