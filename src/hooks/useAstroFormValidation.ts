import { UseFormSetError } from 'react-hook-form';
import { ReportFormData } from '@/types/public-report';
import { toast } from 'sonner';

export const useAstroFormValidation = () => {
  const validatePrimaryPerson = (
    data: ReportFormData,
    setError: UseFormSetError<ReportFormData>
  ): boolean => {
    if (!data.name?.trim()) {
      setError('name', { type: 'manual', message: 'Name is required' });
      return false;
    }
    if (!data.birthDate) {
      setError('birthDate', { type: 'manual', message: 'Date of birth is required' });
      return false;
    }
    if (!data.birthTime) {
      setError('birthTime', { type: 'manual', message: 'Time of birth is required' });
      return false;
    }
    if (!data.birthLocation?.trim()) {
      setError('birthLocation', { type: 'manual', message: 'Location is required' });
      return false;
    }
    if (data.birthLatitude === undefined || data.birthLongitude === undefined) {
      setError('birthLocation', {
        type: 'manual',
        message: 'Please select a suggestion to confirm coordinates',
      });
      toast.error('Please select a location from suggestions to add latitude and longitude.');
      return false;
    }
    return true;
  };

  const validateSecondPerson = (
    data: ReportFormData,
    setError: UseFormSetError<ReportFormData>
  ): boolean => {
    if (!data.secondPersonName?.trim()) {
      setError('secondPersonName', { type: 'manual', message: 'Second person name is required' });
      return false;
    }
    if (!data.secondPersonBirthDate) {
      setError('secondPersonBirthDate', {
        type: 'manual',
        message: 'Date of birth is required',
      });
      return false;
    }
    if (!data.secondPersonBirthTime) {
      setError('secondPersonBirthTime', {
        type: 'manual',
        message: 'Time of birth is required',
      });
      return false;
    }
    if (!data.secondPersonBirthLocation?.trim()) {
      setError('secondPersonBirthLocation', {
        type: 'manual',
        message: 'Location is required',
      });
      return false;
    }
    if (data.secondPersonLatitude === undefined || data.secondPersonLongitude === undefined) {
      setError('secondPersonBirthLocation', {
        type: 'manual',
        message: 'Please select a suggestion to confirm coordinates',
      });
      toast.error('Please select a location for the second person to add latitude and longitude.');
      return false;
    }
    return true;
  };

  return { validatePrimaryPerson, validateSecondPerson };
};
