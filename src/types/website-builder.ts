
export interface Service {
  title: string;
  description: string;
  price: string;
  imageUrl?: string;
  imageData?: ImageData;
}

export interface ReportService {
  title: string;
  description: string;
  price: string;
  sectionHeading?: string;
}

export interface ImageData {
  url: string;
  filePath: string;
}

export interface CustomizationData {
  coachName?: string;
  profileImage?: string;
  profileImageData?: ImageData;
  tagline?: string;
  bio?: string;
  introTitle?: string;
  introAlignment?: 'left' | 'center' | 'right';
  introFontStyle?: string;
  introTextColor?: string;
  heroFontStyle?: string;
  heroTextColor?: string;
  heroAlignment?: 'left' | 'center' | 'right';
  services?: Service[];
  reportService?: ReportService;
  buttonText?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonFontFamily?: string;
  buttonStyle?: 'bordered' | 'borderless';
  themeColor?: string;
  fontFamily?: string;
  backgroundStyle?: string;
  headerImageUrl?: string;
  headerImageData?: ImageData;
  headerImageOpacity?: number;
  aboutImageUrl?: string;
  aboutImageData?: ImageData;
  footerHeading?: string;
  footerSubheading?: string;
}

export interface CoachWebsite {
  id: string;
  coach_id: string;
  template_id: string;
  site_slug: string;
  customization_data: CustomizationData;
  draft_customization_data: CustomizationData;
  has_unpublished_changes: boolean;
  is_published: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
}
