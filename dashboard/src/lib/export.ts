import * as XLSX from 'xlsx';
import { supabase } from './supabase';

export async function downloadRunReport(metroName: string): Promise<void> {
  // 1. Fetch companies for this metro
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('*')
    .eq('discovery_metro', metroName)
    .neq('enrichment_status', 'needs_review')
    .order('lead_score', { ascending: false, nullsFirst: false });

  if (compErr) throw new Error(`Failed to fetch companies: ${compErr.message}`);
  if (!companies?.length) throw new Error(`No companies found for ${metroName}`);

  // 2. Fetch contacts for those companies
  const companyIds = companies.map((c: any) => c.id);
  const { data: contacts, error: ctErr } = await supabase
    .from('contacts')
    .select('*')
    .in('company_id', companyIds);

  if (ctErr) throw new Error(`Failed to fetch contacts: ${ctErr.message}`);

  // Build company lookup for contact sheet
  const companyMap = new Map(companies.map((c: any) => [c.id, c.name]));

  // 3. Build Companies sheet
  const companyRows = companies.map((c: any) => ({
    'Lead Score': c.lead_score ?? '',
    'Company Name': c.name ?? '',
    'Category': c.category ?? '',
    'Phone': c.phone ?? '',
    'Email': c.email ?? '',
    'Email Status': c.email_status ?? '',
    'Website': c.domain ?? '',
    'Address': c.address ?? '',
    'City': c.city ?? '',
    'State': c.state ?? '',
    'Google Rating': c.google_rating ?? '',
    'Google Reviews': c.google_review_count ?? '',
    'Has Booking': c.has_online_booking ? 'Yes' : 'No',
    'Booking Platform': c.booking_platform ?? '',
    'On Groupon': c.on_groupon ? 'Yes' : 'No',
    'Estimated Size': c.estimated_size ?? '',
    'Enrichment Status': c.enrichment_status ?? '',
    'Phone Status': c.phone_status ?? '',
  }));

  // 4. Build Contacts sheet
  const contactRows = (contacts ?? []).map((ct: any) => ({
    'Company Name': companyMap.get(ct.company_id) ?? '',
    'First Name': ct.first_name ?? '',
    'Last Name': ct.last_name ?? '',
    'Role': ct.role ?? '',
    'Is Owner': ct.is_owner ? 'Yes' : 'No',
    'Business Email': ct.email_business ?? '',
    'Personal Email': ct.email_personal ?? '',
    'Direct Phone': ct.phone_direct ?? '',
    'Email Status': ct.email_status ?? '',
    'Phone Status': ct.phone_status ?? '',
    'Phone Type': ct.phone_line_type ?? '',
    'Carrier': ct.phone_carrier ?? '',
    'LinkedIn': ct.linkedin_url ?? '',
    'Cultural Affinity': ct.cultural_affinity ?? '',
    'Source': ct.source ?? '',
  }));

  // 5. Create workbook with two sheets
  const wb = XLSX.utils.book_new();
  const wsCompanies = XLSX.utils.json_to_sheet(companyRows);
  const wsContacts = XLSX.utils.json_to_sheet(contactRows.length ? contactRows : [{}]);
  XLSX.utils.book_append_sheet(wb, wsCompanies, 'Companies');
  XLSX.utils.book_append_sheet(wb, wsContacts, 'Contacts');

  // 6. Trigger download
  const filename = `${metroName.replace(/[^a-zA-Z0-9-_ ]/g, '')}-report.xlsx`;
  XLSX.writeFile(wb, filename);
}
