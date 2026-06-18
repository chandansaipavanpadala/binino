export interface AnalysisResult {
  job_id: string;
  arch: string;
  functions: string[];
  strings: string[];
  symbols: string[];
  entry_point: string;
  raw_assembly_snippet: string;
  raw_c?: string;
}
