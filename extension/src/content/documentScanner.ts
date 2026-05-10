/*
Google Cloud setup required before document scanning can authenticate:

1. Go to https://console.cloud.google.com
2. Create a new project called "Veriton"
3. Enable the Google Docs API
4. Go to APIs & Services -> OAuth consent screen -> configure
5. Go to Credentials -> Create Credentials -> OAuth 2.0 Client ID
6. Select Chrome Extension as the application type
7. Enter the extension ID: oibdgcdpjdeelkjlfpdneojhjkbklbch
8. Copy the Client ID into manifest.json under "oauth2":
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID_HERE",
     "scopes": ["https://www.googleapis.com/auth/documents.readonly"]
   }
*/

import type { ExtractTopicsRuntimeResponse, FetchDocumentTextRuntimeResponse } from "../types/messages";

export interface ScannedDocument {
  documentId: string;
  fullText: string;
  keyPhrases: string[];
  wordCount: number;
}

export class DocumentScanError extends Error {
  constructor(
    message: string,
    readonly step: "document-id" | "fetch" | "phrases" | "unknown"
  ) {
    super(message);
    this.name = "DocumentScanError";
  }
}

export function getDocumentId(): string | null {
  const match = window.location.href.match(/\/document\/d\/([^/]+)/);
  return match?.[1] ?? null;
}

function requestDocumentText(documentId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "FETCH_DOCUMENT_TEXT", documentId }, (response: FetchDocumentTextRuntimeResponse | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new DocumentScanError(runtimeError.message ?? "Could not request document text from the service worker.", "fetch"));
        return;
      }
      if (!response?.text) {
        reject(new DocumentScanError(response?.error ?? "The service worker returned no document text.", "fetch"));
        return;
      }
      resolve(response.text);
    });
  });
}

async function extractAcademicTopics(text: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "EXTRACT_TOPICS", text }, (response: ExtractTopicsRuntimeResponse | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new DocumentScanError(runtimeError.message ?? "Could not request academic topic extraction from the service worker.", "phrases"));
        return;
      }
      if (!response?.topics?.length) {
        reject(new DocumentScanError(response?.error ?? "The service worker returned no academic topics.", "phrases"));
        return;
      }
      resolve(response.topics);
    });
  });
}

export async function scanDocument(): Promise<ScannedDocument> {
  try {
    const documentId = getDocumentId();
    if (!documentId) {
      throw new DocumentScanError("Could not find a Google Docs document ID in the current tab URL.", "document-id");
    }

    const fullText = await requestDocumentText(documentId);
    if (!fullText) {
      throw new DocumentScanError("The Google Docs API returned an empty document.", "fetch");
    }

    const keyPhrases = await extractAcademicTopics(fullText);
    if (keyPhrases.length === 0) {
      throw new DocumentScanError("No academic key phrases could be detected in this document.", "phrases");
    }

    return {
      documentId,
      fullText,
      keyPhrases,
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
    };
  } catch (error) {
    if (error instanceof DocumentScanError) {
      throw error;
    }
    throw new DocumentScanError(error instanceof Error ? error.message : String(error), "unknown");
  }
}
