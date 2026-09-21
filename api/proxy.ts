/**
 * Vercel Serverless Function at /api/proxy.
 *
 * Clients (services/geminiService.ts, services/googleApiService.ts) POST here.
 * This is a minimal placeholder — the previous functions/proxy.ts was an empty
 * module that broke production deploys because vercel.json pointed "functions"
 * at a path outside the api/ directory.
 *
 * Real Google/Gemini proxy logic can replace this stub later.
 */
export default function handler(
  req: { method?: string },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void };
  }
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: "method-not-allowed",
      message: "Only POST is supported on /api/proxy.",
    });
  }

  return res.status(501).json({
    ok: false,
    error: "not-implemented",
    message:
      "The /api/proxy serverless function is a placeholder. Backend proxy logic is not implemented yet.",
  });
}
