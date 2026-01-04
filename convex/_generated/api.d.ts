/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeys from "../apiKeys.js";
import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as chats from "../chats.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_batchFetch from "../lib/batchFetch.js";
import type * as lib_featureFlags from "../lib/featureFlags.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as maintenance from "../maintenance.js";
import type * as mcpConfigs from "../mcpConfigs.js";
import type * as messages from "../messages.js";
import type * as projects from "../projects.js";
import type * as streaming from "../streaming.js";
import type * as streaming_internal from "../streaming_internal.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeys: typeof apiKeys;
  attachments: typeof attachments;
  auth: typeof auth;
  chats: typeof chats;
  crons: typeof crons;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/batchFetch": typeof lib_batchFetch;
  "lib/featureFlags": typeof lib_featureFlags;
  "lib/permissions": typeof lib_permissions;
  maintenance: typeof maintenance;
  mcpConfigs: typeof mcpConfigs;
  messages: typeof messages;
  projects: typeof projects;
  streaming: typeof streaming;
  streaming_internal: typeof streaming_internal;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
