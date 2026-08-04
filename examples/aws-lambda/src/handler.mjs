import { lambdaify } from "@smitejs/serverless/aws";
import { app } from "./app.mjs";

export const handler = lambdaify(app);
