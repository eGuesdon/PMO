import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const jiraConfigSchema = z.object({
  NEOEN_JIRA_DOMAIN: z.string(),
  NEOEN_JIRA_LOGIN: z.string(),
  NEOEN_JIRA_TOKEN: z.string().min(10),
  API_LIB: z.string(),
});

const parsed = jiraConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuration invalide :', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
