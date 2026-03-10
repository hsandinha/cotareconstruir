import * as XLSX from "xlsx";

export type CsvInputRow = Record<string, string | number | boolean | null | undefined>;
export type ParsedCsvRow = Record<string, string>;

export function normalizeCsvKey(value: string): string {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function escapeCsvCell(value: unknown, delimiter: string): string {
    const text = value === null || value === undefined ? "" : String(value);
    const needsQuotes = text.includes(delimiter) || text.includes('"') || text.includes("\n") || text.includes("\r");
    if (!needsQuotes) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: CsvInputRow[], headers: string[], delimiter = ";"): string {
    const lines: string[] = [];
    lines.push(headers.map((header) => escapeCsvCell(header, delimiter)).join(delimiter));

    for (const row of rows) {
        const line = headers
            .map((header) => escapeCsvCell(row[header], delimiter))
            .join(delimiter);
        lines.push(line);
    }

    return `\uFEFF${lines.join("\n")}`;
}

export function downloadCsvFile(fileName: string, csvContent: string): void {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function detectDelimiter(text: string): string {
    const sample = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0) || "";

    const semicolons = (sample.match(/;/g) || []).length;
    const commas = (sample.match(/,/g) || []).length;

    return semicolons >= commas ? ";" : ",";
}

function parseCsvMatrix(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentCell += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentCell += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === delimiter) {
            currentRow.push(currentCell);
            currentCell = "";
            continue;
        }

        if (char === "\n") {
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = "";
            continue;
        }

        if (char === "\r") {
            continue;
        }

        currentCell += char;
    }

    currentRow.push(currentCell);
    const hasContent = currentRow.some((cell) => String(cell).trim().length > 0);
    if (hasContent || rows.length === 0) {
        rows.push(currentRow);
    }

    return rows;
}

export function parseCsv(text: string): ParsedCsvRow[] {
    const cleaned = String(text || "").replace(/^\uFEFF/, "");
    if (!cleaned.trim()) return [];

    const delimiter = detectDelimiter(cleaned);
    const matrix = parseCsvMatrix(cleaned, delimiter);
    if (matrix.length === 0) return [];

    const headers = matrix[0].map((header) => String(header || "").trim());
    if (headers.every((header) => !header)) return [];

    const rows: ParsedCsvRow[] = [];
    for (let i = 1; i < matrix.length; i++) {
        const line = matrix[i];
        const row: ParsedCsvRow = {};
        let hasValues = false;

        for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            if (!header) continue;
            const value = String(line[j] ?? "").trim();
            row[header] = value;
            if (value) hasValues = true;
        }

        if (hasValues) {
            rows.push(row);
        }
    }

    return rows;
}

function parseSpreadsheetMatrix(matrix: Array<Array<unknown>>): ParsedCsvRow[] {
    if (!Array.isArray(matrix) || matrix.length === 0) return [];

    const headers = (matrix[0] || []).map((header, index) => {
        const cleaned = String(header ?? "").trim().replace(/^\uFEFF/, "");
        return cleaned || `coluna_${index + 1}`;
    });

    const rows: ParsedCsvRow[] = [];
    for (let i = 1; i < matrix.length; i++) {
        const line = Array.isArray(matrix[i]) ? matrix[i] : [];
        const row: ParsedCsvRow = {};
        let hasValues = false;

        for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            const value = String(line[j] ?? "").trim();
            row[header] = value;
            if (value) hasValues = true;
        }

        if (hasValues) {
            rows.push(row);
        }
    }

    return rows;
}

export function isSpreadsheetFileName(fileName: string): boolean {
    const lower = String(fileName || "").toLowerCase();
    return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm") || lower.endsWith(".xlsb");
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedCsvRow[]> {
    const fileName = file?.name || "";
    if (isSpreadsheetFileName(fileName)) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) return [];

        const sheet = workbook.Sheets[firstSheetName];
        const matrix = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, {
            header: 1,
            blankrows: false,
            defval: "",
            raw: false,
        });

        return parseSpreadsheetMatrix(matrix || []);
    }

    const text = await file.text();
    return parseCsv(text);
}

export function getCsvRowValue(row: ParsedCsvRow, aliases: string[]): string {
    const normalizedAliasSet = new Set(aliases.map((alias) => normalizeCsvKey(alias)));

    for (const [key, value] of Object.entries(row)) {
        if (normalizedAliasSet.has(normalizeCsvKey(key))) {
            return String(value ?? "").trim();
        }
    }

    return "";
}

export function parseFlexibleNumber(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    let raw = String(value ?? "").trim();
    if (!raw) return null;

    raw = raw.replace(/R\$/gi, "").replace(/\s+/g, "");

    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");

    if (hasComma && hasDot) {
        if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
            raw = raw.replace(/\./g, "").replace(",", ".");
        } else {
            raw = raw.replace(/,/g, "");
        }
    } else if (hasComma) {
        raw = raw.replace(/\./g, "").replace(",", ".");
    }

    raw = raw.replace(/[^0-9.-]/g, "");
    if (!raw || raw === "-" || raw === "." || raw === "-.") {
        return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

export function parseBooleanish(value: unknown, fallback = false): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;

    const normalized = normalizeCsvKey(String(value ?? ""));
    if (!normalized) return fallback;

    if (["1", "true", "sim", "yes", "ativo", "ativa", "enabled", "disponivel"].includes(normalized)) {
        return true;
    }

    if (["0", "false", "nao", "no", "inativo", "inativa", "disabled", "indisponivel"].includes(normalized)) {
        return false;
    }

    return fallback;
}
