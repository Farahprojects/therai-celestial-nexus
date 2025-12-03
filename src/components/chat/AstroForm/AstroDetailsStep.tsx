import React from 'react';
import { motion } from 'framer-motion';
import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import { CleanPlaceAutocomplete } from '@/components/shared/forms/place-input/CleanPlaceAutocomplete';
import { PlaceData } from '@/components/shared/forms/place-input/utils/extractPlaceData';
import { ProfileSelector } from '@/components/shared/forms/ProfileSelector';
import InlineDateTimeSelector from '@/components/ui/mobile-pickers/InlineDateTimeSelector';
import { SimpleDateTimePicker } from '@/components/ui/SimpleDateTimePicker';
import { ReportFormData } from '@/types/report-form';

interface AstroDetailsStepProps {
  register: UseFormRegister<ReportFormData>;
  errors: FieldErrors<ReportFormData>;
  setValue: UseFormSetValue<ReportFormData>;
  watch: UseFormWatch<ReportFormData>;
  isMobile: boolean;
  activeSelector: string | null;
  setActiveSelector: (selector: string | null) => void;
  onBack: () => void;
  onNext: () => void;
  isProcessing: boolean;
  isInsights: boolean;
  shouldDisableAnimations: boolean;
  saveToProfile: boolean;
  setSaveToProfile: (value: boolean) => void;
  isProfileFlow?: boolean;
  nameFieldAddon?: React.ReactNode; // Custom element to show next to name field
}

const ErrorMsg = ({ msg }: { msg: string }) => (
  <div className="text-sm text-red-500 mt-1 flex items-center gap-2">
    <AlertCircle className="w-4 h-4" />
    <span>{msg}</span>
  </div>
);

export const AstroDetailsStep: React.FC<AstroDetailsStepProps> = ({
  register,
  errors,
  setValue,
  watch,
  isMobile,
  activeSelector,
  setActiveSelector,
  onBack,
  onNext,
  isProcessing,
  isInsights,
  shouldDisableAnimations,
  saveToProfile,
  setSaveToProfile,
  isProfileFlow = false,
  nameFieldAddon,
}) => {
  const formValues = watch();

  const handlePlaceSelect = (place: PlaceData) => {
    setValue('birthLocation', place.name);
    if (place.latitude) setValue('birthLatitude', place.latitude);
    if (place.longitude) setValue('birthLongitude', place.longitude);
    if (place.placeId) setValue('birthPlaceId', place.placeId);
  };

  return (
    <motion.form
      key="details"
      initial={shouldDisableAnimations ? undefined : { opacity: 0, x: 20 }}
      animate={shouldDisableAnimations ? undefined : { opacity: 1, x: 0 }}
      exit={shouldDisableAnimations ? undefined : { opacity: 0, x: -20 }}
      transition={shouldDisableAnimations ? { duration: 0 } : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      className="space-y-6"
    >
      <div className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="w-64">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Name *
            </Label>
            <Input
              id="name"
              {...register('name', { required: 'Name is required' })}
              placeholder="Enter your name"
              className="h-12 rounded-full border-gray-200 focus:border-gray-400 mt-1"
            />
            {errors.name && <ErrorMsg msg={errors.name.message || ''} />}
          </div>

          {nameFieldAddon && (
            <div className="flex-shrink-0">
              {nameFieldAddon}
            </div>
          )}

          {!isProfileFlow && !nameFieldAddon && (
            <div className="flex-shrink-0">
              <Label className="text-sm font-medium text-gray-700">Load Profile</Label>
              <ProfileSelector
                onProfileSelect={(profile) => {
                  setValue('name', profile.name);
                  setValue('birthDate', profile.birth_date);
                  setValue('birthTime', profile.birth_time);
                  setValue('birthLocation', profile.birth_location);
                  if (profile.birth_latitude) setValue('birthLatitude', profile.birth_latitude);
                  if (profile.birth_longitude) setValue('birthLongitude', profile.birth_longitude);
                  if (profile.birth_place_id) setValue('birthPlaceId', profile.birth_place_id);
                }}
                currentValue={formValues.name}
              />
            </div>
          )}
        </div>

        {!isProfileFlow && (
          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="save-profile"
              checked={saveToProfile}
              onCheckedChange={(checked) => setSaveToProfile(checked as boolean)}
            />
            <label
              htmlFor="save-profile"
              className="text-sm font-light text-gray-700 cursor-pointer select-none"
            >
              Save this profile for future use
            </label>
          </div>
        )}

        <div>
          {isMobile ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Birth Date *
                </label>
                <InlineDateTimeSelector
                  type="date"
                  value={formValues.birthDate || ''}
                  onChange={(date) => setValue('birthDate', date)}
                  onConfirm={() => setActiveSelector(null)}
                  onCancel={() => setActiveSelector(null)}
                  isOpen={activeSelector === 'date'}
                  placeholder="Select date"
                  hasError={!!errors.birthDate}
                  onOpen={() => setActiveSelector('date')}
                />
                {errors.birthDate && <ErrorMsg msg={errors.birthDate.message || ''} />}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Birth Time *
                </label>
                <InlineDateTimeSelector
                  type="time"
                  value={formValues.birthTime || ''}
                  onChange={(time) => setValue('birthTime', time)}
                  onConfirm={() => setActiveSelector(null)}
                  onCancel={() => setActiveSelector(null)}
                  isOpen={activeSelector === 'time'}
                  placeholder="Select time"
                  hasError={!!errors.birthTime}
                  onOpen={() => setActiveSelector('time')}
                />
                {errors.birthTime && <ErrorMsg msg={errors.birthTime.message || ''} />}
              </div>
            </div>
          ) : (
            <div>
              <SimpleDateTimePicker
                dateValue={formValues.birthDate || ''}
                timeValue={formValues.birthTime || ''}
                onDateChange={(date) => setValue('birthDate', date)}
                onTimeChange={(time) => setValue('birthTime', time)}
                hasDateError={!!errors.birthDate}
                hasTimeError={!!errors.birthTime}
              />
              <div className="grid grid-cols-2 gap-4 mt-1">
                <div>{errors.birthDate && <ErrorMsg msg={errors.birthDate.message || ''} />}</div>
                <div>{errors.birthTime && <ErrorMsg msg={errors.birthTime.message || ''} />}</div>
              </div>
            </div>
          )}
        </div>

        <div>
          <CleanPlaceAutocomplete
            value={formValues.birthLocation || ''}
            onChange={(val) => setValue('birthLocation', val)}
            onPlaceSelect={handlePlaceSelect}
            placeholder="Enter birth city, state, country"
            className="h-12 rounded-full border-gray-200 focus:border-gray-400 mt-1"
          />
          {errors.birthLocation && <ErrorMsg msg={errors.birthLocation.message || ''} />}
        </div>
      </div>

      <div className={`flex gap-3 ${isMobile ? 'bg-white pt-4 pb-safe' : 'pt-4'}`}>
        {!isInsights && !isProfileFlow && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 hover:bg-gray-100 hover:text-gray-700 border-gray-200 rounded-full"
          >
            Back
          </Button>
        )}
        <Button
          type="submit"
          disabled={isProcessing}
          className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-full"
        >
          {isProcessing ? 'Processing...' : 'Next'}
        </Button>
      </div>
    </motion.form>
  );
};
