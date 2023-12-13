import { google } from "googleapis"
import { throwError } from "base-core/lib/exception.js"
import { Scope } from "base-core/lib/scope.js"
import {
  GoogleDriveCreateNoteRequest,
  GoogleDriveCreateNoteResponse,
} from "cm-quantum-peripheral-common/lib/schema/google-drive.js"

// https://console.cloud.google.com/iam-admin/serviceaccounts/details/109975121599998380833/keys?project=cmc-ai
const saKeyFile = "quantum-peripheral/quantum-peripheral-demo.gcp-sa.json"

// https://drive.google.com/drive/u/0/folders/1r6v_Oi5k7eiUdeHhofuShVwxSd48p6BG
const folderId = "1r6v_Oi5k7eiUdeHhofuShVwxSd48p6BG"

export async function googleDriveCreateNote(
  scope: Scope,
  request: GoogleDriveCreateNoteRequest
): Promise<GoogleDriveCreateNoteResponse> {
  const name = `${request.title} - ${new Date().toLocaleString()}`
  const SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
  ]
  const auth = new google.auth.GoogleAuth({
    keyFile: saKeyFile,
    scopes: SCOPES,
  })
  const drive = google.drive({ version: "v3", auth })

  const resp = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      mimeType: "application/vnd.google-apps.document",
    },
    fields: "id",
  })
  const docId = resp.data.id ?? throwError("Failed to create doc")
  const docs = google.docs({ version: "v1", auth })
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: {
              index: 1,
            },
            text: request.content,
          },
        },
      ],
    },
  })
  return { name, url: `https://docs.google.com/document/d/${docId}/` }
}
