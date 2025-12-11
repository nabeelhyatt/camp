Previous work:

[Core chat reference points](https://www.notion.so/Core-chat-reference-points-20fa076bd0f2801aa995fa71abd9615e?pvs=21)

In particular, check the sections on [multiplayer](https://www.notion.so/Core-chat-reference-points-20fa076bd0f2801aa995fa71abd9615e?pvs=21) and [popcorn style](https://www.notion.so/Core-chat-reference-points-20fa076bd0f2801aa995fa71abd9615e?pvs=21), which I see as the two defining characteristics of group chats. Everything else is downstream implications of those two ideas.

Rest of this doc is just miscellaneous commentary.

## Some of the fundamental actions of group chats

-   add people, boot people
-   send a message
-   call on an AI (ask it to send a message)
-   delete a message to remove it from context

## What the UI would look like

-   like iMessage, you have your participants at the top
-   instead of streaming, we see “Claude is typing…”
-   we might want to show timestamps? see comment [here](https://www.notion.so/Core-chat-reference-points-20fa076bd0f2801aa995fa71abd9615e?pvs=21), depends whether this turns out to be a problem in practice or not
-   probably we’d want to have some way of collapsing long messages, as in iMessage

## Where group chats really shine

They makes these things feel super easy and natural:

-   Reviews
-   Synthesis
-   Deep debate

## Where they fall short

One annoying complexity of compare mode—figuring out what’s in the context—is answered elegantly by group chats: _everything_ is in the context.

One potential downside, though, is that this makes it harder to survey your options and then pick just one to put into the context. With group chats, everything goes in by default, and then anything you don’t like, you have to remove.

So if you’re used to using two models in compare mode, if you do the same thing in group chats, and don’t bother to prune the responses from one of the models, both will go into context, and then your context will fill up twice as fast.

I’m not sure this is a big problem in practice, though. I feel like it’ll just work.

## Potential pitfalls

-   It’s too hard to control who responds when
-   It just feels “out of control” - people keep responding when I don’t expect them too, it’s too jarring, I want them to all shut up
-   It feels too slow because there’s no streaming

## Possible strategies for determining which AI responds when

1. Every AI responds to every user message
2. They only respond when you @ them (or `@channel`)
    1. Or you can invoke them some other way - maybe cmd+1, cmd+2, etc. to call on them. It’s a bit like playing the piano - playing a song with your AIs!
3. The AIs take turns responding, going around in a circle, with a 2 min delay between each response. When human sends a message, that forces the next response to happen immediately.
4. Each AI has a policy (written in English, and you get to write it) saying when it’s going to respond

## Under the hood

The naive implementation of `@channel` would have each AI respond independently. No one reads anyone else’s message before responding.

But humans tend to pause before submitting to read whatever else has been posted, and revise what they said if necessary. We could let the AIs do that too.

Or maybe we don’t need to.

### Threads

Threads pair very well with group chats. Probably not necessary for the MVP, though.

## Configuration

Each participant is an “agent.” An agent is built of a model, a system prompt, a policy that says when it should respond, a set of tools it has access to, and (maybe?) a private scratchpad it can write on.

You can use our prebuilt agents, or you can build your own in your agent library. It’s like Build-a-Bear!

## Multiple humans

We probably want to plan to support multiple humans as well.
