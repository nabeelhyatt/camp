# Claude's Onboarding Doc

## What is Camp?

Camp is a multiplayer AI workspace for group projects. It's a fork of [Chorus](https://github.com/meltylabs/chorus).

It's a native Mac AI chat app that lets you chat with all the AIs. Send one prompt and see responses from Claude, o3-pro, Gemini, etc. all at once.

It's built with Tauri, React, TypeScript, TanStack Query, and a local sqlite database.

Key features:

-   MCP support
-   Ambient chats (start a chat from anywhere)
-   Group Projects
-   Bring your own API keys

Most of the functionality lives in this repo. There's also a backend that handles accounts, billing, and proxying the models' requests; currently using the Chorus backend at app.chorus.sh (written in Elixir).

## Development Rules (CRITICAL)

-   **NEVER COMMIT** unless explicitly asked by the user
-   **Always work in feature branches**: `claude/feature-name` or `nabeelhyatt/feature-name`
-   **NEVER edit existing migration files** - Create new migrations to fix issues (see Data model changes section)
-   **TypeScript**: Avoid `any` types, use explicit typing
-   **Test early**: Ask the user to test your changes in the app frequently
-   **Upstream compatibility**: Before modifying any file, check `UPSTREAM-SYNC.md` to see if it's a Tier 1 (never modify) file

## Your role

Your role is to write code. You do NOT have access to the running app, so you cannot test the code. You MUST rely on me, the user, to test the code.

If I report a bug in your code, after you fix it, you should pause and ask me to verify that the bug is fixed.

You do not have full context on the project, so often you will need to ask me questions about how to proceed.

Don't be shy to ask questions -- I'm here to help you!

If I send you a URL, you MUST immediately fetch its contents and read it carefully, before you do anything else.

## Workflow

We use GitHub issues to track work we need to do, and PRs to review code. Whenever you create an issue or a PR, tag it with "by-claude". Use the `gh` bash command to interact with GitHub.

To start working on a feature, you should:

1. Setup

-   Identify the relevant GitHub issue (or create one if needed)
-   Checkout main and pull the latest changes
-   Create a new branch like `claude/feature-name`. NEVER commit to main. NEVER push to origin/main.

2. Development

-   Commit often as you write code, so that we can revert if needed.
-   When you have a draft of what you're working on, ask me to test it in the app to confirm that it works as you expect. Do this early and often.

3. Review

-   When the work is done, verify that the diff looks good with `git diff main`
-   While you should attempt to write code that adheres to our coding style, don't worry about manually linting or formatting your changes. There are Husky pre-commit Git hooks that will do this for you.
-   Push the branch to GitHub
-   Open a PR.
    -   The PR title should not include the issue number
    -   The PR description should start with the issue number and a brief description of the changes.
    -   Next, you should write a test plan. I (not you) will execute the test plan before merging the PR. If I can't check off any of the items, I will let you know. Make sure the test plan covers both new functionality and any EXISTING functionality that might be impacted by your changes

4. Fixing issues

-   To reconcile different branches, always rebase or cherry-pick. Do not merge.

Sometimes, after you've been working on one feature, I will ask you to start work on an unrelated feature. If I do, you should probably repeat this process from the beginning (checkout main, pull changes, create a new branch). When in doubt, just ask.

Don't combine git commands -- e.g., instead of `git add -A && git commit`, run `git add -A` and `git commit` separately. This will save me time because I won't have to grant you permission to run the combined command.

## Package Managers: pnpm

### For All Environments

-   **Use pnpm** for faster installs and better disk space usage
-   Commands: `pnpm install`, `pnpm run dev`, etc.
-   Why: pnpm is faster and handles the peer dependency issues with use-react-query-auto-sync

### For Conductor Workspaces

-   Conductor scripts use `npx --yes corepack pnpm` to ensure pnpm is available regardless of PATH
-   The setup script copies `.env` from the workspace parent directory (e.g., `/workspaces/camp-v1/.env`)
-   The setup script auto-creates `.env.local` with `CONVEX_DEPLOYMENT` extracted from `VITE_CONVEX_URL`
-   This allows sharing environment variables across multiple worktrees

### Environment Setup

-   Copy `.env` from the workspace parent directory or from `.env.example`
-   Required in `.env`: `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`
-   Required in `.env.local`: `CONVEX_DEPLOYMENT` (auto-created by setup script)
-   Optional: `VITE_DEFAULT_OPENROUTER_KEY` for default OpenRouter API key
-   Optional: `VITE_DEFAULT_FIRECRAWL_KEY` for default Firecrawl API key (URL scraping)

**Note:** The Convex CLI requires `CONVEX_DEPLOYMENT` in `.env.local` to run non-interactively. The setup script extracts this from `VITE_CONVEX_URL` (e.g., `https://dutiful-gecko-899.convex.cloud` → `CONVEX_DEPLOYMENT=dev:dutiful-gecko-899`).

## Key Commands

```bash
# Development
pnpm dev                      # Start Tauri dev server
pnpm build                    # Build for production
pnpm lint                     # Run ESLint

# Tauri
pnpm tauri dev                # Start Tauri in dev mode
pnpm tauri build              # Build distributable app

# Dependencies
pnpm install                  # Install dependencies
pnpm add <package>            # Add a package
```

## Project Structure

-   **UI:** React components in `src/ui/components/`
-   **Core:** Business logic in `src/core/chorus/`
-   **Tauri:** Rust backend in `src-tauri/src/`

Important files and directories to be aware of:

-   `src/core/chorus/db/` - Queries against the sqlite database, which are split up by entity type (e.g. message, chat, project)
-   `src/core/chorus/api/` - TanStack Query queries and mutations, which are also split up by entity type
-   `src/ui/components/MultiChat.tsx` - Main interface
-   `src/ui/components/ChatInput.tsx` - The input box where the user types chat messages
-   `src/ui/components/AppSidebar.tsx` - The sidebar on the left
-   `src/ui/App.tsx` - The root component

You can see an up-to-date schema of all database tables in SQL_SCHEMA.md. Use this file as a reference to understand the current
database schema.

Other features:

-   Model picker, which lets the user select which models are available in the chat -- implemented in`ManageModelsBox.tsx`
-   Quick chats (aka Ambient Chats), a lightweight chat window -- implemented, alongside regular chats, in `MultiChat.tsx`
-   Projects, which are folders of related chats -- start with `AppSidebar.tsx`
-   Tools and "connections" (aka toolsets) -- start with `Toolsets.ts`
-   react-router-dom for navigation -- see `App.tsx`

## Screenshots

I've put some screenshots of the app in the `screenshots` directory. If you're working on the UI at all, take a look at them. Keep in mind, though, that they may not be up to date with the latest code changes.

## Data model changes

Changes to the data model will typically require most of the following steps:

-   Making a new migration in `src-tauri/src/migrations.rs` (if changes to the sqlite database scheme are needed)
-   Modifying fetch and read functions in `src/core/chorus/DB.ts`
-   Modifying data types (stored in a variety of places)
-   Adding or modifying TanStack Query queries in `src/core/chorus/API.ts`

### Migration File Rules (CRITICAL)

-   **Migration order is IMMUTABLE**: Once a migration is added to `migrations.rs` and deployed, its position can NEVER change
-   **NEVER delete and recreate migrations**: If you need to modify a migration that's been deployed, create a NEW migration to fix or modify it
-   **NEVER reorder migration files**: The app tracks which migrations have run by their order
-   **If you make a mistake**: Create a new migration to rollback or fix the issue - do not modify the original migration

## Coding style

-   **TypeScript:** Strict typing enabled, ES2020 target. Use `as` only in exceptional
    circumstances, and then only with an explanatory comment. Prefer type hints.
-   **Paths:** `@ui/*`, `@core/*`, `@/*` aliases. Use these instead of relative imports.
-   **Components:** PascalCase for React components
-   **Interfaces:** Prefixed with "I" (e.g., `IProvider`)
-   **Hooks:** camelCase with "use" prefix
-   **Formatting:** 4-space indentation, Prettier formatting
-   **Promise handling:** All promises must be handled (ESLint enforced)
-   **Nulls:** Prefer undefined to null. Convert `null` values from the database into undefined, e.g. `parentChatId: row.parent_chat_id ?? undefined`
-   **Dates:** If you ever need to render a date, format it using `displayDate` in `src/ui/lib/utils.ts`. If the date was read
    from our SQLite DB, you will need to convert it to a fully qualified UTC date using `convertDate` first.
-   Do not use foreign keys or other constraints, they're too hard to remove and tend to put us in tricky situations down the line

IMPORTANT: If you want to use any of these features, you must alert me and explicitly ask for my permission first: `setTimeout`, `useImperativeHandle`, `useRef`, or type assertions with `as`.

## Troubleshooting

Whenever I report that code you wrote doesn't work, or report a bug, you should:

1. Read any relevant code or documentation, looking for hypotheses about the root cause
2. For each hypothesis, check whether it's consistent with the observations I've already reported
3. For any remaining hypotheses, think about a test I could run that would tell me if that hypothesis is incorrect
4. Propose a troubleshooting plan. The plan could involve: me running a test, you writing code, you adding logging statements, me reporting the output of the log statements back to you, or any other steps you think would be helpful.

Then we'll go through the plan together. At each step, keep in mind your list of hypotheses, and remember to re-evaluate each hypothesis against the evidence we've collected.

When we run into issues with the requests we're sending to model providers (e.g., the way we format system prompts, attachments, tool calls, or other parts of the conversation history) one helpful troubleshooting step is to add the line `console.log(`createParams: ${JSON.stringify(createParams, null, 2)}`);` to ProviderAnthropic.ts.

## Security Best Practices

**CRITICAL: Never commit secrets to the repository.**

### API Keys and Secrets

-   **NEVER hardcode API keys, tokens, or secrets in source code**
-   Use environment variables for all sensitive configuration
-   Environment variables are set in `.env` files (not committed) or CI/CD secrets
-   Vite env vars must be prefixed with `VITE_` to be exposed to the frontend

### Environment Variables

Camp uses these environment variables:

| Variable                      | Description                          | Required |
| ----------------------------- | ------------------------------------ | -------- |
| `VITE_DEFAULT_OPENROUTER_KEY` | Default OpenRouter API key for users | No       |
| `VITE_CAMP_BACKEND`           | Backend to use: "chorus" or "camp"   | No       |

To set up:

1. Copy `.env.example` to `.env`
2. Fill in your values
3. Never commit `.env` to git

### If You Accidentally Commit a Secret

1. **Immediately rotate the key** on the provider's dashboard
2. Remove from code and commit the fix
3. Use `git filter-repo` to remove from history:
    ```bash
    echo 'SECRET_VALUE==>REDACTED' > /tmp/replacements.txt
    git filter-repo --replace-text /tmp/replacements.txt --force
    ```
4. Force push the cleaned history
5. Notify the team

### Code Review Checklist

Before committing, verify:

-   [ ] No API keys, tokens, or passwords in the diff
-   [ ] No `.env` files being committed
-   [ ] Secrets are read from environment variables
-   [ ] New env vars are documented in `.env.example`

## Configuration

### Backend Configuration

Camp uses `src/core/campConfig.ts` for centralized backend and service configuration:

```typescript
import { campConfig } from "@core/campConfig";

campConfig.proxyUrl; // Backend URL (app.chorus.sh or app.getcamp.ai)
campConfig.backend; // "chorus" or "camp"
campConfig.isDev; // Development mode flag
```

### Icon Directories

Tauri uses different icon sets for different build configurations:

-   `src-tauri/icons/` - Production icons
-   `src-tauri/icons-dev/` - Development build icons
-   `src-tauri/icons-qa/` - QA build icons

When updating app icons, update all three directories.

## Upstream Sync Strategy

Camp is a fork of Chorus. To enable easy cherry-picking of upstream bug fixes and features, we classify files into tiers. **See `UPSTREAM-SYNC.md` for the complete policy.**

### Quick Reference

| Tier       | Policy                | Examples                                       |
| ---------- | --------------------- | ---------------------------------------------- |
| **Tier 1** | NEVER modify          | Model providers, MCP, ChatState, UI primitives |
| **Tier 2** | Cherry-pick carefully | API layer, MultiChat, ManageModelsBox          |
| **Tier 3** | Safe to customize     | campConfig.ts, Onboarding, Settings, branding  |

### Key Principle

All Camp customizations should flow through `campConfig.ts` or live in Tier 3 files. This keeps Tier 1 files pristine for upstream updates.

**Before modifying any file in `src/core/chorus/`:**

1. Check `UPSTREAM-SYNC.md` for its tier classification
2. If Tier 1: Find an alternative approach (wrapper, config, new file)
3. If Tier 2: Document the change and be prepared for merge conflicts

## Updating this onboarding doc

Whenever you discover something that you wish you'd known earlier -- and seems likely to be helpful to future developers as well -- you can add it to the scratchpad section below. Feel free to edit the scratchpad section, but don't change the rest of this doc.

## Convex Guidelines

### Function Guidelines

#### New Function Syntax

-   ALWAYS use the new function syntax for Convex functions. For example:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";
export const f = query({
    args: {},
    returns: v.null(),
    handler: async (ctx, args) => {
        // Function body
    },
});
```

#### HTTP Endpoint Syntax

-   HTTP endpoints are defined in `convex/http.ts` and require an `httpAction` decorator. For example:

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
const http = httpRouter();
http.route({
    path: "/echo",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        const body = await req.bytes();
        return new Response(body, { status: 200 });
    }),
});
```

-   HTTP endpoints are always registered at the exact path you specify in the `path` field. For example, if you specify `/api/someRoute`, the endpoint will be registered at `/api/someRoute`.

#### Validators

-   Below is an example of an array validator:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
    args: {
        simpleArray: v.array(v.union(v.string(), v.number())),
    },
    handler: async (ctx, args) => {
        //...
    },
});
```

-   Below is an example of a schema with validators that codify a discriminated union type:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    results: defineTable(
        v.union(
            v.object({
                kind: v.literal("error"),
                errorMessage: v.string(),
            }),
            v.object({
                kind: v.literal("success"),
                value: v.number(),
            }),
        ),
    ),
});
```

-   Always use the `v.null()` validator when returning a null value. Below is an example query that returns a null value:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const exampleQuery = query({
    args: {},
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log("This query returns a null value");
        return null;
    },
});
```

-   Here are the valid Convex types along with their respective validators:

| Convex Type | TS/JS type  | Example Usage          | Validator                     | Notes                                                      |
| ----------- | ----------- | ---------------------- | ----------------------------- | ---------------------------------------------------------- |
| Id          | string      | `doc._id`              | `v.id(tableName)`             |                                                            |
| Null        | null        | `null`                 | `v.null()`                    | JavaScript's `undefined` is not valid. Use `null` instead. |
| Int64       | bigint      | `3n`                   | `v.int64()`                   | Only BigInts between -2^63 and 2^63-1                      |
| Float64     | number      | `3.1`                  | `v.number()`                  | Supports all IEEE-754 doubles                              |
| Boolean     | boolean     | `true`                 | `v.boolean()`                 |                                                            |
| String      | string      | `"abc"`                | `v.string()`                  | UTF-8, max 1MB                                             |
| Bytes       | ArrayBuffer | `new ArrayBuffer(8)`   | `v.bytes()`                   | Max 1MB                                                    |
| Array       | Array       | `[1, 3.2, "abc"]`      | `v.array(values)`             | Max 8192 values                                            |
| Object      | Object      | `{a: "abc"}`           | `v.object({property: value})` | Max 1024 entries                                           |
| Record      | Record      | `{"a": "1", "b": "2"}` | `v.record(keys, values)`      | Dynamic keys, ASCII only                                   |

#### Function Registration

-   Use `internalQuery`, `internalMutation`, and `internalAction` to register internal functions. These functions are private and aren't part of an app's API. They can only be called by other Convex functions. These functions are always imported from `./_generated/server`.
-   Use `query`, `mutation`, and `action` to register public functions. These functions are part of the public API and are exposed to the public Internet. Do NOT use `query`, `mutation`, or `action` to register sensitive internal functions that should be kept private.
-   You CANNOT register a function through the `api` or `internal` objects.
-   ALWAYS include argument and return validators for all Convex functions. This includes all of `query`, `internalQuery`, `mutation`, `internalMutation`, `action`, and `internalAction`. If a function doesn't return anything, include `returns: v.null()` as its output validator.
-   If the JavaScript implementation of a Convex function doesn't have a return value, it implicitly returns `null`.

#### Function Calling

-   Use `ctx.runQuery` to call a query from a query, mutation, or action.
-   Use `ctx.runMutation` to call a mutation from a mutation or action.
-   Use `ctx.runAction` to call an action from an action.
-   ONLY call an action from another action if you need to cross runtimes (e.g. from V8 to Node). Otherwise, pull out the shared code into a helper async function and call that directly instead.
-   Try to use as few calls from actions to queries and mutations as possible. Queries and mutations are transactions, so splitting logic up into multiple calls introduces the risk of race conditions.
-   All of these calls take in a `FunctionReference`. Do NOT try to pass the callee function directly into one of these calls.
-   When using `ctx.runQuery`, `ctx.runMutation`, or `ctx.runAction` to call a function in the same file, specify a type annotation on the return value to work around TypeScript circularity limitations. For example:

```typescript
export const f = query({
    args: { name: v.string() },
    returns: v.string(),
    handler: async (ctx, args) => {
        return "Hello " + args.name;
    },
});

export const g = query({
    args: {},
    returns: v.null(),
    handler: async (ctx, args) => {
        const result: string = await ctx.runQuery(api.example.f, {
            name: "Bob",
        });
        return null;
    },
});
```

#### Function References

-   Function references are pointers to registered Convex functions.
-   Use the `api` object defined by the framework in `convex/_generated/api.ts` to call public functions registered with `query`, `mutation`, or `action`.
-   Use the `internal` object defined by the framework in `convex/_generated/api.ts` to call internal (or private) functions registered with `internalQuery`, `internalMutation`, or `internalAction`.
-   Convex uses file-based routing, so a public function defined in `convex/example.ts` named `f` has a function reference of `api.example.f`.
-   A private function defined in `convex/example.ts` named `g` has a function reference of `internal.example.g`.
-   Functions can also registered within directories nested within the `convex/` folder. For example, a public function `h` defined in `convex/messages/access.ts` has a function reference of `api.messages.access.h`.

#### API Design

-   Convex uses file-based routing, so thoughtfully organize files with public query, mutation, or action functions within the `convex/` directory.
-   Use `query`, `mutation`, and `action` to define public functions.
-   Use `internalQuery`, `internalMutation`, and `internalAction` to define private, internal functions.

#### Pagination

-   Paginated queries are queries that return a list of results in incremental pages.
-   You can define pagination using the following syntax:

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
export const listWithExtraArg = query({
    args: { paginationOpts: paginationOptsValidator, author: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("messages")
            .filter((q) => q.eq(q.field("author"), args.author))
            .order("desc")
            .paginate(args.paginationOpts);
    },
});
```

Note: `paginationOpts` is an object with the following properties:

-   `numItems`: the maximum number of documents to return (the validator is `v.number()`)
-   `cursor`: the cursor to use to fetch the next page of documents (the validator is `v.union(v.string(), v.null())`)
-   A query that ends in `.paginate()` returns an object that has the following properties:
    -   page (contains an array of documents that you fetches)
    -   isDone (a boolean that represents whether or not this is the last page of documents)
    -   continueCursor (a string that represents the cursor to use to fetch the next page of documents)

### Validator Guidelines

-   `v.bigint()` is deprecated for representing signed 64-bit integers. Use `v.int64()` instead.
-   Use `v.record()` for defining a record type. `v.map()` and `v.set()` are not supported.

### Schema Guidelines

-   Always define your schema in `convex/schema.ts`.
-   Always import the schema definition functions from `convex/server`.
-   System fields are automatically added to all documents and are prefixed with an underscore. The two system fields that are automatically added to all documents are `_creationTime` which has the validator `v.number()` and `_id` which has the validator `v.id(tableName)`.
-   Always include all index fields in the index name. For example, if an index is defined as `["field1", "field2"]`, the index name should be "by_field1_and_field2".
-   Index fields must be queried in the same order they are defined. If you want to be able to query by "field1" then "field2" and by "field2" then "field1", you must create separate indexes.

### TypeScript Guidelines

-   You can use the helper typescript type `Id` imported from './\_generated/dataModel' to get the type of the id for a given table. For example if there is a table called 'users' you can use `Id<'users'>` to get the type of the id for that table.
-   If you need to define a `Record` make sure that you correctly provide the type of the key and value in the type. For example a validator `v.record(v.id('users'), v.string())` would have the type `Record<Id<'users'>, string>`. Below is an example of using `Record` with an `Id` type in a query:

```typescript
import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const exampleQuery = query({
    args: { userIds: v.array(v.id("users")) },
    returns: v.record(v.id("users"), v.string()),
    handler: async (ctx, args) => {
        const idToUsername: Record<Id<"users">, string> = {};
        for (const userId of args.userIds) {
            const user = await ctx.db.get("users", userId);
            if (user) {
                idToUsername[user._id] = user.username;
            }
        }

        return idToUsername;
    },
});
```

-   Be strict with types, particularly around id's of documents. For example, if a function takes in an id for a document in the 'users' table, take in `Id<'users'>` rather than `string`.
-   Always use `as const` for string literals in discriminated union types.
-   When using the `Array` type, make sure to always define your arrays as `const array: Array<T> = [...];`
-   When using the `Record` type, make sure to always define your records as `const record: Record<KeyType, ValueType> = {...};`
-   Always add `@types/node` to your `package.json` when using any Node.js built-in modules.

### Full Text Search Guidelines

-   A query for "10 messages in channel '#general' that best match the query 'hello hi' in their body" would look like:

```typescript
const messages = await ctx.db
    .query("messages")
    .withSearchIndex("search_body", (q) =>
        q.search("body", "hello hi").eq("channel", "#general"),
    )
    .take(10);
```

### Query Guidelines

-   Do NOT use `filter` in queries. Instead, define an index in the schema and use `withIndex` instead.
-   Convex queries do NOT support `.delete()`. Instead, `.collect()` the results, iterate over them, and call `ctx.db.delete(row._id)` on each result.
-   Use `.unique()` to get a single document from a query. This method will throw an error if there are multiple documents that match the query.
-   When using async iteration, don't use `.collect()` or `.take(n)` on the result of a query. Instead, use the `for await (const row of query)` syntax.

#### Ordering

-   By default Convex always returns documents in ascending `_creationTime` order.
-   You can use `.order('asc')` or `.order('desc')` to pick whether a query is in ascending or descending order. If the order isn't specified, it defaults to ascending.
-   Document queries that use indexes will be ordered based on the columns in the index and can avoid slow table scans.

### Mutation Guidelines

-   Use `ctx.db.replace` to fully replace an existing document. This method will throw an error if the document does not exist. Syntax: `await ctx.db.replace('tasks', taskId, { name: 'Buy milk', completed: false })`
-   Use `ctx.db.patch` to shallow merge updates into an existing document. This method will throw an error if the document does not exist. Syntax: `await ctx.db.patch('tasks', taskId, { completed: true })`

### Action Guidelines

-   Always add `"use node";` to the top of files containing actions that use Node.js built-in modules.
-   Never use `ctx.db` inside of an action. Actions don't have access to the database.
-   Below is an example of the syntax for an action:

```typescript
import { action } from "./_generated/server";

export const exampleAction = action({
    args: {},
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log("This action does not return anything");
        return null;
    },
});
```

### Scheduling Guidelines

#### Cron Guidelines

-   Only use the `crons.interval` or `crons.cron` methods to schedule cron jobs. Do NOT use the `crons.hourly`, `crons.daily`, or `crons.weekly` helpers.
-   Both cron methods take in a FunctionReference. Do NOT try to pass the function directly into one of these methods.
-   Define crons by declaring the top-level `crons` object, calling some methods on it, and then exporting it as default. For example:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const empty = internalAction({
    args: {},
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log("empty");
    },
});

const crons = cronJobs();

// Run `internal.crons.empty` every two hours.
crons.interval("delete inactive users", { hours: 2 }, internal.crons.empty, {});

export default crons;
```

-   You can register Convex functions within `crons.ts` just like any other file.
-   If a cron calls an internal function, always import the `internal` object from '\_generated/api', even if the internal function is registered in the same file.

### File Storage Guidelines

-   Convex includes file storage for large files like images, videos, and PDFs.
-   The `ctx.storage.getUrl()` method returns a signed URL for a given file. It returns `null` if the file doesn't exist.
-   Do NOT use the deprecated `ctx.storage.getMetadata` call for loading a file's metadata.
    Instead, query the `_storage` system table. For example, you can use `ctx.db.system.get` to get an `Id<"_storage">`.

```typescript
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

type FileMetadata = {
    _id: Id<"_storage">;
    _creationTime: number;
    contentType?: string;
    sha256: string;
    size: number;
};

export const exampleQuery = query({
    args: { fileId: v.id("_storage") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const metadata: FileMetadata | null = await ctx.db.system.get(
            "_storage",
            args.fileId,
        );
        console.log(metadata);
        return null;
    },
});
```

-   Convex storage stores items as `Blob` objects. You must convert all items to/from a `Blob` when using Convex storage.

### Scratchpad
