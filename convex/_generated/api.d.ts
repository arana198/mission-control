/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as activities from "../activities.js";
import type * as agentMetrics from "../agentMetrics.js";
import type * as agentSelfCheck from "../agentSelfCheck.js";
import type * as agents from "../agents.js";
import type * as alertRules from "../alertRules.js";
import type * as businesses from "../businesses.js";
import type * as calendarEvents from "../calendarEvents.js";
import type * as debug from "../debug.js";
import type * as decisions from "../decisions.js";
import type * as documents from "../documents.js";
import type * as epics from "../epics.js";
import type * as executionLog from "../executionLog.js";
import type * as github from "../github.js";
import type * as goals from "../goals.js";
import type * as memoryIndex from "../memoryIndex.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as opsMetrics from "../opsMetrics.js";
import type * as strategicReports from "../strategicReports.js";
import type * as tasks from "../tasks.js";
import type * as utils_activityLogger from "../utils/activityLogger.js";
import type * as utils_epicTaskSync from "../utils/epicTaskSync.js";
import type * as utils_graphValidation from "../utils/graphValidation.js";
import type * as utils_roleKeywords from "../utils/roleKeywords.js";
import type * as wake from "../wake.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  activities: typeof activities;
  agentMetrics: typeof agentMetrics;
  agentSelfCheck: typeof agentSelfCheck;
  agents: typeof agents;
  alertRules: typeof alertRules;
  businesses: typeof businesses;
  calendarEvents: typeof calendarEvents;
  debug: typeof debug;
  decisions: typeof decisions;
  documents: typeof documents;
  epics: typeof epics;
  executionLog: typeof executionLog;
  github: typeof github;
  goals: typeof goals;
  memoryIndex: typeof memoryIndex;
  messages: typeof messages;
  migrations: typeof migrations;
  notifications: typeof notifications;
  opsMetrics: typeof opsMetrics;
  strategicReports: typeof strategicReports;
  tasks: typeof tasks;
  "utils/activityLogger": typeof utils_activityLogger;
  "utils/epicTaskSync": typeof utils_epicTaskSync;
  "utils/graphValidation": typeof utils_graphValidation;
  "utils/roleKeywords": typeof utils_roleKeywords;
  wake: typeof wake;
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
