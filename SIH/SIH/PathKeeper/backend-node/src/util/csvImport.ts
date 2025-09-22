// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse } = require('csv-parse/sync');

export interface RawStudentRow {
  studentCode: string;
  name: string;
  email: string;
  program?: string;
  year?: string;
  riskScore?: string;
}

export interface ParsedStudentRow {
  studentCode: string;
  name: string;
  email: string;
  program?: string | null;
  year?: number | null;
  riskScore?: number | null;
}

export interface ImportResult {
  ok: boolean;
  dryRun: boolean;
  counts: { total: number; valid: number; created: number; skipped: number; errors: number };
  errors: { line: number; error: string }[];
  rows: ParsedStudentRow[]; // valid rows
}

interface ValidateOptions {
  existingCodes: Set<string>;
  existingEmails: Set<string>;
}

export function parseAndValidateCSV(csv: string, opts: ValidateOptions): ImportResult {
  const records: RawStudentRow[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const errors: { line: number; error: string }[] = [];
  const rows: ParsedStudentRow[] = [];
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  records.forEach((rec, idx) => {
    const line = idx + 2; // header is line 1
    const rowErrors: string[] = [];
    const code = rec.studentCode?.trim();
    const name = rec.name?.trim();
    const emailRaw = rec.email?.trim();
    const email = emailRaw?.toLowerCase();
    if (!code || !name || !email) {
      rowErrors.push('Missing required studentCode|name|email');
    }
    // Duplicate checks (still record all other validation errors for visibility)
    if (code && (opts.existingCodes.has(code) || seenCodes.has(code))) {
      rowErrors.push('Duplicate studentCode');
    }
    if (email && (opts.existingEmails.has(email) || seenEmails.has(email))) {
      rowErrors.push('Duplicate email');
    }
    let year: number | null = null;
    if (rec.year) {
      const y = Number(rec.year);
      if (!Number.isNaN(y) && y >= 0 && y <= 12) year = y; else rowErrors.push('Invalid year');
    }
    let riskScore: number | null = null;
    if (rec.riskScore) {
      const r = Number(rec.riskScore);
      if (!Number.isNaN(r) && r >= 0 && r <= 1) riskScore = r; else rowErrors.push('Invalid riskScore');
    }
    if (rowErrors.length === 0) {
      rows.push({
        studentCode: code!,
        name: name!,
        email: email!,
        program: rec.program?.trim() || null,
        year,
        riskScore
      });
      seenCodes.add(code!);
      seenEmails.add(email!);
    } else {
      // Emit one error entry per error to satisfy tests expecting distinct messages
      rowErrors.forEach(err => errors.push({ line, error: err }));
    }
  });

  const valid = rows.length;
  return {
    ok: errors.length === 0,
    dryRun: true,
    counts: {
      total: records.length,
      valid,
      created: 0,
      skipped: records.length - valid,
      errors: errors.length
    },
    errors,
    rows
  };
}