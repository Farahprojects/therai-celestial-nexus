
import { useState, useEffect, useCallback } from 'react';

interface FormData {
  [key: string]: unknown;
}

export const useFormPersistence = <T extends FormData>(
  formKey: string,
  defaultValues: T
) => {
  const [formData, setFormData] = useState<T>(defaultValues);
  const storageKey = `formData_${formKey}`;

  // Load saved form data on mount
  useEffect(() => {
    const savedData = sessionStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setFormData(prevData => ({ ...prevData, ...parsedData }));
      } catch (error) {
        console.error('Failed to restore form data:', error);
      }
    }
  }, [storageKey]);

  // Save form data whenever it changes
  const updateFormData = useCallback((newData: Partial<T>) => {
    setFormData(prevData => {
      const updatedData = { ...prevData, ...newData };
      sessionStorage.setItem(storageKey, JSON.stringify(updatedData));
      return updatedData;
    });
  }, [storageKey]);

  // Clear saved form data
  const clearFormData = useCallback(() => {
    setFormData(defaultValues);
    sessionStorage.removeItem(storageKey);
  }, [defaultValues, storageKey]);

  // Auto-save function for use in form inputs
  const autoSave = useCallback((field: keyof T, value: string | number | boolean | null | undefined) => {
    updateFormData({ [field]: value } as Partial<T>);
  }, [updateFormData]);

  return {
    formData,
    updateFormData,
    clearFormData,
    autoSave
  };
};
