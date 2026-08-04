import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";

export const FLOCI_IMAGE = "floci/floci:latest";
export const FLOCI_PORT = 4566;

export function startFloci(): Promise<StartedTestContainer> {
  return new GenericContainer(FLOCI_IMAGE)
    .withExposedPorts(FLOCI_PORT)
    .withWaitStrategy(Wait.forLogMessage("Ready"))
    .withStartupTimeout(120_000)
    .start();
}

export function flociEndpoint(container: StartedTestContainer): string {
  return `http://${container.getHost()}:${container.getMappedPort(FLOCI_PORT)}`;
}
