import { ChunkPlayer } from "./chunkPlayer";
import { readDocumentText } from "./docReader";
import { insertTextAtCaret, moveCaretToEnd } from "./docWriter";
import type { ContentMessage } from "./types";

type SendResponse = (response?: unknown) => void;

export function registerMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (message: ContentMessage, _sender: chrome.runtime.MessageSender, sendResponse: SendResponse): true => {
      if (message.type === "VERITON_GET_DOC_TEXT") {
        const result = readDocumentText();
        sendResponse({ type: "VERITON_DOC_TEXT_RESPONSE", text: result.text, success: result.success });
        return true;
      }

      if (message.type === "VERITON_INSERT_INLINE") {
        moveCaretToEnd();
        const result = insertTextAtCaret(` ${message.text}`);
        sendResponse({ success: result.success, charactersInserted: result.charactersInserted });
        return true;
      }

      if (message.type === "VERITON_INSERT_WORKS_CITED") {
        moveCaretToEnd();
        const result = insertTextAtCaret(message.text);
        sendResponse({ success: result.success, charactersInserted: result.charactersInserted });
        return true;
      }

      if (message.type === "VERITON_START_LIVE_DRAFT") {
        const player = new ChunkPlayer();
        player
          .play(message.chunks)
          .then((finalState) => {
            sendResponse({ success: true, finalState });
          })
          .catch((error: unknown) => {
            sendResponse({ success: false, error: String(error) });
          });
        return true;
      }

      sendResponse({ success: false, error: "Unknown message type." });
      return true;
    },
  );
}
