
import * as z from 'zod';

export const reportSchema = z.object({
  reportType: z.string().optional(),
  relationshipType: z.string().optional(),
  essenceType: z.string().optional(),
  // Mobile-specific fields that help populate the above
  reportCategory: z.string().optional(),
  reportSubCategory: z.string().optional(),
  // astroDataType replaced with request field
  // Astro data request field
  request: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  birthDate: z.string().min(1, 'Birth date is required'),
  birthTime: z.string().min(1, 'Birth time is required'),
  birthLocation: z.string().min(1, 'Birth location is required'),
  birthLatitude: z.number().optional(),
  birthLongitude: z.number().optional(),
  birthPlaceId: z.string().optional(),
  secondPersonName: z.string().optional(),
  secondPersonBirthDate: z.string().optional(),
  secondPersonBirthTime: z.string().optional(),
  secondPersonBirthLocation: z.string().optional(),
  secondPersonLatitude: z.number().optional(),
  secondPersonLongitude: z.number().optional(),
  secondPersonPlaceId: z.string().optional(),
  returnYear: z.string().optional(),
  notes: z.string().optional(),
  promoCode: z.string().optional(),
  // Chat-related fields
  chat_id: z.string().optional(),
// Removed all tight validation - let backend handle validation
});

export type ReportFormData = z.infer<typeof reportSchema>;
