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
import type * as anomalyDetection from "../anomalyDetection.js";
import type * as businesses from "../businesses.js";
import type * as calendarEvents from "../calendarEvents.js";
import type * as cron from "../cron.js";
import type * as debug from "../debug.js";
import type * as decisions from "../decisions.js";
import type * as documents from "../documents.js";
import type * as epics from "../epics.js";
import type * as examples_errorHandlingPattern from "../examples/errorHandlingPattern.js";
import type * as executionLog from "../executionLog.js";
import type * as github from "../github.js";
import type * as goals from "../goals.js";
import type * as memoryIndex from "../memoryIndex.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as opsMetrics from "../opsMetrics.js";
import type * as patternLearning from "../patternLearning.js";
import type * as presence from "../presence.js";
import type * as skillInference from "../skillInference.js";
import type * as strategicReports from "../strategicReports.js";
import type * as taskComments from "../taskComments.js";
import type * as tasks from "../tasks.js";
import type * as types from "../types.js";
import type * as utils_activityLogger from "../utils/activityLogger.js";
import type * as utils_batchDelete from "../utils/batchDelete.js";
import type * as utils_epicTaskSync from "../utils/epicTaskSync.js";
import type * as utils_graphValidation from "../utils/graphValidation.js";
import type * as utils_rateLimit from "../utils/rateLimit.js";
import type * as utils_roleKeywords from "../utils/roleKeywords.js";
import type * as utils_ticketId from "../utils/ticketId.js";
import type * as wake from "../wake.js";
import type * as wiki from "../wiki.js";

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
  anomalyDetection: typeof anomalyDetection;
  businesses: typeof businesses;
  calendarEvents: typeof calendarEvents;
  cron: typeof cron;
  debug: typeof debug;
  decisions: typeof decisions;
  documents: typeof documents;
  epics: typeof epics;
  "examples/errorHandlingPattern": typeof examples_errorHandlingPattern;
  executionLog: typeof executionLog;
  github: typeof github;
  goals: typeof goals;
  memoryIndex: typeof memoryIndex;
  messages: typeof messages;
  migrations: typeof migrations;
  notifications: typeof notifications;
  opsMetrics: typeof opsMetrics;
  patternLearning: typeof patternLearning;
  presence: typeof presence;
  skillInference: typeof skillInference;
  strategicReports: typeof strategicReports;
  taskComments: typeof taskComments;
  tasks: typeof tasks;
  types: typeof types;
  "utils/activityLogger": typeof utils_activityLogger;
  "utils/batchDelete": typeof utils_batchDelete;
  "utils/epicTaskSync": typeof utils_epicTaskSync;
  "utils/graphValidation": typeof utils_graphValidation;
  "utils/rateLimit": typeof utils_rateLimit;
  "utils/roleKeywords": typeof utils_roleKeywords;
  "utils/ticketId": typeof utils_ticketId;
  wake: typeof wake;
  wiki: typeof wiki;
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
