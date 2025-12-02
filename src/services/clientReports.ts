
import { supabase } from "@/integrations/supabase/client";

export interface ClientReportFormData {
  reportType: string;
  relationshipType?: string;
  essenceType?: string;
  notes?: string;
  // For compatibility/sync reports
  secondPersonName?: string;
  secondPersonBirthDate?: string;
  secondPersonBirthTime?: string;
  secondPersonBirthLocation?: string;
  // For return reports
  returnYear?: string;
}

export interface ClientReportRequest {
  reportType: string;
  relationshipType?: string;
  essenceType?: string;
  name: string;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  name2?: string;
  birthDate2?: string;
  birthTime2?: string;
  birthLocation2?: string;
  returnDate?: string;
  notes?: string;
  client_id: string;
}

export interface ClientReportResponse {
  success: boolean;
  reportType: string;
  data: unknown;
  generatedAt: string;
}

export const clientReportsService = {
  async generateClientReport(
    client: { id: string; full_name: string; birth_date?: string; birth_time?: string; birth_location?: string },
    formData: ClientReportFormData
  ): Promise<ClientReportResponse> {
    // Validate client has required birth data
    if (!client.birth_date || !client.birth_time || !client.birth_location) {
      throw new Error('Client must have complete birth information (date, time, and location) to generate reports');
    }

    // Build the request payload
    const requestData: ClientReportRequest = {
      reportType: formData.reportType,
      relationshipType: formData.relationshipType,
      essenceType: formData.essenceType,
      name: client.full_name,
      birthDate: client.birth_date,
      birthTime: client.birth_time,
      birthLocation: client.birth_location,
      notes: formData.notes,
      client_id: client.id,
    };

    // Add second person data for two-person reports
    if (['compatibility', 'sync'].includes(formData.reportType)) {
      if (!formData.secondPersonName || !formData.secondPersonBirthDate || 
          !formData.secondPersonBirthTime || !formData.secondPersonBirthLocation) {
        throw new Error('Second person information is required for this report type');
      }
      
      requestData.name2 = formData.secondPersonName;
      requestData.birthDate2 = formData.secondPersonBirthDate;
      requestData.birthTime2 = formData.secondPersonBirthTime;
      requestData.birthLocation2 = formData.secondPersonBirthLocation;
    }

    // Add return date for return reports
    if (formData.reportType === 'return' && formData.returnYear) {
      requestData.returnDate = `${formData.returnYear}-01-01`;
    }

    // Call the create-report edge function
    const { data, error } = await supabase.functions.invoke('create-report', {
      body: requestData,
    });

    if (error) {
      console.error('Error generating client report:', error);
      throw new Error(error.message || 'Failed to generate report');
    }

    return data as ClientReportResponse;
  },

  async getClientReports(clientId: string) {
    // translator_logs uses chat_id, not client_id
    const { data, error } = await supabase
      .from('translator_logs')
      .select('*')
      .eq('chat_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching client reports:', error);
      throw error;
    }

    return data || [];
  },

  async archiveClientReport(reportId: string): Promise<void> {
    const { error } = await supabase
      .from('translator_logs')
      .update({ is_archived: true })
      .eq('id', reportId);

    if (error) {
      console.error('Error archiving client report:', error);
      throw new Error('Failed to archive report');
    }
  }
};
