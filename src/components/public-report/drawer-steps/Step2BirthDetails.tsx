import React from 'react';
import {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldErrors,
} from 'react-hook-form';
import { motion } from 'framer-motion';

import { ReportFormData } from '@/types/public-report';
import PersonCard from './PersonCard';


interface Step2BirthDetailsProps {
  register: UseFormRegister<ReportFormData>;
  setValue: UseFormSetValue<ReportFormData>;
  watch: UseFormWatch<ReportFormData>;
  errors: FieldErrors<ReportFormData>;
}

const Step2BirthDetails: React.FC<Step2BirthDetailsProps> = React.memo(({
  register,
  setValue,
  watch,
  errors,
}) => {
  const reportCategory = watch('reportCategory');
  const request = watch('request');
  const isCompatibilityReport = reportCategory === 'compatibility' || request === 'sync';

  return (
    <div className="bg-white">
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.3 }}
        className="space-y-12"
      >
        {/* Header */}
        <div className="flex items-center justify-center px-6 py-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 mb-4 tracking-tight">
              Your <em className="italic font-light">Info</em>
            </h1>
            <p className="text-lg text-gray-500 font-light leading-relaxed max-w-md mx-auto">
              {isCompatibilityReport
                ? "We need both people's details for your compatibility report"
                : 'We need these to create your personalised report'}
            </p>
          </div>
        </div>

        {/* Person‑1 */}
        <div className="px-6">
          <PersonCard
            personNumber={1}
            title={isCompatibilityReport ? 'Your Details' : 'Your Details'}
            register={register}
            setValue={setValue}
            watch={watch}
            errors={errors}
            hasTriedToSubmit={false}
          />
        </div>

        {/* Person‑2 */}
        {isCompatibilityReport && (
          <div className="px-6">
            <PersonCard
              personNumber={2}
              title="Partner's Details"
              register={register}
              setValue={setValue}
              watch={watch}
              errors={errors}
              hasTriedToSubmit={false}
            />
          </div>
        )}

      </motion.div>
    </div>
  );
});

Step2BirthDetails.displayName = 'Step2BirthDetails';

export default Step2BirthDetails;