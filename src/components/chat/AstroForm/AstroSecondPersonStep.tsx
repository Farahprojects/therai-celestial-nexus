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

interface AstroSecondPersonStepProps {
  register: UseFormRegister<ReportFormData>;
  errors: FieldErrors<ReportFormData>;
  setValue: UseFormSetValue<ReportFormData>;
  watch: UseFormWatch<ReportFormData>;
  isMobile: boolean;
  activeSelector: string | null;
  setActiveSelector: (selector: string | null) => void;
  onBack: () => void;
  onSubmit: () => void;
  isProcessing: boolean;
  shouldDisableAnimations: boolean;
  saveSecondPersonToProfile: boolean;
  setSaveSecondPersonToProfile: (value: boolean) => void;
}

const ErrorMsg = ({ msg }: { msg: string }) => (
  <div className="text-sm text-red-500 mt-1 flex items-center gap-2">
    <AlertCircle className="w-4 h-4" />
    <span>{msg}</span>
  </div>
);

export const AstroSecondPersonStep: React.FC<AstroSecondPersonStepProps> = ({
  register,
  errors,
  setValue,
  watch,
  isMobile,
  activeSelector,
  setActiveSelector,
  onBack,
  onSubmit,
  isProcessing,
  shouldDisableAnimations,
  saveSecondPersonToProfile,
  setSaveSecondPersonToProfile,
}) => {
  const formValues = watch();

  const handlePlaceSelect = (place: PlaceData) => {
    setValue('secondPersonBirthLocation', place.name);
    if (place.latitude) setValue('secondPersonLatitude', place.latitude);
    if (place.longitude) setValue('secondPersonLongitude', place.longitude);
    if (place.placeId) setValue('secondPersonPlaceId', place.placeId);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <motion.form
      key="secondPerson"
      initial={shouldDisableAnimations ? undefined : { opacity: 0, x: 20 }}
      animate={shouldDisableAnimations ? undefined : { opacity: 1, x: 0 }}
      exit={shouldDisableAnimations ? undefined : { opacity: 0, x: -20 }}
      transition={shouldDisableAnimations ? { duration: 0 } : undefined}
      onSubmit={handleFormSubmit}
      className="space-y-6"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="secondPersonName" className="text-sm font-medium text-gray-700">
              Second Person's Name *
            </Label>
            <Input
              id="secondPersonName"
              {...register('secondPersonName', { required: 'Second person name is required' })}
              placeholder="Enter second person's name"
              className="h-12 rounded-full border-gray-200 focus:border-gray-400 mt-1"
            />
            {errors.secondPersonName && <ErrorMsg msg={errors.secondPersonName.message || ''} />}
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700">Load Profile</Label>
            <ProfileSelector
              onProfileSelect={(profile) => {
                setValue('secondPersonName', profile.name);
                setValue('secondPersonBirthDate', profile.birth_date);
                setValue('secondPersonBirthTime', profile.birth_time);
                setValue('secondPersonBirthLocation', profile.birth_location);
                if (profile.birth_latitude) setValue('secondPersonLatitude', profile.birth_latitude);
                if (profile.birth_longitude) setValue('secondPersonLongitude', profile.birth_longitude);
                if (profile.birth_place_id) setValue('secondPersonPlaceId', profile.birth_place_id);
              }}
              currentValue={formValues.secondPersonName}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="save-second-person-profile"
            checked={saveSecondPersonToProfile}
            onCheckedChange={(checked) => setSaveSecondPersonToProfile(checked as boolean)}
          />
          <label
            htmlFor="save-second-person-profile"
            className="text-sm font-light text-gray-700 cursor-pointer select-none"
          >
            Save this profile for future use
          </label>
        </div>

        <div>
          {isMobile ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Birth Date *
                </label>
                <InlineDateTimeSelector
                  type="date"
                  value={formValues.secondPersonBirthDate || ''}
                  onChange={(date) => setValue('secondPersonBirthDate', date)}
                  onConfirm={() => setActiveSelector(null)}
                  onCancel={() => setActiveSelector(null)}
                  isOpen={activeSelector === 'secondDate'}
                  placeholder="Select date"
                  hasError={!!errors.secondPersonBirthDate}
                  onOpen={() => setActiveSelector('secondDate')}
                />
                {errors.secondPersonBirthDate && (
                  <ErrorMsg msg={errors.secondPersonBirthDate.message || ''} />
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Birth Time *
                </label>
                <InlineDateTimeSelector
                  type="time"
                  value={formValues.secondPersonBirthTime || ''}
                  onChange={(time) => setValue('secondPersonBirthTime', time)}
                  onConfirm={() => setActiveSelector(null)}
                  onCancel={() => setActiveSelector(null)}
                  isOpen={activeSelector === 'secondTime'}
                  placeholder="Select time"
                  hasError={!!errors.secondPersonBirthTime}
                  onOpen={() => setActiveSelector('secondTime')}
                />
                {errors.secondPersonBirthTime && (
                  <ErrorMsg msg={errors.secondPersonBirthTime.message || ''} />
                )}
              </div>
            </div>
          ) : (
            <div>
              <SimpleDateTimePicker
                dateValue={formValues.secondPersonBirthDate || ''}
                timeValue={formValues.secondPersonBirthTime || ''}
                onDateChange={(date) => setValue('secondPersonBirthDate', date)}
                onTimeChange={(time) => setValue('secondPersonBirthTime', time)}
                hasDateError={!!errors.secondPersonBirthDate}
                hasTimeError={!!errors.secondPersonBirthTime}
              />
              {(errors.secondPersonBirthDate || errors.secondPersonBirthTime) && (
                <div className="mt-2 space-y-1">
                  {errors.secondPersonBirthDate && (
                    <ErrorMsg msg={errors.secondPersonBirthDate.message || ''} />
                  )}
                  {errors.secondPersonBirthTime && (
                    <ErrorMsg msg={errors.secondPersonBirthTime.message || ''} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <CleanPlaceAutocomplete
            value={formValues.secondPersonBirthLocation || ''}
            onChange={(val) => setValue('secondPersonBirthLocation', val)}
            onPlaceSelect={handlePlaceSelect}
            placeholder="Enter birth city, state, country"
            className="h-12 rounded-full border-gray-200 focus:border-gray-400 mt-1"
          />
          {errors.secondPersonBirthLocation && (
            <ErrorMsg msg={errors.secondPersonBirthLocation.message || ''} />
          )}
        </div>
      </div>

      <div className={`flex gap-3 ${isMobile ? 'bg-white pt-4 pb-safe' : 'pt-4'}`}>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 hover:bg-gray-100 hover:text-gray-700 border-gray-200 rounded-full"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={isProcessing}
          className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-full"
        >
          {isProcessing ? 'Creating...' : 'Create Astro Data'}
        </Button>
      </div>
    </motion.form>
  );
};
