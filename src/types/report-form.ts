

export interface PlaceData {
  name: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

export interface ReportFormData {
  reportType: string | null;
  relationshipType?: string;
  essenceType?: string;
  // Mobile-specific fields
  reportCategory?: string;
  reportSubCategory?: string;
  // astroDataType replaced with request field
  request?: string;
  name: string;
  email: string;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  birthLatitude?: number;
  birthLongitude?: number;
  birthPlaceId?: string;
  secondPersonName?: string;
  secondPersonBirthDate?: string;
  secondPersonBirthTime?: string;
  secondPersonBirthLocation?: string;
  secondPersonLatitude?: number;
  secondPersonLongitude?: number;
  secondPersonPlaceId?: string;
  // Astrology-specific fields
  timezone?: string;
  houseSystem?: string;
  secondPersonTimezone?: string;
  secondPersonHouseSystem?: string;
  returnYear?: string;
  notes?: string;
  promoCode?: string;
  is_guest?: boolean;
  // Chat-related fields
  chat_id?: string;
  guest_report_id?: string;
  // Profile linking
  profile_id?: string;
}

export interface ReportTypeOption {
  value: string;
  label: string;
}

export interface FormStepProps {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
  className?: string;
  'data-step'?: string;
}
