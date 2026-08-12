import { z } from "zod";

const configSchema = z.object({
  THINKINGDATA_BASE_URL: z.string().url(),
  THINKINGDATA_PROJECT_ID: z.string().min(1),
  THINKINGDATA_QUERY_TOKEN: z.string().min(1),
});

export type Config = {
  baseUrl: string;
  projectId: string;
  queryToken: string;
};

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const value = configSchema.parse(env);
  return {
    baseUrl: value.THINKINGDATA_BASE_URL,
    projectId: value.THINKINGDATA_PROJECT_ID,
    queryToken: value.THINKINGDATA_QUERY_TOKEN,
  };
}
