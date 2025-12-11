/**
 * Wraps an async function to catch and log any unhandled promise rejections.
 * Use this to prevent silent failures in event handlers.
 * Prevents eslint error "Promises must be awaited, ..."
 * @param fn The async function to wrap
 * @returns A function with the same signature but with error handling
 */
export const catchAsyncErrors =
    <Args extends unknown[]>(fn: (...args: Args) => Promise<void>) =>
    (...args: Args) => {
        fn(...args).catch(console.error);
    };

// /**
//  * Currently unused, hasn't been updated to handle tools blocks
//  */
// export function combineAdjacentMessages(messages: LLMMessage[]): LLMMessage[] {
//     if (messages.length <= 1) return messages;

//     const result: LLMMessage[] = [messages[0]];

//     for (let i = 1; i < messages.length; i++) {
//         const currentMessage = messages[i];
//         const previousMessage = result[result.length - 1];

//         if (currentMessage.role === previousMessage.role) {
//             // Combine content
//             previousMessage.content += "\n\n" + currentMessage.content;

//             // Combine attachments if they exist
//             if (currentMessage.attachments?.length) {
//                 previousMessage.attachments = [
//                     ...(previousMessage.attachments || []),
//                     ...currentMessage.attachments,
//                 ];
//             }
//         } else {
//             result.push(currentMessage);
//         }
//     }

//     return result;
// }
