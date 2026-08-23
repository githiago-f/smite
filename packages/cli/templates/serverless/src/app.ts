import { http } from "@smitejs/http";
// biome-ignore lint/correctness/noUnusedImports: imported by the tested @snippet below
import { json, status } from "@smitejs/http";
// biome-ignore lint/correctness/noUnusedImports: imported by the tested @snippet below
import { z } from "zod";

export const app = http.app("{{name}}");
// @snippet Compose a deployable HTTP app
