/**
 * Edit a price: the lines of a job's quote, or of an unpaid invoice. One screen for both,
 * opened as /price?kind=quote&id=<jobId> or /price?kind=invoice&id=<invoiceId>
 * (add=parts opens straight to adding the job's parts). Nothing is saved until Save.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { v4 as generateId } from 'uuid';
import * as Haptics from 'expo-haptics';
import { Plus, ChevronUp, ChevronDown, Trash2, ListPlus, Package, Percent, PenLine, Search, Lock } from 'lucide-react-native';
import { useTradeStore, useSettings, useRegion, getRegion, pricingRules, type SavedItem, type Part } from '@/lib/store';
import {
  priceLines,
  lineAmount,
  withMarkup,
  roundPence,
  lineKindLabels,
  LINE_UNITS,
  type LineItem,
  type LineKind,
} from '@/lib/pricing';
import { formatAmount, formatMoney, currencySymbol } from '@/lib/money';
import { useProAccess } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { track } from '@/lib/analytics';
import {
  Group,
  RowDivider,
  SectionHeader,
  PrimaryButton,
  Segmented,
  Sheet,
  ModalHeader,
  ScrollScreen,
  LabeledField,
  ToggleRow,
  LinkRow,
} from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { UpgradePrompt, type LimitedFeature } from '@/components/UpgradePrompt';
import { toast } from '@/components/Toast';

type Kind = 'quote' | 'invoice';
type ItemKind = Exclude<LineKind, 'discount'>;

/** A line being typed: numbers kept as text so "1." and "0." can be entered. */
interface LineDraft {
  /** Unset = a new line. */
  id?: string;
  kind: ItemKind;
  description: string;
  quantity: string;
  unit?: string;
  unitPrice: string;
  vatRate?: number;
  unitCost?: number;
  partId?: string;
  markup: string;
  saveToList: boolean;
}

interface DiscountDraft {
  id?: string;
  mode: 'amount' | 'percent';
  value: string;
  description: string;
}

const num = (text: string) => {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const numText = (n: number) => (n ? String(n) : '');
const cleanNumber = (text: string) => {
  const clean = text.replace(',', '.');
  return clean === '' || /^\d*\.?\d*$/.test(clean) ? clean : null;
};
const unitLabel = (unit?: string) => (unit ? ` ${unit}` : '');

const VAT_RATES = [20, 5, 0];

export default function PriceScreen() {
  const { kind, id, add } = useLocalSearchParams<{ kind: Kind; id: string; add?: string }>();
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const t = useTheme();
  const settings = useSettings();
  const country = useRegion().country;
  const { isPro, isLoading: proLoading } = useProAccess();
  const invoice = useTradeStore((s) => (kind === 'invoice' ? s.invoices.find((i) => i.id === id) : undefined));
  const job = useTradeStore((s) => s.jobs.find((j) => j.id === (kind === 'invoice' ? invoice?.jobId : id)));
  const priceList = useTradeStore((s) => s.priceList);
  const setQuoteLines = useTradeStore((s) => s.setQuoteLines);
  const setInvoiceLines = useTradeStore((s) => s.setInvoiceLines);
  const updateJob = useTradeStore((s) => s.updateJob);
  const addPriceItem = useTradeStore((s) => s.addPriceItem);
  const touchPriceItem = useTradeStore((s) => s.touchPriceItem);

  const quote = kind === 'invoice' ? invoice?.quote : job?.quote;
  // What's on screen; saved only with Save.
  const [lines, setLines] = useState<LineItem[]>(() => quote?.lines ?? []);
  const [showItemPrices, setShowItemPrices] = useState(quote?.showItemPrices !== false);
  const [reverseCharge, setReverseCharge] = useState(!!quote?.reverseCharge);
  const [description, setDescription] = useState(job?.description ?? '');
  const [arranging, setArranging] = useState(false);
  const [editing, setEditing] = useState<LineDraft | null>(null);
  const [discount, setDiscount] = useState<DiscountDraft | null>(null);
  const [adding, setAdding] = useState(false);
  // Opened to add parts: Pro sees the parts, a free user the Pro prompt (once Pro is known).
  const [picking, setPicking] = useState<'list' | 'parts' | null>(add === 'parts' ? 'parts' : null);
  const [lockedTap, setLocked] = useState<LimitedFeature | null>(null);
  const locked: LimitedFeature | null = lockedTap ?? (picking === 'parts' && !isPro && !proLoading ? 'parts' : null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const rules = pricingRules(settings);
  const priced = useMemo(() => priceLines(rules, lines, { reverseCharge }), [rules, lines, reverseCharge]);
  const markupDefault = settings.materialsMarkupPercent ?? 0;

  if (!job || !quote) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-secondary text-base text-center mb-4">This price isn’t available any more.</Text>
        <PrimaryButton label="Close" onPress={goBack} />
      </View>
    );
  }

  const parts = job.parts ?? [];
  const partsNotOnPrice = parts.filter((p) => !lines.some((l) => l.partId === p.id));
  const dirty =
    JSON.stringify(lines) !== JSON.stringify(quote.lines) ||
    showItemPrices !== (quote.showItemPrices !== false) ||
    reverseCharge !== !!quote.reverseCharge ||
    description !== (job.description ?? '');
  const hasItems = lines.some((l) => l.kind !== 'discount');

  // ── Lines ──────────────────────────────────────────────────────────────────

  const openNew = (itemKind: ItemKind = 'labour') =>
    setEditing({ kind: itemKind, description: '', quantity: '1', unitPrice: '', markup: '', saveToList: false });

  const openLine = (line: LineItem) => {
    if (line.kind === 'discount') {
      setDiscount({
        id: line.id,
        mode: line.percent ? 'percent' : 'amount',
        value: numText(line.percent ?? line.unitPrice),
        description: line.description,
      });
      return;
    }
    const markup =
      line.unitCost && line.unitCost > 0 ? String(Math.round((line.unitPrice / line.unitCost - 1) * 1000) / 10) : '';
    setEditing({
      id: line.id,
      kind: line.kind,
      description: line.description,
      quantity: numText(line.quantity),
      unit: line.unit,
      unitPrice: numText(line.unitPrice),
      vatRate: line.vatRate,
      unitCost: line.unitCost,
      partId: line.partId,
      markup,
      saveToList: false,
    });
  };

  const saveLine = () => {
    if (!editing) return;
    const quantity = num(editing.quantity) || 1;
    const unitPrice = roundPence(num(editing.unitPrice));
    const before = lines.find((l) => l.id === editing.id);
    const line: LineItem = {
      id: editing.id ?? generateId(),
      kind: editing.kind,
      description: editing.description.trim() || lineKindLabels(country)[editing.kind],
      quantity,
      unit: editing.unit,
      unitPrice,
      vatRate: editing.vatRate,
      unitCost: editing.unitCost,
      partId: editing.partId,
      // Edited by hand: the labour line stops following the job type, unless only its order changed.
      auto: before?.auto && before.unitPrice === unitPrice && before.description === editing.description.trim() ? true : undefined,
    };
    setLines(before ? lines.map((l) => (l.id === line.id ? line : l)) : [...lines, line]);
    if (editing.saveToList && !before) {
      addPriceItem({ kind: line.kind as ItemKind, description: line.description, unit: line.unit, unitPrice: line.unitPrice });
      toast('Saved to your price list');
      track('price_list_item_saved');
    }
    if (!before) track('line_item_added');
    setEditing(null);
  };

  const saveDiscount = () => {
    if (!discount) return;
    const value = num(discount.value);
    if (!(value > 0)) return;
    const line: LineItem = {
      id: discount.id ?? generateId(),
      kind: 'discount',
      description: discount.description.trim() || 'Discount',
      quantity: 1,
      unitPrice: discount.mode === 'amount' ? roundPence(value) : 0,
      percent: discount.mode === 'percent' ? Math.min(100, value) : undefined,
    };
    setLines(lines.some((l) => l.id === line.id) ? lines.map((l) => (l.id === line.id ? line : l)) : [...lines, line]);
    if (!discount.id) track('discount_added');
    setDiscount(null);
  };

  const remove = (lineId: string) => setLines(lines.filter((l) => l.id !== lineId));

  const move = (index: number, by: -1 | 1) => {
    const next = [...lines];
    const [line] = next.splice(index, 1);
    next.splice(index + by, 0, line);
    setLines(next);
  };

  const addSaved = (item: SavedItem) => {
    setLines([
      ...lines,
      { id: generateId(), kind: item.kind, description: item.description, quantity: 1, unit: item.unit, unitPrice: item.unitPrice },
    ]);
    touchPriceItem(item.id);
    track('price_list_item_used');
    setPicking(null);
  };

  const addParts = (chosen: Part[], markup: number) => {
    setLines([
      ...lines,
      ...chosen.map(
        (p): LineItem => ({
          id: generateId(),
          kind: 'materials',
          description: p.name,
          quantity: p.quantity,
          unitPrice: withMarkup(p.unitCost, markup),
          unitCost: p.unitCost,
          partId: p.id,
        }),
      ),
    ]);
    track('parts_added_to_price');
    setPicking(null);
  };

  const proOnly = (feature: LimitedFeature, run: () => void) => {
    if (isPro) run();
    else {
      track(feature === 'parts' ? 'pro_locked_tap_parts' : 'pro_locked_tap_price_list');
      setLocked(feature);
    }
  };

  const save = async () => {
    const options = { showItemPrices, reverseCharge };
    if (kind === 'invoice' && invoice) setInvoiceLines(invoice.id, lines, options);
    else setQuoteLines(job.id, lines, options);
    if (description.trim() !== (job.description ?? '')) updateJob(job.id, { description: description.trim() });
    toast(kind === 'invoice' ? 'Invoice updated' : 'Price updated');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goBack();
  };

  const close = () => (dirty ? setConfirmLeave(true) : goBack());

  // ── Screen ─────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-bg">
      <ScrollScreen
        header={
          <ModalHeader
            title={kind === 'invoice' ? 'Edit invoice' : 'Edit price'}
            onClose={close}
            left={
              lines.length > 1 ? (
                <Pressable
                  onPress={() => setArranging(!arranging)}
                  hitSlop={10}
                  className="min-h-[44px] justify-center"
                  accessibilityRole="button"
                >
                  <Text className="text-link text-[17px] font-semibold">{arranging ? 'Done' : 'Arrange'}</Text>
                </Pressable>
              ) : undefined
            }
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        footer={<PrimaryButton label="Save" onPress={save} disabled={!hasItems} />}
      >
        {/* The lines */}
        <SectionHeader title="Items" />
        <Group className="mb-3">
          {lines.map((line, i) => (
            <View key={line.id}>
              {i > 0 && <RowDivider />}
              <LineRow
                line={line}
                before={priced.subtotal + priced.discount}
                arranging={arranging}
                first={i === 0}
                last={i === lines.length - 1}
                onPress={() => openLine(line)}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onRemove={() => remove(line.id)}
              />
            </View>
          ))}
          {lines.length > 0 && <RowDivider />}
          <Pressable
            onPress={() => setAdding(true)}
            className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
            accessibilityRole="button"
          >
            <Plus size={20} color={t.link} strokeWidth={2} />
            <Text className="text-link text-base font-semibold ml-2">Add item</Text>
          </Pressable>
        </Group>
        {partsNotOnPrice.length > 0 && (
          <Pressable
            onPress={() => proOnly('parts', () => setPicking('parts'))}
            className="flex-row items-center mx-1 mb-3 min-h-[44px] active:opacity-70"
            accessibilityRole="button"
          >
            <Package size={16} color={t.secondary} strokeWidth={2} />
            <Text className="flex-1 text-secondary text-[14px] ml-2">
              {partsNotOnPrice.length === 1 ? '1 part isn’t' : `${partsNotOnPrice.length} parts aren’t`} on the price.{' '}
              <Text className="text-link font-semibold">Add {partsNotOnPrice.length === 1 ? 'it' : 'them'}</Text>
            </Text>
          </Pressable>
        )}

        {/* Totals */}
        <Group className="px-4 py-3 mb-6">
          <TotalLine label="Subtotal" value={priced.subtotal + priced.discount} />
          {priced.discount > 0 && <TotalLine label="Discount" value={-priced.discount} />}
          {priced.vatBands.map((b) => (
            <TotalLine
              key={b.rate}
              label={`VAT ${b.rate}%${priced.vatBands.length > 1 ? ` on ${formatAmount(b.net)}` : ''}${reverseCharge ? ' (reverse charge)' : ''}`}
              value={b.vat}
              muted={reverseCharge}
            />
          ))}
          {priced.salesTax > 0 && (
            <TotalLine
              label={`Sales tax ${settings.salesTaxRate}%${(settings.salesTaxOn ?? 'materials') === 'materials' ? ' on materials' : ''}`}
              value={priced.salesTax}
            />
          )}
          <View className="h-px bg-divider my-2" />
          <TotalLine label="Total" value={priced.total} strong />
        </Group>

        {/* Options */}
        <SectionHeader title="On the PDF" />
        <Group className="mb-2">
          <ToggleRow
            label="Show item prices"
            hint={showItemPrices ? 'Each item with its quantity and price' : 'Items listed, with only the totals'}
            value={showItemPrices}
            onValueChange={setShowItemPrices}
          />
          {rules.vatApplies && (
            <>
              <RowDivider />
              <ToggleRow
                label="Reverse charge"
                hint="For a VAT-registered builder under CIS. VAT is shown, not charged."
                value={reverseCharge}
                onValueChange={setReverseCharge}
              />
            </>
          )}
        </Group>
        <Text className="text-secondary text-[13px] mx-1 mb-6">
          {reverseCharge
            ? 'The invoice will say: Reverse charge: customer to account to HMRC for the VAT.'
            : 'Show item prices off is useful when you’d rather not show a breakdown.'}
        </Text>

        <SectionHeader title="Description of the work" />
        <Group className="mb-2">
          <TextInput
            className="text-fg text-base px-4 py-3 min-h-[72px]"
            style={{ textAlignVertical: 'top' }}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            placeholderTextColor={t.secondary}
            multiline
            accessibilityLabel="Description of the work"
          />
        </Group>
        {kind === 'invoice' && invoice?.status === 'sent' && (
          <Text className="text-secondary text-[13px] mx-1 mt-2">
            You’ve already sent this invoice. After saving, use Send again so the customer has the corrected one.
          </Text>
        )}
      </ScrollScreen>

      {/* Add: choose how */}
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <Text className="text-fg text-[20px] font-semibold mb-4">Add item</Text>
        <Group className="bg-bg mb-2">
          <LinkRow icon={PenLine} label="New item" onPress={() => (setAdding(false), openNew())} />
          <RowDivider />
          <LinkRow
            icon={isPro ? ListPlus : Lock}
            label="From your price list"
            value={isPro && priceList.length ? String(priceList.length) : isPro ? undefined : 'Pro'}
            onPress={() => (setAdding(false), proOnly('priceList', () => setPicking('list')))}
          />
          {parts.length > 0 && (
            <>
              <RowDivider />
              <LinkRow
                icon={isPro ? Package : Lock}
                label="From this job’s parts"
                value={isPro ? String(partsNotOnPrice.length) : 'Pro'}
                onPress={() => (setAdding(false), proOnly('parts', () => setPicking('parts')))}
              />
            </>
          )}
          <RowDivider />
          <LinkRow
            icon={Percent}
            label="Discount"
            onPress={() => (setAdding(false), setDiscount({ mode: 'amount', value: '', description: 'Discount' }))}
          />
        </Group>
      </Sheet>

      {/* One line */}
      {editing && (
        <LineSheet
          draft={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveLine}
          onRemove={editing.id ? () => (remove(editing.id!), setEditing(null)) : undefined}
          vatApplies={rules.vatApplies}
          vatRate={settings.vatRate}
          isPro={isPro}
          onLocked={(f) => (setEditing(null), setLocked(f))}
        />
      )}

      {/* A discount */}
      {discount && (
        <Sheet visible onClose={() => setDiscount(null)}>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 560 }}>
            <Text className="text-fg text-[20px] font-semibold mb-4">Discount</Text>
            <Segmented
              className="mb-4 bg-bg"
              options={[
                { key: 'amount', label: `Amount (${currencySymbol()})` },
                { key: 'percent', label: 'Percentage (%)' },
              ]}
              value={discount.mode}
              onChange={(mode) => setDiscount({ ...discount, mode })}
            />
            <LabeledField
              className="mb-4"
              label={discount.mode === 'amount' ? 'Amount off' : 'Percentage off'}
              value={discount.value}
              onChangeText={(v) => {
                const clean = cleanNumber(v);
                if (clean !== null) setDiscount({ ...discount, value: clean });
              }}
              placeholder={discount.mode === 'amount' ? currencySymbol() : '%'}
              keyboardType="decimal-pad"
              autoFocus
            />
            <LabeledField
              className="mb-5"
              label="Shown as"
              value={discount.description}
              onChangeText={(v) => setDiscount({ ...discount, description: v })}
              placeholder="Discount"
            />
            <PrimaryButton label={discount.id ? 'Done' : 'Add discount'} onPress={saveDiscount} disabled={!(num(discount.value) > 0)} />
            {discount.id && (
              <Pressable
                onPress={() => (remove(discount.id!), setDiscount(null))}
                className="min-h-[48px] items-center justify-center mt-1"
                accessibilityRole="button"
              >
                <Text className="text-alert text-base font-semibold">Remove discount</Text>
              </Pressable>
            )}
          </ScrollView>
        </Sheet>
      )}

      {/* Price list */}
      <PriceListPicker visible={picking === 'list'} items={priceList} onPick={addSaved} onClose={() => setPicking(null)} />

      {/* Parts */}
      {picking === 'parts' && isPro && (
        <PartsPicker parts={partsNotOnPrice} markup={markupDefault} onAdd={addParts} onClose={() => setPicking(null)} />
      )}

      <ConfirmModal
        visible={confirmLeave}
        title="Discard changes?"
        message="Your changes to the price haven’t been saved."
        confirmText="Discard"
        cancelText="Keep editing"
        variant="error"
        onConfirm={goBack}
        onCancel={() => {}}
        onDismiss={() => setConfirmLeave(false)}
      />
      <UpgradePrompt
        visible={!!locked}
        onClose={() => {
          setLocked(null);
          if (picking === 'parts' && !isPro) setPicking(null);
        }}
        feature={locked ?? 'priceList'}
      />
    </View>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function TotalLine({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className={cn('flex-1 mr-3', strong ? 'text-fg text-base font-semibold' : 'text-secondary text-[15px]')}>{label}</Text>
      <Text className={cn(strong ? 'text-fg text-[17px] font-bold' : muted ? 'text-secondary text-[15px]' : 'text-fg text-[15px]')}>
        {formatAmount(value)}
      </Text>
    </View>
  );
}

function LineRow({
  line,
  before,
  arranging,
  first,
  last,
  onPress,
  onUp,
  onDown,
  onRemove,
}: {
  line: LineItem;
  /** Everything before discounts, for a percentage discount's amount. */
  before: number;
  arranging: boolean;
  first: boolean;
  last: boolean;
  onPress: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const t = useTheme();
  const isDiscount = line.kind === 'discount';
  const amount = isDiscount ? -(line.percent ? roundPence(before * (line.percent / 100)) : line.unitPrice) : lineAmount(line);
  const detail = isDiscount
    ? line.percent
      ? `${line.percent}% off`
      : 'Amount off'
    : `${line.quantity}${unitLabel(line.unit)} × ${formatAmount(line.unitPrice)} · ${lineKindLabels(getRegion().country)[line.kind as ItemKind]}`;
  return (
    <View className="flex-row items-center">
      <Pressable
        onPress={arranging ? undefined : onPress}
        className="flex-1 flex-row items-center pl-4 pr-3 py-2.5 min-h-[56px] active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={`${line.description}, ${detail}, ${formatMoney(amount)}`}
        accessibilityHint={arranging ? undefined : 'Edit'}
      >
        <View className="flex-1 mr-3">
          <Text className="text-fg text-base" numberOfLines={2}>
            {line.description}
          </Text>
          <Text className="text-secondary text-sm">{detail}</Text>
        </View>
        {!arranging && <Text className="text-fg text-base">{formatAmount(amount)}</Text>}
      </Pressable>
      {arranging && (
        <View className="flex-row items-center pr-1">
          <IconButton icon={ChevronUp} label={`Move ${line.description} up`} onPress={onUp} disabled={first} color={t.link} />
          <IconButton icon={ChevronDown} label={`Move ${line.description} down`} onPress={onDown} disabled={last} color={t.link} />
          <IconButton icon={Trash2} label={`Remove ${line.description}`} onPress={onRemove} color={t.alert} />
        </View>
      )}
    </View>
  );
}

function IconButton({
  icon: Icon,
  label,
  onPress,
  disabled,
  color,
}: {
  icon: typeof Trash2;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="w-11 h-11 items-center justify-center active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Icon size={20} color={disabled ? t.divider : color} strokeWidth={2} />
    </Pressable>
  );
}

function LineSheet({
  draft,
  onChange,
  onClose,
  onSave,
  onRemove,
  vatApplies,
  vatRate,
  isPro,
  onLocked,
}: {
  draft: LineDraft;
  onChange: (d: LineDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onRemove?: () => void;
  vatApplies: boolean;
  vatRate: number;
  isPro: boolean;
  onLocked: (feature: LimitedFeature) => void;
}) {
  const set = (changes: Partial<LineDraft>) => onChange({ ...draft, ...changes });
  const setNumber = (key: 'quantity' | 'unitPrice' | 'markup', v: string) => {
    const clean = cleanNumber(v);
    if (clean === null) return;
    if (key === 'markup' && draft.unitCost !== undefined) {
      set({ markup: clean, unitPrice: String(withMarkup(draft.unitCost, num(clean))) });
    } else set({ [key]: clean });
  };
  const amount = roundPence((num(draft.quantity) || 1) * num(draft.unitPrice));
  const rates = VAT_RATES.includes(vatRate) ? VAT_RATES : [vatRate, ...VAT_RATES];

  return (
    <Sheet visible onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 640 }}>
        <Text className="text-fg text-[20px] font-semibold mb-4">{draft.id ? 'Edit item' : 'New item'}</Text>
        <LabeledField
          className="mb-4"
          label="What is it?"
          value={draft.description}
          onChangeText={(v) => set({ description: v })}
          placeholder="e.g. Fit new mixer tap"
          autoFocus={!draft.id}
        />
        <Segmented
          className="mb-4 bg-bg"
          options={(['labour', 'materials', 'other'] as ItemKind[]).map((k) => ({ key: k, label: lineKindLabels(getRegion().country)[k] }))}
          value={draft.kind}
          onChange={(k) => set({ kind: k })}
        />
        <View className="flex-row gap-3 mb-3">
          <LabeledField
            className="flex-1"
            label="How many"
            value={draft.quantity}
            onChangeText={(v) => setNumber('quantity', v)}
            placeholder="1"
            keyboardType="decimal-pad"
          />
          <LabeledField
            className="flex-1"
            label={`Price each${unitLabel(draft.unit) ? ` (per${unitLabel(draft.unit)})` : ''}`}
            value={draft.unitPrice}
            onChangeText={(v) => setNumber('unitPrice', v)}
            placeholder={currencySymbol()}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Unit */}
        <Text className="text-secondary text-[13px] mx-0.5 mb-1.5">Unit</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {[undefined, ...LINE_UNITS].map((u) => (
            <Chip key={u ?? 'each'} label={u ?? 'each'} selected={draft.unit === u} onPress={() => set({ unit: u })} />
          ))}
        </View>

        {/* Part cost and markup */}
        {draft.unitCost !== undefined && (
          <View className="mb-4">
            <LabeledField
              label={`Markup on cost (${formatAmount(draft.unitCost)} each)`}
              value={draft.markup}
              onChangeText={(v) => setNumber('markup', v)}
              placeholder="%"
              keyboardType="decimal-pad"
              hint="Changes the price each. Only you see the cost and markup."
            />
          </View>
        )}

        {/* VAT rate (VAT-registered only) */}
        {vatApplies && (
          <>
            <Text className="text-secondary text-[13px] mx-0.5 mb-1.5">VAT rate</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {rates.map((r) => (
                <Chip
                  key={r}
                  label={`${r}%`}
                  selected={(draft.vatRate ?? vatRate) === r}
                  onPress={() => set({ vatRate: r === vatRate ? undefined : r })}
                />
              ))}
            </View>
          </>
        )}

        {!draft.id && (
          <Group className="bg-bg mb-4">
            <ToggleRow
              label="Save to price list"
              hint={isPro ? 'Add it to any quote later in a tap' : 'Pro'}
              value={draft.saveToList}
              onValueChange={(v) => (isPro ? set({ saveToList: v }) : onLocked('priceList'))}
            />
          </Group>
        )}

        <Text className="text-fg text-base font-semibold mx-1 mb-3">Line total {formatAmount(amount)}</Text>
        <PrimaryButton
          label={draft.id ? 'Done' : 'Add item'}
          onPress={onSave}
          disabled={!draft.description.trim() || !(num(draft.unitPrice) >= 0) || draft.unitPrice === ''}
        />
        {onRemove && (
          <Pressable onPress={onRemove} className="min-h-[48px] items-center justify-center mt-1" accessibilityRole="button">
            <Text className="text-alert text-base font-semibold">Remove item</Text>
          </Pressable>
        )}
      </ScrollView>
    </Sheet>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('px-4 min-h-[40px] rounded-xl items-center justify-center', selected ? 'bg-divider' : 'bg-bg')}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Text className={cn('text-[15px] font-semibold', selected ? 'text-fg' : 'text-secondary')}>{label}</Text>
    </Pressable>
  );
}

function PriceListPicker({
  visible,
  items,
  onPick,
  onClose,
}: {
  visible: boolean;
  items: SavedItem[];
  onPick: (item: SavedItem) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const shown = [...items]
    .filter((i) => i.description.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || a.description.localeCompare(b.description));
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text className="text-fg text-[20px] font-semibold mb-3">Your price list</Text>
      {items.length > 0 && (
        <View className="flex-row items-center bg-bg rounded-xl px-3 mb-3 min-h-[44px]">
          <Search size={16} color={t.secondary} strokeWidth={2} />
          <TextInput
            className="flex-1 text-fg text-base ml-2 py-2"
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={t.secondary}
            accessibilityLabel="Search your price list"
          />
        </View>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 440 }}>
        {items.length === 0 ? (
          <Text className="text-secondary text-[15px] mx-1 mb-4">
            Nothing saved yet. Turn on Save to price list when you add an item, or add items in Account → Price list.
          </Text>
        ) : (
          <Group className="bg-bg mb-2">
            {shown.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <RowDivider />}
                <Pressable
                  onPress={() => (setQuery(''), onPick(item))}
                  className="flex-row items-center px-4 py-2.5 min-h-[52px] active:opacity-70"
                  accessibilityRole="button"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-fg text-base">{item.description}</Text>
                    <Text className="text-secondary text-sm">{lineKindLabels(getRegion().country)[item.kind]}</Text>
                  </View>
                  <Text className="text-fg text-base">
                    {formatAmount(item.unitPrice)}
                    {item.unit ? <Text className="text-secondary"> /{item.unit}</Text> : null}
                  </Text>
                </Pressable>
              </View>
            ))}
            {shown.length === 0 && <Text className="text-secondary text-[15px] p-4">No items match.</Text>}
          </Group>
        )}
      </ScrollView>
    </Sheet>
  );
}

function PartsPicker({
  parts,
  markup,
  onAdd,
  onClose,
}: {
  parts: Part[];
  markup: number;
  onAdd: (parts: Part[], markup: number) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>(() => parts.map((p) => p.id));
  const [markupText, setMarkupText] = useState(numText(markup));
  const m = num(markupText);
  const picked = parts.filter((p) => chosen.includes(p.id));
  const total = roundPence(picked.reduce((s, p) => s + p.quantity * withMarkup(p.unitCost, m), 0));
  return (
    <Sheet visible onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 620 }}>
        <Text className="text-fg text-[20px] font-semibold mb-4">Add parts to the price</Text>
        {parts.length === 0 ? (
          <Text className="text-secondary text-[15px] mx-1 mb-4">All this job’s parts are already on the price.</Text>
        ) : (
          <>
            <Group className="bg-bg mb-4">
              {parts.map((p, i) => {
                const on = chosen.includes(p.id);
                return (
                  <View key={p.id}>
                    {i > 0 && <RowDivider />}
                    <Pressable
                      onPress={() => setChosen(on ? chosen.filter((x) => x !== p.id) : [...chosen, p.id])}
                      className="flex-row items-center px-4 py-2.5 min-h-[52px] active:opacity-70"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <View className="flex-1 mr-3">
                        <Text className={cn('text-base', on ? 'text-fg' : 'text-secondary')}>{p.name}</Text>
                        <Text className="text-secondary text-sm">
                          {p.quantity} × {formatAmount(p.unitCost)} cost
                          {m ? ` → ${formatAmount(withMarkup(p.unitCost, m))}` : ''}
                        </Text>
                      </View>
                      <Text className={cn('text-[15px] font-semibold', on ? 'text-link' : 'text-secondary')}>
                        {on ? 'Adding' : 'Skip'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </Group>
            <LabeledField
              className="mb-5"
              label="Markup"
              value={markupText}
              onChangeText={(v) => {
                const clean = cleanNumber(v);
                if (clean !== null) setMarkupText(clean);
              }}
              placeholder="0 %"
              keyboardType="decimal-pad"
              hint="Added to what you paid. Your usual markup is set in Account → Prices."
            />
            <PrimaryButton
              label={picked.length ? `Add ${picked.length} for ${formatAmount(total)}` : 'Choose parts to add'}
              onPress={() => onAdd(picked, m)}
              disabled={!picked.length}
            />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
