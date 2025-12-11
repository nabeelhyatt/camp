## Steps to build the changelog

1. Check out `main` and pull
2. Find the last "Bump version" commit
3. Look at each commit since then
4. For each commit:
   a. Check the commit description, PR description, and GitHub issue for a section called "users to notify"
   b. If it's a substantial, user-facing change, write a one-sentence summary (see examples below)

Example summaries:

"Fixed a bug where menu shortcuts (new chat, settings, etc.) would occasionally stop working"
"Fixed a race condition that caused responses to occasionally appear out of order"
"Fixed spacing between attachments in the message composer"
"Fixed a regex error on older MacOS versions that would prevent users from sending messages"
"Reduced the max_token size for Anthropic models to prevent early out of context errors"
"Pasting files and URLs is now supported in project descriptions"
"Added support for importing chat history from OpenAI and Anthropic"

Give me a report with

1. The number of commits you looked at
2. A draft changelog (see below)
3. For each feature with users to notify, a list of the users to notify

<example>
# Replies 
_0.12.0_ 
June 23rd, 2025

Introducing replies! Ask follow-up questions to model responses while keeping your chat history clean. Learn more in the Chorus docs: https://docs.chorus.sh/core/replies

![CleanShot 2025-06-23 at 15 35 18@2x](https://github.com/user-attachments/assets/afd7b92a-af01-4dc8-a966-823787ea1534)

Fixes:

-   Fixed a bug with keyboard navigation in the model picker

Misc:

-   Show more (100k) characters in attachment previews
    </example>

<example>
# Summarize Out of Context Chats 
_0.11.4_ 
June 19th, 2025

When you reach the context limit in a chat, Chorus will now help you summarize your chat and create a new one!

![image](https://github.com/user-attachments/assets/a0016375-91a9-4bb8-868c-21178bf666fd)

Fixes:

-   Fix various bugs when using the command menu to search for chats

Misc:

-   Update Chorus’s prompts used for summarizing chats
-   Update Chorus’s toast component
    </example>

<example>
# Remote MCPs 
_0.11.3_
June 17th, 2025

We’ve added support for Remote MCPs in Chorus! To add a remote MCP, go to Settings → Connections → Add Remote MCP

Chorus supports both SSE and Streamable HTTP transport protocols.

Fixes:

-   Fixed a bug where menu shortcuts (new chat, settings, etc.) would occasionally stop working
-   Fixed a race condition that caused responses to occasionally appear out of order
-   Fixed spacing between attachments in the message composer
-   Fixed a regex error on older MacOS versions that would prevent users from sending messages
    </example>
