export interface FunctionRecord {
  name: string;
  address: string;
  size?: number;
  pseudo_c: string;
  assembly?: string;
}

export interface AnalysisResult {
  job_id: string;
  arch: string;
  functions: FunctionRecord[];
  strings: Array<{ address: string; value: string; encoding?: string }>;
  symbols: Array<{ address: string; name: string; type?: string }>;
  entry_point: string;
  raw_assembly_snippet: string;
  simulated?: boolean;
}

