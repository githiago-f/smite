import { AsyncLocalStorage } from "node:async_hooks";

/** Deployment-wide configuration shared with AWS client factories. */
export interface ProviderConfig {
  readonly region: string;
  readonly service?: string;
}

const providerStore = new AsyncLocalStorage<ProviderConfig>();

/**
 * Runs `task` with a provider config visible to {@link getProviderConfig}.
 * Configuration managers such as the serverless plugin write region and
 * service name here so client factories can read them without imports.
 *
 * @group Context
 */
export function runWithProviderConfig<T>(
  config: ProviderConfig,
  task: () => T,
): T {
  return providerStore.run(config, task);
}

/**
 * Returns the active provider config. Values registered by a configuration
 * manager take precedence; otherwise the region falls back to the standard
 * AWS environment variables and finally `us-east-1`.
 *
 * @group Context
 */
export function getProviderConfig(): ProviderConfig {
  const stored = providerStore.getStore();
  const envService = process.env.SMITE_SERVICE;
  const service = stored?.service ?? envService;
  return {
    region:
      stored?.region ??
      process.env.AWS_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      "us-east-1",
    ...(service === undefined ? {} : { service }),
  };
}
