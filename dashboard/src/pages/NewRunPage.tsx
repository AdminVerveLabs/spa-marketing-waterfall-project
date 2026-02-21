import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { triggerPipelineRun } from '@/lib/webhooks';
import { NewRunForm } from '@/components/runs/NewRunForm';
import type { SearchQueryTemplate, PipelineRun } from '@/types';

const FALLBACK_TEMPLATES: SearchQueryTemplate[] = [
  { id: "1", name: "Default Massage/Spa", queries: ["massage therapy", "massage clinic", "RMT", "spa massage", "massage therapist"], is_default: true, created_at: "" },
  { id: "2", name: "Spa Focus", queries: ["day spa", "med spa", "wellness spa", "beauty spa"], is_default: false, created_at: "" },
  { id: "3", name: "Wellness Broad", queries: ["wellness center", "holistic healing", "bodywork", "therapeutic massage"], is_default: false, created_at: "" },
];

export function NewRunPage() {
  const [templates, setTemplates] = useState<SearchQueryTemplate[]>(FALLBACK_TEMPLATES);
  const [rerunData, setRerunData] = useState<PipelineRun | null>(null);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const rerunId = searchParams.get('rerun');

  useEffect(() => {
    supabase
      .from('search_query_templates')
      .select('*')
      .then(({ data, error }) => {
        if (error) toast.error(`Failed to load templates: ${error.message}`);
        if (data && data.length > 0) setTemplates(data as SearchQueryTemplate[]);
      });
  }, []);

  useEffect(() => {
    if (!rerunId) return;
    supabase
      .from('pipeline_runs')
      .select('*')
      .eq('id', rerunId)
      .single()
      .then(({ data, error }) => {
        if (error) toast.error(`Failed to load previous run: ${error.message}`);
        if (data) setRerunData(data as PipelineRun);
      });
  }, [rerunId]);

  const handleSubmit = async (data: {
    country: string;
    state: string;
    city: string;
    metro_name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    search_queries: string[];
    yelp_location: string;
  }) => {
    // Check for already-running pipelines before triggering
    const { data: activeRuns } = await supabase
      .from('pipeline_runs')
      .select('id, metro_name, status')
      .in('status', ['running', 'queued']);

    const hasRunning = activeRuns?.some(r => r.status === 'running');

    const { data: run, error } = await supabase
      .from('pipeline_runs')
      .insert({
        country: data.country,
        state: data.state,
        city: data.city,
        metro_name: data.metro_name,
        latitude: data.latitude,
        longitude: data.longitude,
        radius_meters: data.radius_meters,
        search_queries: data.search_queries,
        yelp_location: data.yelp_location,
        status: 'queued',
        triggered_by: user?.email || 'unknown',
      })
      .select()
      .single();

    if (error) {
      toast.error(`Failed to create run: ${error.message}`);
      throw error;
    }

    if (hasRunning) {
      toast.info(`Run queued for ${data.metro_name} — will start after the current pipeline finishes.`);
      return;
    }

    await triggerPipelineRun({
      run_id: run.id,
      metro_name: data.metro_name,
      latitude: data.latitude,
      longitude: data.longitude,
      radius_meters: data.radius_meters,
      search_queries: data.search_queries,
      yelp_location: data.yelp_location,
      country: data.country,
      state: data.state,
      city: data.city,
    });

    toast.success(`Pipeline triggered for ${data.metro_name}`);
  };

  return <NewRunForm templates={templates} onSubmit={handleSubmit} initialData={rerunData} />;
}
