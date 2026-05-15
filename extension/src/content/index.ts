import { isGoogleDoc } from "./docReader";
import { registerMessageHandler } from "./messageHandler";

export type * from "./types";
export { ChunkPlayer, wait } from "./chunkPlayer";
export { readDocumentText, isGoogleDoc } from "./docReader";
export { focusEditor, insertParagraphBreak, insertTextAtCaret, moveCaretToEnd } from "./docWriter";
export { registerMessageHandler } from "./messageHandler";

if (isGoogleDoc()) {
  console.log("Veriton content script active on Google Doc");
  registerMessageHandler();
}
