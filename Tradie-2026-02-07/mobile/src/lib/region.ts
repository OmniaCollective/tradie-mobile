/**
 * Country the tradie works in. Decides currency, date style, tax rules and wording.
 * Defaults to the phone's region; can be changed in Account.
 */
import { getLocales } from 'expo-localization';

export type Country = 'GB' | 'US';

/** For the UK / US switch in onboarding and Account. */
export const COUNTRY_OPTIONS: { key: Country; label: string }[] = [
  { key: 'GB', label: 'UK' },
  { key: 'US', label: 'US' },
];

export interface RegionInfo {
  country: Country;
  /** BCP 47 locale for dates, e.g. "en-GB". */
  locale: string;
  currencySymbol: string;
  /** "postcode" / "ZIP code" */
  postcodeLabel: string;
  /** "HMRC" / "the IRS" */
  taxAuthority: string;
}

const REGIONS: Record<Country, RegionInfo> = {
  GB: { country: 'GB', locale: 'en-GB', currencySymbol: '£', postcodeLabel: 'postcode', taxAuthority: 'HMRC' },
  US: { country: 'US', locale: 'en-US', currencySymbol: '$', postcodeLabel: 'ZIP code', taxAuthority: 'the IRS' },
};

/** The phone's region, if it's one Tradie supports; otherwise the UK. */
export function detectCountry(): Country {
  try {
    return getLocales()[0]?.regionCode === 'US' ? 'US' : 'GB';
  } catch {
    return 'GB';
  }
}

export function regionFor(country: Country | undefined): RegionInfo {
  return REGIONS[country ?? detectCountry()];
}
