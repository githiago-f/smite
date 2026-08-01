import { freeze } from "../internal/freeze.js";
import type { HttpExecutionRequest } from "../types.js";

/**
 * Immutable message data produced by `event.message`.
 *
 * @group Events
 * @intent Carries a message identifier, routing attributes and payload.
 * @example Build a message
 */
export type MessageEvent = Readonly<{
  readonly id?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly body?: unknown;
}>;

/**
 * Immutable cron event produced by `event.cron`.
 *
 * @group Events
 * @intent Carries when a scheduled job was fired.
 * @example Build a cron event
 */
export type CronEvent = Readonly<{
  readonly scheduledAt: Date;
}>;

/**
 * Immutable builder for an HTTP request passed to a handleified controller.
 *
 * Defaults to a `GET` request on `/` with no headers, cookies, query or body.
 *
 * @group Events
 * @intent Builds the normalized request data consumed by core execution.
 * @example Build a request
 */
export interface RequestEventBuilder {
  readonly method: (method: string) => RequestEventBuilder;
  readonly path: (path: string) => RequestEventBuilder;
  readonly headers: (
    headers: Readonly<Record<string, string | readonly string[] | undefined>>,
  ) => RequestEventBuilder;
  readonly cookies: (
    cookies: Readonly<Record<string, string>>,
  ) => RequestEventBuilder;
  readonly query: (
    query: Readonly<Record<string, unknown>>,
  ) => RequestEventBuilder;
  readonly params: (
    params: Readonly<Record<string, string>>,
  ) => RequestEventBuilder;
  readonly body: (body: unknown) => RequestEventBuilder;
  readonly raw: (raw: unknown) => RequestEventBuilder;
  readonly build: () => HttpExecutionRequest;
}

/**
 * Immutable builder for a message passed to a handleified consumer.
 *
 * All fields are optional.
 *
 * @group Events
 * @intent Builds message data with an identifier, routing attributes and payload.
 * @example Build a message
 */
export interface MessageEventBuilder {
  readonly id: (id: string) => MessageEventBuilder;
  readonly attributes: (
    attributes: Readonly<Record<string, unknown>>,
  ) => MessageEventBuilder;
  readonly body: (body: unknown) => MessageEventBuilder;
  readonly build: () => MessageEvent;
}

/**
 * Immutable builder for a cron event passed to a handleified job.
 *
 * Defaults to the current time when no scheduled time is set.
 *
 * @group Events
 * @intent Builds the firing context of a scheduled job.
 * @example Build a cron event
 */
export interface CronEventBuilder {
  readonly at: (at: Date) => CronEventBuilder;
  readonly build: () => CronEvent;
}

interface RequestEventState {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
  readonly cookies: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, unknown>>;
  readonly params: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly raw: unknown;
}

const createRequestEventBuilder = (
  state: RequestEventState,
): RequestEventBuilder =>
  freeze({
    method: (method) => createRequestEventBuilder({ ...state, method }),
    path: (path) => createRequestEventBuilder({ ...state, path }),
    headers: (headers) => createRequestEventBuilder({ ...state, headers }),
    cookies: (cookies) => createRequestEventBuilder({ ...state, cookies }),
    query: (query) => createRequestEventBuilder({ ...state, query }),
    params: (params) => createRequestEventBuilder({ ...state, params }),
    body: (body) => createRequestEventBuilder({ ...state, body }),
    raw: (raw) => createRequestEventBuilder({ ...state, raw }),
    build: () =>
      freeze({
        method: state.method,
        path: state.path,
        headers: state.headers,
        cookies: state.cookies,
        query: state.query,
        params: state.params,
        body: state.body,
        raw: state.raw,
      }),
  });

interface MessageEventState {
  readonly id?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly body?: unknown;
}

const createMessageEventBuilder = (
  state: MessageEventState,
): MessageEventBuilder =>
  freeze({
    id: (id) => createMessageEventBuilder({ ...state, id }),
    attributes: (attributes) =>
      createMessageEventBuilder({ ...state, attributes }),
    body: (body) => createMessageEventBuilder({ ...state, body }),
    build: () => freeze(state),
  });

const createCronEventBuilder = (at?: Date): CronEventBuilder =>
  freeze({
    at: (next) => createCronEventBuilder(next),
    build: () => freeze({ scheduledAt: at ?? new Date() }),
  });

/**
 * Namespace for event data builders.
 *
 * Event data builders construct the invocation inputs consumed by handleified
 * functions: an HTTP request, a message or a cron event. Transport fields are
 * optional and every builder ends with `build`.
 *
 * @group Events
 * @intent Public namespace for constructing runtime event data.
 * @example Build a request
 * @example Build a message
 * @example Build a cron event
 */
export const event = freeze({
  request: (): RequestEventBuilder =>
    createRequestEventBuilder({
      method: "GET",
      path: "/",
      headers: {},
      cookies: {},
      query: {},
      params: {},
      body: undefined,
      raw: undefined,
    }),
  message: (): MessageEventBuilder => createMessageEventBuilder({}),
  cron: (): CronEventBuilder => createCronEventBuilder(),
});
