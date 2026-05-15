import type { DocsDeleteRequest, DocsInsertRequest } from "./types";

const DOCS_API_BASE_URL = "https://docs.googleapis.com/v1/documents";

interface GoogleDocsStructuralElement {
  endIndex?: number;
}

interface GoogleDocsDocumentResponse {
  body?: {
    content?: GoogleDocsStructuralElement[];
  };
}

function buildBatchUpdateUrl(documentId: string): string {
  return `${DOCS_API_BASE_URL}/${encodeURIComponent(documentId)}:batchUpdate`;
}

function buildDocumentUrl(documentId: string): string {
  return `${DOCS_API_BASE_URL}/${encodeURIComponent(documentId)}`;
}

async function readFailureBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "Unable to read response body.";
  }
}

function buildAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function insertText(
  documentId: string,
  accessToken: string,
  index: number,
  text: string,
): Promise<{ updatedIndex: number }> {
  const requestBody: DocsInsertRequest = {
    requests: [
      {
        insertText: {
          location: { index },
          text,
        },
      },
    ],
  };
  const response = await fetch(buildBatchUpdateUrl(documentId), {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Google Docs insertText failed with ${response.status}: ${await readFailureBody(response)}`);
  }

  return { updatedIndex: index + text.length };
}

export async function deleteText(
  documentId: string,
  accessToken: string,
  startIndex: number,
  endIndex: number,
): Promise<void> {
  const requestBody: DocsDeleteRequest = {
    requests: [
      {
        deleteContentRange: {
          range: {
            startIndex,
            endIndex,
          },
        },
      },
    ],
  };
  const response = await fetch(buildBatchUpdateUrl(documentId), {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Google Docs deleteText failed with ${response.status}: ${await readFailureBody(response)}`);
  }
}

export async function getDocumentEndIndex(documentId: string, accessToken: string): Promise<number> {
  const response = await fetch(buildDocumentUrl(documentId), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google Docs getDocumentEndIndex failed with ${response.status}: ${await readFailureBody(response)}`);
  }

  const documentBody = (await response.json()) as GoogleDocsDocumentResponse;
  const content = documentBody.body?.content ?? [];
  const lastElement = content[content.length - 1];
  const endIndex = lastElement?.endIndex ?? 1;

  return Math.max(endIndex - 1, 1);
}
