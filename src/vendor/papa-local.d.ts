export class Parser {
  constructor(config: { delimiter?: string; newline?: string; preview?: number; header?: boolean });
  parse(input: string): { data: string[][]; errors: { type: string; code: string; message: string; row?: number }[]; meta: { aborted: boolean; truncated: boolean } };
}
