import 'dotenv/config';
import fetch from 'node-fetch';
import { ApiConfigService } from './core/utils/ApiConfigService';
import { ApiServiceManager } from './core/utils/ApiServiceManager';
import { JiraPage } from './config/apiInterfaces/JiraPage';
import { CountIssuesQueryParams, GetIssuesQueryParams } from './config/apiInterfaces/QueryParams';
import { upsertIssues } from './customerAndProjectManager/neoen/persistence/sqlite';

const jql: string = 'project = PBPD';

const params: GetIssuesQueryParams = {
  jql: jql,
  fields: ['key', 'summary', 'status'],
};

const countParams: CountIssuesQueryParams = {
  jql: jql,
};

async function main() {
  const apiLibPath = process.env.API_LIB;
  if (!apiLibPath) {
    console.error('❌ La variable d’environnement API_LIB n’est pas définie.');
    process.exit(1);
  }
  const data: JiraPage[] = await (await ApiServiceManager.getInstance(apiLibPath)).getData('Atlassian', 'getIssues', params);
  //upsertIssues('/Users/ericguesdon/Documents/Documents - MacBook Pro de Eric/Personnel/Cahe/Eric/PMO/demo.db', data);
  //const count: any = await (await ApiServiceManager.getInstance(apiLibPath)).getData('Atlassian', 'CountIssues', countParams);
  // Pour chaque page
  data.forEach((page, pIdx) => {
    console.log(`=== Page ${pIdx + 1} ===`);
    page.issues.forEach((issue, iIdx) => {
      console.log(`Issue ${iIdx + 1} sur page ${pIdx + 1}:`);
      console.dir(issue, { depth: null, colors: true });
    });
  });
}

main();
