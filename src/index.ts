import 'dotenv/config';
import fetch from 'node-fetch';
import { ApiConfigService } from './core/utils/ApiConfigService';
import { ApiServiceManager } from './core/utils/ApiServiceManager';

interface QueryParams {
  jql: string;
}

export async function getData(acs: ApiConfigService, vendorName: string, endPointName: string, params: QueryParams): Promise<any> {
  const endpoint = await acs.getEndpoint(vendorName, 'countIssues');
  if (!endpoint) {
    throw new Error(`Endpoint countIssues introuvable pour ${vendorName}`);
  }
  const url = new URL(endpoint.path, process.env.JIRA_DOMAIN!);
  const body = {
    ...params,
  };

  const jiraLogin = process.env.JIRA_LOGIN || '';
  const apiToken = process.env.JIRA_TOKEN || '';
  const credentials = `${jiraLogin}:${apiToken}`;
  const basicAuth = 'Basic ' + Buffer.from(credentials, 'utf8').toString('base64');

  const response = await fetch(url.toString(), {
    method: endpoint.method,
    headers: {
      ...endpoint.headers,
      Authorization: basicAuth,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function init() {
  const apiLibPath = process.env.API_LIB;
  if (!apiLibPath) {
    console.error('❌ La variable d’environnement API_LIB n’est pas définie.');
    process.exit(1);
  }

  const acs = await ApiConfigService.getInstance(apiLibPath);
  const param = { jql: 'project = PBPD and issuetype in ("Asset Connectivity","BZF Data Integration")' };
  try {
    const result = await getData(acs, 'Atlassian', 'countIssues', param);
    console.log('Nombre approximatif d’issues :', result.count);
  } catch (err: any) {
    console.error('Erreur countIssues :', err.message);
  }
}

async function main() {
  const apiLibPath = process.env.API_LIB;
  if (!apiLibPath) {
    console.error('❌ La variable d’environnement API_LIB n’est pas définie.');
    process.exit(1);
  }
  const data = await (await ApiServiceManager.getInstance(apiLibPath)).getData('Atlassian', 'countIssues', { jql: 'project = PBP' });
  console.log(data);
}

// init();

main();
