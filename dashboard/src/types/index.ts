export interface MetroCity {
  city: string;
  lat: number;
  lng: number;
  metro_name: string;
  yelp_location: string;
}

export interface StateData {
  name: string;
  cities: MetroCity[];
}

export type MetroData = Record<string, Record<string, StateData>>;

export interface PipelineRun {
  id: string;
  country: string;
  state: string;
  city: string;
  metro_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  search_queries: string[];
  yelp_location: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_discovered: number | null;
  new_records: number | null;
  contacts_found: number | null;
  duplicates_merged: number | null;
  errors: string[] | null;
  triggered_by: string | null;
  n8n_execution_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SearchQueryTemplate {
  id: string;
  name: string;
  queries: string[];
  is_default: boolean;
  created_at: string;
}

export interface RunCoverageStats {
  country: string;
  state: string;
  city: string;
  completed_runs: number;
  total_runs: number;
  total_discovered: number;
  total_new_records: number;
  total_contacts: number;
  last_completed_at: string | null;
}
