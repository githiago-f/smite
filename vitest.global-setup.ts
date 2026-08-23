import { buildTemplates } from "./scripts/build-templates.mjs";

export default async (): Promise<void> => {
  await buildTemplates();
};
