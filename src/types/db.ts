/**
 * Placeholder for Supabase-generated types.
 *
 * Regenerate after every schema change with:
 *   pnpm db:types
 *
 * Until the schema is applied this file exports a minimal stub so the
 * project type-checks. Replace by running the codegen command above.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
