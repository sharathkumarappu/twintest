/**
 * Minimal type declarations for oracledb — covers only the API surface
 * used by Database.ts and DatabaseUtility.ts.
 */
declare module 'oracledb' {
  // Constants
  export const OUT_FORMAT_OBJECT: number;
  export const BIND_IN: number;
  export const BIND_OUT: number;
  export const STRING: number;
  export const NUMBER: number;
  export const DATE: number;

  export interface ConnectionAttributes {
    user: string;
    password: string;
    connectString: string;
  }

  export interface ExecuteOptions {
    outFormat?: number;
    autoCommit?: boolean;
  }

  export interface BindParameter {
    dir: number;
    type: number;
    val?: unknown;
  }

  export interface Result<T = unknown> {
    rows?: T[];
    rowsAffected?: number;
    outBinds?: Record<string, unknown>;
  }

  export interface Connection {
    execute(
      sql: string,
      binds?: Record<string, BindParameter> | unknown[],
      options?: ExecuteOptions,
    ): Promise<Result<Record<string, unknown>>>;
    close(): Promise<void>;
  }

  export function getConnection(attrs: ConnectionAttributes): Promise<Connection>;
}
