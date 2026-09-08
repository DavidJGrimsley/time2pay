import { useCallback, useEffect, useState } from 'react';
import { getUserProfile, initializeDatabase, upsertUserProfile } from '@/database/db';
import {
  evaluateProfileCompletion,
  REQUIRED_PROFILE_FIELD_LABELS,
} from '@/services/profile-completion';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';
import type { NoticeTone } from '@/components/inline-notice';

export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function toNullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

type BusinessStatus = { message: string; tone: NoticeTone } | null;

export function useProfileBusinessSection(onProfileUpdated?: () => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [status, setStatus] = useState<BusinessStatus>(null);

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [businessEmail, setBusinessEmail] = useState('');

  const loadProfileData = useCallback(async (): Promise<void> => {
    const profile = await getUserProfile();
    setCompanyName(profile.company_name ?? '');
    setLogoUrl(profile.logo_url ?? '');
    setFullName(profile.full_name ?? '');
    setBusinessPhone(formatPhoneNumber(profile.phone ?? ''));
    setBusinessEmail(profile.email ?? '');
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(() => loadProfileData())
      .catch((error: unknown) => {
        setStatus({
          message: error instanceof Error ? error.message : 'Failed to load business settings.',
          tone: 'error',
        });
      })
      .finally(() => setIsLoading(false));
  }, [loadProfileData]);

  function handleBusinessPhoneChange(text: string): void {
    setBusinessPhone(formatPhoneNumber(text));
    setPhoneError(null);
  }

  function handleBusinessPhoneBlur(): void {
    const digits = businessPhone.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 10) {
      setPhoneError('Enter a complete 10-digit phone number (e.g. 555-867-5309).');
    }
  }

  async function handleSaveBusiness(): Promise<void> {
    setStatus(null);
    const trimmedFullName = fullName.trim();
    const trimmedBusinessPhone = businessPhone.trim();
    const phoneDigits = trimmedBusinessPhone.replace(/\D/g, '');
    if (phoneDigits.length > 0 && phoneDigits.length < 10) {
      const msg = 'Enter a complete 10-digit phone number.';
      setPhoneError(msg);
      showValidationAlert(msg);
      return;
    }

    const trimmedBusinessEmail = businessEmail.trim();
    const completion = evaluateProfileCompletion({
      full_name: trimmedFullName,
      phone: trimmedBusinessPhone,
      email: trimmedBusinessEmail,
    });

    if (!completion.isComplete) {
      const missing = completion.missingFields
        .map((field) => REQUIRED_PROFILE_FIELD_LABELS[field])
        .join(', ');
      const message = `Missing required business profile fields: ${missing}.`;
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    setIsSavingBusiness(true);
    try {
      await upsertUserProfile({
        company_name: toNullableTrimmed(companyName),
        logo_url: toNullableTrimmed(logoUrl),
        full_name: trimmedFullName,
        phone: trimmedBusinessPhone,
        email: trimmedBusinessEmail,
      });
      await loadProfileData();
      setStatus({ message: 'Business settings saved.', tone: 'success' });
      onProfileUpdated?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save business settings.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSavingBusiness(false);
    }
  }

  return {
    isLoading,
    isSavingBusiness,
    status,
    companyName,
    setCompanyName,
    logoUrl,
    setLogoUrl,
    fullName,
    setFullName,
    businessPhone,
    phoneError,
    businessEmail,
    setBusinessEmail,
    handleBusinessPhoneChange,
    handleBusinessPhoneBlur,
    handleSaveBusiness: () => {
      handleSaveBusiness().catch(() => undefined);
    },
  };
}
