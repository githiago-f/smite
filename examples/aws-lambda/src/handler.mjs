import { lambdaify } from "@smite/serverless/aws";
import { app } from "./app.mjs";

export const handler = lambdaify(app);
