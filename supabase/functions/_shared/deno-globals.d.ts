// Ambient types for the parts of the Deno runtime the Edge Functions use.
// Supabase's Edge runtime ships these globals; this file only exists so the
// function sources can be type-checked with the repository's TypeScript
// (they are excluded from the Next.js program).

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}
