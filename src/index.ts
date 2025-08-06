// src/index.ts
import 'dotenv/config';
import { FileLoader } from './core/utils/FileLoader';
import { ApiConfigService } from './core/utils/ApiConfigService';
import { EndpointConfig, VendorConfigService } from './core/utils/VendorConfigService';

async function init() {
  const apiLibPath = process.env.API_LIB;
  if (!apiLibPath) {
    console.error('❌ La variable d’environnement API_LIB n’est pas définie.');
    process.exit(1);
  }
  const acs: ApiConfigService = await ApiConfigService.getInstance(apiLibPath);
  //console.log(await acs.getVendorService('Atlassian'));
  console.log(await acs.getEndpointsNamesByFamily('Atlassian', 'search'));
  const epc: EndpointConfig | undefined = await acs.getEndpoint('Atlassian', 'getIssues');
  console.log(epc?.path);
}

init();
