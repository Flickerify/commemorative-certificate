/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as controllers_workosWebhooksController from "../controllers/workosWebhooksController.js";
import type * as env from "../env.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as locations_action from "../locations/action.js";
import type * as locations_configs from "../locations/configs.js";
import type * as locations_internal_action from "../locations/internal/action.js";
import type * as locations_internal_mutation from "../locations/internal/mutation.js";
import type * as locations_query from "../locations/query.js";
import type * as locations_types from "../locations/types.js";
import type * as locations_utils from "../locations/utils.js";
import type * as profiles_mutation from "../profiles/mutation.js";
import type * as profiles_query from "../profiles/query.js";
import type * as sources_action from "../sources/action.js";
import type * as sources_internal_mutation from "../sources/internal/mutation.js";
import type * as sources_internal_query from "../sources/internal/query.js";
import type * as sources_mutation from "../sources/mutation.js";
import type * as sources_query from "../sources/query.js";
import type * as types_index from "../types/index.js";
import type * as users_admin_mutation from "../users/admin/mutation.js";
import type * as users_admin from "../users/admin.js";
import type * as users_internal_action from "../users/internal/action.js";
import type * as users_internal_mutation from "../users/internal/mutation.js";
import type * as users_internal_query from "../users/internal/query.js";
import type * as users_query from "../users/query.js";
import type * as users_utils from "../users/utils.js";
import type * as workos_internal_action from "../workos/internal/action.js";
import type * as workos_webhooks_middleware from "../workos/webhooks/middleware.js";
import type * as workos_webhooks_users from "../workos/webhooks/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "controllers/workosWebhooksController": typeof controllers_workosWebhooksController;
  env: typeof env;
  functions: typeof functions;
  http: typeof http;
  "locations/action": typeof locations_action;
  "locations/configs": typeof locations_configs;
  "locations/internal/action": typeof locations_internal_action;
  "locations/internal/mutation": typeof locations_internal_mutation;
  "locations/query": typeof locations_query;
  "locations/types": typeof locations_types;
  "locations/utils": typeof locations_utils;
  "profiles/mutation": typeof profiles_mutation;
  "profiles/query": typeof profiles_query;
  "sources/action": typeof sources_action;
  "sources/internal/mutation": typeof sources_internal_mutation;
  "sources/internal/query": typeof sources_internal_query;
  "sources/mutation": typeof sources_mutation;
  "sources/query": typeof sources_query;
  "types/index": typeof types_index;
  "users/admin/mutation": typeof users_admin_mutation;
  "users/admin": typeof users_admin;
  "users/internal/action": typeof users_internal_action;
  "users/internal/mutation": typeof users_internal_mutation;
  "users/internal/query": typeof users_internal_query;
  "users/query": typeof users_query;
  "users/utils": typeof users_utils;
  "workos/internal/action": typeof workos_internal_action;
  "workos/webhooks/middleware": typeof workos_webhooks_middleware;
  "workos/webhooks/users": typeof workos_webhooks_users;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: {
    lib: {
      checkRateLimit: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
      getValue: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          key?: string;
          name: string;
          sampleShards?: number;
        },
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          shard: number;
          ts: number;
          value: number;
        }
      >;
      rateLimit: FunctionReference<
        "mutation",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      resetRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        null
      >;
    };
    time: {
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
    };
  };
  workflow: {
    journal: {
      load: FunctionReference<
        "query",
        "internal",
        { workflowId: string },
        {
          journalEntries: Array<{
            _creationTime: number;
            _id: string;
            step: {
              args: any;
              argsSize: number;
              completedAt?: number;
              functionType: "query" | "mutation" | "action";
              handle: string;
              inProgress: boolean;
              name: string;
              runResult?:
                | { kind: "success"; returnValue: any }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
              startedAt: number;
              workId?: string;
            };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          ok: boolean;
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      startSteps: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          steps: Array<{
            retry?:
              | boolean
              | { base: number; initialBackoffMs: number; maxAttempts: number };
            schedulerOptions?: { runAt?: number } | { runAfter?: number };
            step: {
              args: any;
              argsSize: number;
              completedAt?: number;
              functionType: "query" | "mutation" | "action";
              handle: string;
              inProgress: boolean;
              name: string;
              runResult?:
                | { kind: "success"; returnValue: any }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
              startedAt: number;
              workId?: string;
            };
          }>;
          workflowId: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        Array<{
          _creationTime: number;
          _id: string;
          step: {
            args: any;
            argsSize: number;
            completedAt?: number;
            functionType: "query" | "mutation" | "action";
            handle: string;
            inProgress: boolean;
            name: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt: number;
            workId?: string;
          };
          stepNumber: number;
          workflowId: string;
        }>
      >;
    };
    workflow: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        null
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        boolean
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          runResult:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId: string;
        },
        null
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          maxParallelism?: number;
          onComplete?: { context?: any; fnHandle: string };
          startAsync?: boolean;
          workflowArgs: any;
          workflowHandle: string;
          workflowName: string;
        },
        string
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { workflowId: string },
        {
          inProgress: Array<{
            _creationTime: number;
            _id: string;
            step: {
              args: any;
              argsSize: number;
              completedAt?: number;
              functionType: "query" | "mutation" | "action";
              handle: string;
              inProgress: boolean;
              name: string;
              runResult?:
                | { kind: "success"; returnValue: any }
                | { error: string; kind: "failed" }
                | { kind: "canceled" };
              startedAt: number;
              workId?: string;
            };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
    };
  };
  r2: {
    lib: {
      deleteMetadata: FunctionReference<
        "mutation",
        "internal",
        { bucket: string; key: string },
        null
      >;
      deleteObject: FunctionReference<
        "mutation",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          key: string;
          secretAccessKey: string;
        },
        null
      >;
      deleteR2Object: FunctionReference<
        "action",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          key: string;
          secretAccessKey: string;
        },
        null
      >;
      getMetadata: FunctionReference<
        "query",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          key: string;
          secretAccessKey: string;
        },
        {
          bucket: string;
          bucketLink: string;
          contentType?: string;
          key: string;
          lastModified: string;
          link: string;
          sha256?: string;
          size?: number;
          url: string;
        } | null
      >;
      listMetadata: FunctionReference<
        "query",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          cursor?: string;
          endpoint: string;
          limit?: number;
          secretAccessKey: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            bucket: string;
            bucketLink: string;
            contentType?: string;
            key: string;
            lastModified: string;
            link: string;
            sha256?: string;
            size?: number;
            url: string;
          }>;
          pageStatus?: null | "SplitRecommended" | "SplitRequired";
          splitCursor?: null | string;
        }
      >;
      store: FunctionReference<
        "action",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          secretAccessKey: string;
          url: string;
        },
        any
      >;
      syncMetadata: FunctionReference<
        "action",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          key: string;
          onComplete?: string;
          secretAccessKey: string;
        },
        null
      >;
      upsertMetadata: FunctionReference<
        "mutation",
        "internal",
        {
          bucket: string;
          contentType?: string;
          key: string;
          lastModified: string;
          link: string;
          sha256?: string;
          size?: number;
        },
        { isNew: boolean }
      >;
    };
  };
};
