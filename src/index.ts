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
  maxResults: 10,
  expand: 'insight,lead',
  status: ['live'],
};

async function main() {
  //const jif: JiraInstanceField[] = await JiraServiceManager.getInstance().getJiraInstanceFieldList(GetFieldsQueryParams);
  //const jpl: JiraProject[] = await JiraServiceManager.getInstance().getProjectList(GetProjectsQueryParams);
  const PBPD: JiraProject = await BazefieldManager.getInstance().getProjectById('10308', GetProjectsQueryParams);
  console.log(PBPD);
}

main();
