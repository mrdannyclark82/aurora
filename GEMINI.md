Generate a complete backend implementation for a Vercel Serverless Function written in TypeScript for the file `functions/proxy.ts`.

This function will act as a secure backend proxy for a React application. The frontend sends all API requests to this single endpoint (`/api/proxy`) via a POST request.

**Core Requirements:**

1.  **Technology:** Use Node.js, TypeScript, and the `@google/genai` SDK for Gemini. For Google Workspace APIs (Gmail, Calendar, Drive), use the official `googleapis` library and `google-auth-library` to handle the user's access token.
2.  **Request Handling:** The function must parse the incoming JSON body to determine the service and action to perform. The body has the shape: `{ service: 'gemini' | 'google', action: 'actionName', ...params }`.
3.  **Security:** The Gemini API key must be securely read from an environment variable named `GEMINI_API_KEY`.
4.  **Error Handling:** Implement robust error handling and return meaningful JSON error messages with appropriate HTTP status codes (e.g., 400 for bad requests, 500 for server errors).
5.  **Streaming Support:** For the `generateChatStream` action, the response must be a `ReadableStream` to stream the Gemini API response back to the client.

**Detailed Implementation:**

Create a Vercel `ApiRoute` handler that uses a `switch` statement on `req.body.service`.

**A. If `service === 'gemini'`:**
   - Initialize the `GoogleGenAI` client using `process.env.GEMINI_API_KEY`.
   - Implement a `switch` on `req.body.action` for the following actions from `geminiService.ts`:
     - `generateText`: Call `ai.models.generateContent`.
     - `generateSearch`: Call `ai.models.generateContent` with the `googleSearch` tool.
     - `generateMaps`: Call `ai.models.generateContent` with the `googleMaps` tool.
     - `analyzeVideo`: Handle video data and call `ai.models.generateContent`.
     - `generateImage`: Call `ai.models.generateImages` using the 'imagen-4.0-generate-001' model.
     - `generateSpeech`: Call `ai.models.generateContent` with the 'gemini-2.5-flash-preview-tts' model.
     - `generateVideo`, `getVideosOperation`, `fetchVideo`: Implement the full polling flow for the `veo` model.
     - `generateChatStream`: Call `ai.models.generateContentStream` and pipe the output to the Vercel response stream.
     - `generateChat`: A non-streaming version of the chat.
     - `generateWithTools`: Handle generic requests that pass in `contents` and `tools`.
     - `runAgent`: This is complex. For now, implement a placeholder that returns a mock success message, as a full agentic loop is beyond a single file.

**B. If `service === 'google'`:**
   - Extract the user's `accessToken` from the `Authorization: Bearer <token>` header.
   - Use `google-auth-library` to create an `OAuth2Client` and set its credentials with the user's access token.
   - Initialize the required Google APIs (e.g., `google.gmail('v1')`, `google.calendar('v3')`).
   - Implement a `switch` on `req.body.action` for the following actions from `googleApiService.ts`:
     - `fetchUnreadGmail`: List messages, filtering by 'UNREAD'.
     - `fetchCalendarEvents`: List upcoming events.
     - `createCalendarEvent`: Insert a new calendar event.
     - `searchDriveFiles`: Search for files using `drive.files.list`.
     - `getDriveFileContent`: Get file content using `drive.files.get` with `alt: 'media'`. Handle different MIME types (e.g., Google Docs needs to be exported).

Please provide the full, ready-to-use code for the `functions/proxy.ts` file, including all necessary imports and type definitions.