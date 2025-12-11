Right now, you could say the user is the "conductor" of the chat: they have the ability to call on other models (using @ and x1/x2/x3). I want to allow other models to take on this "conductor" role.

The "scope" for a conductor is either the main chat or a subthread. By default, in any scope, the user is the conductor. But the user can also hand over the baton to another model.

You can hand over the baton by saying /conduct. That means whichever model is called on by your message (or the first, if there are multiple) will become the conductor.

When a model is the conductor, it gets called anytime a message gets added to the thread. (The conductor is singlethreaded, so if it's already running in response to a previous message when a new one comes in, the first invocation gets cancelled, and the second invocation takes over.)

The conductor can write whatever it wants (just like the user), and it can call other models (just like the user). It can also call /yield to return control to the user.

For instance, the user might say "Do a debate between Gemini, Claude, and GPT-4o on tabs vs. spaces until everyone's set on their position, then summarize everyone's position for me. @grok /conduct". The responder, grok, would then conduct the conversation to satisfy the user's goal by calling on the different models until it feels the debate is done, and then it would /yield.

When a model is conducting, the user can press escape to interrupt it and return control to the user.

When a model is conducting, there will be an indicator (next to or below the typing indicator) saying "[model name] is conducting. ESC to interrupt."

Wdyt, is this well-specified? notice any edge cases I should clarify before we implement?

Edge cases and clarifications:

Q: What if models try to call /conduct?
A: Models cannot call /conduct, only user can call /conduct

Q: If the user @mentions multiple models and invokes /conduct, which one becomes the conductor? Or does it fail?
A: If the user ats multiple models and invokes /conduct, then the first one becomes the conductor? or else it just fails somehow? whatever's easiest

Q: What happens if the conductor crashes or doesn't return anything at all?
A: If the conductor crashes and doesn't return anything at all, then we return control to the user

Q: Can subthreads go deeper than one level?
A: No, subthreads only go one level deep. This is always the case and will continue to be the case with conductors

Q: Should there be a limit on how many turns a conductor can take?
A: Yes, the conductor should only be able to take 10 turns before control returns to the user.

Additional clarification:
It's not the first @mentioned model that becomes conductor - it's the first of the responders. So, if no one is @mentioned, then it will be the main/default model who becomes conductor!

Q: Do models know their own names in the conversation?
A: Yes, each model is told its name at the beginning of the conversation in the system instructions (e.g., "You are Claude Sonnet 4.0").
