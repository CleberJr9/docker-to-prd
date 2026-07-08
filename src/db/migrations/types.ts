export interface Migration {
  /** Identificador ordenável e imutável da migração (ex.: "001"). */
  id: string;
  /** Nome legível da migração. */
  name: string;
  /** SQL a ser executado. Pode conter uma ou mais instruções. */
  sql: string;
}
