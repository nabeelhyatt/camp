We are building a new feature called group chats. This will be a fundamentally different experience for chatting in Chorus. It will replace our current chat experience. We have attached a series of Figma screenshots of the proposed group chats UI.

## Basic idea

A group chat is a list of messages.

When the user sends a message, the default AI (default model) sends a message back

The user can also:

-   Call on a particular AI by @-mentioning it
-   Delete a message to remove it from the context

## v1 Spec

Below is a rough spec of everything that we want to support:

v1:

-   Support tools (the same as we do today)
    -   1 global toolset config for all models configs (no per model toolset config yet)
    -   Every model can use any selected tool at any time
    -   Tool calls and results are encoded as XML tags when encoded as user messages
        -   Otherwise, they are encoded normally in AI messages (as part of the provider API)
-   Rendering markdown (same as old)
-   Re-use top bar design
    -   Get rid of summarize button
-   Threads
    -   All messages before the threaded message are visible in thread context
    -   Not supporting promote to channel in v1
-   Models
-   Models will behave as follows:
    -   Each model has an “alias” which is just its display name for now
    -   Each model has a "perspective" - every other message is a "user" that is labeled as being sent from that model's display name
    -   Each model has its own perspective
        -   The AI will know its own name
        -   Messages from the same name will be encoded as assistant messages
        -   Messages from a different alias will be encoded as human messages with `<CHORUS_MESSAGE>` XML tags that set the sender attribute to the sender’s alias
-   Who is the default responder?
    -   Claude Sonnet 4 (the same default as we have today)
    -   It should be customizable
-   New tables:
    -   create `new_messages`
    -   create `new_message_parts`

The current chat experience primarily exists in these files (but also other files):

-   MultiChat.tsx
-   ChatInput.tsx
-   MessagesAPI.ts

Our implementation should revolve around these new files:

-   GroupChat.tsx
    -   Analogous to the old MultiChat.tsx
    -   This file contains the UI for rendering a single group chat, including all of the previous messages in the chat.
    -   It will contain the Composer, see below.
-   Composer.tsx
    -   Analogous to the old ChatInput.tsx
    -   This file contains the UI where the user will write their message
    -   The user will be able to mention a model by its display name using the `@` signifier
-   GroupChatAPI.ts
    -   Analogous to the old MessagesAPI.ts
    -   This file contains the types, queries, and mutations for all group chat related database operations.

You can create other files as needed (e.g. for utils, error handling, splitting up components, etc).

## v2 spec

DO NOT implement any of these things. They’re on the roadmap. You do not need to support any of these. Just keep in mind that we may want to support them later.

-   each chat has a list of participants (in the Chorus codebase, these are ModelConfigs), one of which is the default participant
-   live mode (formerly conductor)
    -   A toggle at the top of the chat window
    -   Per chat configuration
    -   Conductor will know all available aliases
-   Slash commands to perform actions from within a message
    -   /thread → redirects a message into a thread
    -   /promote → promotes a message to the main channel
    -   x2 / x3 → a custom command to get the same model to reply multiple times from different perspectives
-   Custom aliases for model(s) (formerly presets)
-   Branching chats
-   Message queuing
    -   If you send message A, then message B, if no model has responded to message A yet, message B shouldn’t be responded to until message A completes.
-   Participant box
    -   A box (similar to Slack) that clearly indicates all of the models available to ping
-   Custom affordances on top of composer:
    -   We’re not going to ship any “suggestions” in v1 (or any custom UI treatment for things like reviews)
    -   We first want to hear user feedback about what prompts they’re pasting over and over, and what use cases they want special UI treatments for
    -   The risk is things are _too_ clunky and unclear without these so users will be confused in v1, but we want to see what happens
-   Chunking
    -   How do we chunk? By message part? By paragraph?
    -   How do we chunk in the UI? Just show a button when you hover over a chunk? Each chunk is its own message?
        -   If we creates separate messages, what happens to the “show more” button?
-   Multiple humans

## GC Prototype

We already implemented a prototype of most of this functionality. It’s in src/core/chorus/gc-prototype and src/ui/components/gc-prototype. It’s good to reference this code to get an idea for how you might build things, but also feel free to make your own design decisions.

Note that the prototype cuts a lot of corners that we cannot cut in this implementation!

Don’t look at `docs/gc-docs`, it will be confusing and unhelpful.
