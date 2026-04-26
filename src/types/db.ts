/**
 * Placeholder for Supabase-generated types.
 *
 * Regenerate after every schema change with:
 *   pnpm db:types
 *
 * This stub is intentionally permissive: it satisfies supabase-js's generic
 * constraints (so `.from('anything')` type-checks) and returns loosely-typed
 * rows. The application code then casts results to its `domain.ts` types.
 *
 * Once you've linked a Supabase project and run codegen, this file is
 * overwritten with the real, fully-typed schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { [key: string]: any };

interface GenericTable {
  Row: Row;
  Insert: Row;
  Update: Row;
  Relationships: unknown[];
}

interface GenericView {
  Row: Row;
  Relationships: unknown[];
}

interface GenericFunction {
  Args: Row;
  Returns: unknown;
}

export interface Database {
  public: {
    Tables: { [tableName: string]: GenericTable };
    Views: { [viewName: string]: GenericView };
    Functions: { [functionName: string]: GenericFunction };
    Enums: { [enumName: string]: string };
    CompositeTypes: { [typeName: string]: Row };
  };
}
