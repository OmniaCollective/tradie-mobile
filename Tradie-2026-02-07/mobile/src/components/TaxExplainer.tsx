/**
 * "How this is worked out": the rules and official sources behind the tax
 * estimate, so the figures can be trusted and checked.
 */
import React from 'react';
import { View, Text, Pressable, Linking, ScrollView } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { useRegion } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { Sheet, RowDivider } from '@/components/ui';

const CONTENT = {
  GB: {
    title: 'How your tax is worked out',
    points: [
      'Tax year 6 April 2026 to 5 April 2027.',
      'Profit = invoices paid this tax year minus the expenses you’ve logged.',
      'Income Tax: 20% up to £37,700 above your Personal Allowance, 40% up to £125,140, 45% above. The £12,570 allowance shrinks by £1 for every £2 of income over £100,000.',
      'Class 4 National Insurance: 6% on profits between £12,570 and £50,270, 2% above.',
      'CIS already deducted by contractors is taken off what you owe.',
      'Set aside each month = what’s left to put away, spread over the months left in the tax year.',
    ],
    sources: [
      ['Income Tax rates and allowances (GOV.UK)', 'https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past'],
      ['National Insurance rates (GOV.UK)', 'https://www.gov.uk/government/publications/rates-and-allowances-national-insurance-contributions/rates-and-allowances-national-insurance-contributions'],
    ],
  },
  US: {
    title: 'How your tax is worked out',
    points: [
      'Tax year 2026 (January to December).',
      'Profit = invoices paid this year minus the expenses you’ve logged.',
      'Self-employment tax: 15.3% on 92.35% of your profit — 12.4% Social Security (up to $184,500 including wages) and 2.9% Medicare, plus 0.9% above $200,000 ($250,000 married filing jointly).',
      'Federal income tax: 2026 brackets for your filing status, after the standard deduction, half of your self-employment tax and the 20% qualified business income deduction.',
      'Estimated tax is due 15 April, 15 June and 15 September 2026, and 15 January 2027. Tradie splits what’s left across the payments still to come.',
      'State and local income tax are not included — check your state’s rules.',
    ],
    sources: [
      ['2026 brackets and deductions (IRS Rev. Proc. 2025-32)', 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf'],
      ['Self-employment tax (IRS)', 'https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes'],
      ['Estimated tax (IRS Form 1040-ES)', 'https://www.irs.gov/pub/irs-pdf/f1040es.pdf'],
    ],
  },
} as const;

export function TaxExplainer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const region = useRegion();
  const t = useTheme();
  const c = CONTENT[region.country];
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text className="text-fg text-[17px] font-semibold text-center mb-3">{c.title}</Text>
      <ScrollView style={{ maxHeight: 460 }}>
        <View className="bg-bg rounded-2xl p-4 gap-2.5">
          {c.points.map((p) => (
            <Text key={p} className="text-fg text-[15px] leading-[22px]">
              {p}
            </Text>
          ))}
        </View>
        <Text className="text-secondary text-[13px] mx-1 mt-4 mb-2">Official sources</Text>
        <View className="bg-bg rounded-2xl overflow-hidden">
          {c.sources.map(([label, url], i) => (
            <View key={url}>
              {i > 0 && <RowDivider />}
              <Pressable onPress={() => Linking.openURL(url)} className="flex-row items-center px-4 min-h-[48px] active:opacity-70" accessibilityRole="link">
                <Text className="flex-1 text-link text-[15px]">{label}</Text>
                <ExternalLink size={16} color={t.link} strokeWidth={2} />
              </Pressable>
            </View>
          ))}
        </View>
        <Text className="text-secondary text-[13px] leading-5 mx-1 mt-4">
          This is an estimate to help you plan, not tax advice. Your actual bill depends on things Tradie doesn’t know about — speak to an accountant if you’re unsure.
        </Text>
      </ScrollView>
    </Sheet>
  );
}
