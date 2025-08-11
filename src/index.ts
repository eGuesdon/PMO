import 'dotenv/config';
import fetch from 'node-fetch';
import { ApiConfigService } from './core/utils/ApiConfigService';
import { ApiServiceManager } from './core/utils/ApiServiceManager';
import { JiraPage } from './JiraService/jiraApiInterfaces/JiraPage';
import JiraServiceManager, { JiraProject } from './JiraService/JiraServiceManager';
import { CountIssuesQueryParams, GetIssuesQueryParams } from './JiraService/jiraApiInterfaces/QueryParams';
import { upsertIssues } from './JiraService/persistence/sqlite';
import { ProjectPage } from './JiraService/jiraApiInterfaces/JiraProject';

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
  expand: 'insight,lead',
  status: ['archived', 'live'],
};

async function init() {
  const apiLibPath = process.env.API_LIB;
  if (!apiLibPath) {
    console.error('❌ La variable d’environnement API_LIB n’est pas définie.');
    process.exit(1);
  }
  //const data: JiraPage[] = await (await ApiServiceManager.getInstance(apiLibPath)).getData('Atlassian', 'getIssues', params);
  //upsertIssues('/Users/ericguesdon/Documents/Documents - MacBook Pro de Eric/Personnel/Cahe/Eric/PMO/demo.db', data);
  //const count: any = await (await ApiServiceManager.getInstance(apiLibPath)).getData('Atlassian', 'CountIssues', countParams);
  //const fields: any = await (await ApiServiceManager.getInstance(apiLibPath)).getData('Atlassian', 'GetFields', GetFieldsQueryParams);
  //upsertIssues('/Users/ericguesdon/Documents/Documents - MacBook Pro de Eric/Personnel/Cahe/Eric/PMO/demo.db', fields);
  const project: ProjectPage[] = await (await ApiServiceManager.getInstance(apiLibPath)).getData('Atlassian', 'getProjects', GetProjectsQueryParams);
  // Pour chaque page
  /**
   * 
  data.forEach((page, pIdx) => {
    console.log(`=== Page ${pIdx + 1} ===`);
    page.issues.forEach((issue, iIdx) => {
      console.log(`Issue ${iIdx + 1} sur page ${pIdx + 1}:`);
      console.dir(issue, { depth: null, colors: true });
    });
  });
  */

  project.forEach((page, pIdx) => {
    console.log(`=== Page ${pIdx + 1} ===`);
    page.values.forEach((value, iIdx) => {
      console.log(`Project ${iIdx + 1} sur page ${pIdx + 1}:`);
      console.dir(value, { depth: null, colors: true });
    });
  });

  //console.log(project);
}

async function main() {
  const jsm:{ key: string; name: string; }[] = await JiraServiceManager.getInstance().listLiveProjects();
  console.log(jsm);
}

main();
