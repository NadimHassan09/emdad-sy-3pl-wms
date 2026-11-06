import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Drawer } from '@ds';

import { api } from '../../api/client';
import { CompaniesApi, CompanyListRow } from '../../api/companies';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { defaultHomePath } from '../../lib/rbac';
import { useWmsTranslation } from '../../lib/ui-i18n';
import {
  listCities,
  listDistricts,
  listNeighborhoods,
} from '../../data/syria-address';

type FeeLocation = {
  id?: string;
  level: 'governorate' | 'city_region' | 'town';
  governorate: string;
  cityRegion?: string | null;
  townNeighborhood?: string | null;
  locationKey?: string;
};

type FeeGroup = {
  id: string;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
  nameAr: string;
  nameEn: string | null;
  areaCategory: 'region' | 'rural' | 'mixed' | 'custom';
  baseRate: string;
  active: boolean;
  sortOrder: number;
  locations: FeeLocation[];
};

type FeeConfig = {
  settings: {
    currency: string;
    baseWeightKg: string | null;
    incrementKg: string | null;
    incrementCharge: string | null;
    externalPerKg: string | null;
    externalCurrency: string | null;
  };
  groups: FeeGroup[];
  rounding: { description: string };
};

type DraftLocation = {
  key: string;
  level: 'governorate' | 'city_region' | 'town';
  governorate: string;
  cityRegion?: string | null;
  townNeighborhood?: string | null;
};

const CATEGORIES = ['region', 'rural', 'mixed', 'custom'] as const;

const GROUP_COLORS: Record<string, string> = {
  region: '#078653', // Emerald green
  rural: '#2563eb',  // Royal blue
  mixed: '#d97706',  // Amber
  custom: '#7c3aed', // Purple
};

function makeLocKey(level: string, gov: string, city?: string | null, town?: string | null): string {
  if (level === 'governorate') return `gov:${gov}`;
  if (level === 'city_region') return `city:${gov}:${city ?? ''}`;
  return `town:${gov}:${city ?? ''}:${town ?? ''}`;
}

function formatLocationLabel(location: FeeLocation | DraftLocation): string {
  if (location.level === 'governorate') {
    return `${location.governorate} (كامل المحافظة)`;
  }
  if (location.level === 'town') {
    return `${location.governorate} / ${location.cityRegion} / ${location.townNeighborhood}`;
  }
  return `${location.governorate} / ${location.cityRegion}`;
}

export function ShippingFeeRatePage() {
  const { user } = useAuth();
  const { t } = useWmsTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'super_admin';

  // Scope filter: 'all' | 'global' | companyId
  const [filterScope, setFilterScope] = useState<string>('all');

  const configQuery = useQuery({
    queryKey: ['shipping-fee-rates', filterScope],
    queryFn: () =>
      api
        .get<FeeConfig>('/shipping/fee-rates', {
          params: filterScope !== 'all' ? { companyId: filterScope } : undefined,
        })
        .then((response) => response.data),
    enabled: isSuperAdmin,
  });

  const companiesQuery = useQuery({
    queryKey: ['shipping-fee-companies'],
    queryFn: () => CompaniesApi.list({ includeAll: true }),
    enabled: isSuperAdmin,
  });
  const companies: CompanyListRow[] = companiesQuery.data ?? [];

  // Global settings state
  const [currency, setCurrency] = useState('USD');
  const [baseWeightKg, setBaseWeightKg] = useState('10');
  const [incrementKg, setIncrementKg] = useState('5');
  const [incrementCharge, setIncrementCharge] = useState('1');
  const [externalPerKg, setExternalPerKg] = useState('');
  const [externalCurrency, setExternalCurrency] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const s = configQuery.data?.settings;
    if (!s) return;
    setCurrency(s.currency || 'USD');
    setBaseWeightKg(s.baseWeightKg ?? '10');
    setIncrementKg(s.incrementKg ?? '5');
    setIncrementCharge(s.incrementCharge ?? '1');
    setExternalPerKg(s.externalPerKg ?? '');
    setExternalCurrency(s.externalCurrency ?? '');
  }, [configQuery.data?.settings]);

  const saveSettings = useMutation({
    mutationFn: () =>
      api.put('/shipping/fee-rates/settings', {
        currency,
        baseWeightKg: Number(baseWeightKg),
        incrementKg: Number(incrementKg),
        incrementCharge: Number(incrementCharge),
        externalPerKg: externalPerKg.trim() === '' ? null : Number(externalPerKg),
        externalCurrency: externalCurrency.trim() || null,
      }),
    onSuccess: () => {
      toast.success(
        t([
          'Weight settings saved. Existing shipments were not repriced.',
          'تم حفظ إعدادات الوزن. لم تُعدَّل أسعار الشحنات السابقة.',
        ]),
      );
      setShowSettingsModal(false);
      void queryClient.invalidateQueries({ queryKey: ['shipping-fee-rates'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Groups list derived
  const allGroups: FeeGroup[] = useMemo(() => configQuery.data?.groups ?? [], [configQuery.data?.groups]);

  const displayedGroups: FeeGroup[] = useMemo(() => {
    if (filterScope === 'all') return allGroups;
    if (filterScope === 'global') return allGroups.filter((g) => !g.companyId);
    return allGroups.filter((g) => g.companyId === filterScope);
  }, [allGroups, filterScope]);

  // Selected client details
  const selectedClient = useMemo(
    () => companies.find((c) => c.id === filterScope) ?? null,
    [companies, filterScope],
  );

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    const activeGroups = displayedGroups.filter((g) => g.active);
    const govs = new Set<string>();
    const cities = new Set<string>();

    for (const group of activeGroups) {
      for (const loc of group.locations) {
        govs.add(loc.governorate);
        if (loc.level === 'governorate') {
          // Whole governorate covers all its cities
          const allDistricts = listDistricts(loc.governorate);
          allDistricts.forEach((d) => cities.add(`${loc.governorate}:${d}`));
        } else if (loc.cityRegion) {
          cities.add(`${loc.governorate}:${loc.cityRegion}`);
        }
      }
    }

    return {
      groupsCount: displayedGroups.length,
      govsCount: govs.size,
      citiesCount: cities.size,
    };
  }, [displayedGroups]);

  // Location tree helpers (placed early so uncoveredGovs can use it)
  const allGovernorates = useMemo(() => listCities(), []);

  // Which governorates are NOT covered by any active global rate group
  const uncoveredGovs = useMemo(() => {
    const coveredByActive = new Set<string>();
    const activeGroups = allGroups.filter((g) => g.active && !g.companyId);
    for (const group of activeGroups) {
      for (const loc of group.locations) {
        coveredByActive.add(loc.governorate);
      }
    }
    return allGovernorates.filter((g) => !coveredByActive.has(g));
  }, [allGroups, allGovernorates]);

  // Drawer / Wizard state
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [drawerCompanyId, setDrawerCompanyId] = useState<string>('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [areaCategory, setAreaCategory] = useState<(typeof CATEGORIES)[number]>('custom');
  const [baseRate, setBaseRate] = useState('4.00');
  const [active, setActive] = useState(true);
  const [selectedLocations, setSelectedLocations] = useState<DraftLocation[]>([]);

  // Hierarchical location tree state
  const [locationSearch, setLocationSearch] = useState('');
  const [expandedGovs, setExpandedGovs] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  // Policy mode in Step 3
  const [policyMode, setPolicyMode] = useState<'default' | 'custom'>('default');
  const [customIncWeight, setCustomIncWeight] = useState('10');
  const [customStepWeight, setCustomStepWeight] = useState('5');
  const [customStepCharge, setCustomStepCharge] = useState('1');

  function openNew() {
    setEditingId('new');
    setCurrentStep(1);
    setDrawerCompanyId(filterScope !== 'all' && filterScope !== 'global' ? filterScope : '');
    setNameAr('');
    setNameEn('');
    setAreaCategory('custom');
    setBaseRate('4.00');
    setActive(true);
    setSelectedLocations([]);
    setLocationSearch('');
    setPolicyMode('default');
  }

  function openEdit(group: FeeGroup) {
    setEditingId(group.id);
    setCurrentStep(1);
    setDrawerCompanyId(group.companyId ?? '');
    setNameAr(group.nameAr);
    setNameEn(group.nameEn ?? '');
    setAreaCategory(group.areaCategory);
    setBaseRate(group.baseRate);
    setActive(group.active);
    setSelectedLocations(
      group.locations.map((loc) => ({
        key: makeLocKey(loc.level, loc.governorate, loc.cityRegion, loc.townNeighborhood),
        level: loc.level,
        governorate: loc.governorate,
        cityRegion: loc.cityRegion ?? null,
        townNeighborhood: loc.townNeighborhood ?? null,
      })),
    );
    setLocationSearch('');
    setPolicyMode('default');
  }

  // Quick-start templates: pre-fill the drawer with common Syrian rate structures
  const RATE_TEMPLATES = useMemo<
    Array<{
      labelEn: string;
      labelAr: string;
      descriptionEn: string;
      descriptionAr: string;
      nameAr: string;
      nameEn: string;
      areaCategory: (typeof CATEGORIES)[number];
      baseRate: string;
      govs: string[];
    }>
  >(
    () => [
      {
        labelEn: 'All Syria (Single Rate)',
        labelAr: 'سوريا بأكملها (سعر موحد)',
        descriptionEn: 'Covers all 14 governorates at one flat rate — good for starting out',
        descriptionAr: 'يغطي جميع المحافظات الـ 14 بسعر موحد — نقطة انطلاق جيدة',
        nameAr: 'جميع أنحاء سوريا',
        nameEn: 'All Syria',
        areaCategory: 'region',
        baseRate: '5.00',
        govs: allGovernorates,
      },
      {
        labelEn: 'Major Cities',
        labelAr: 'المدن الرئيسية',
        descriptionEn: 'Damascus, Aleppo, Homs, Hama, Latakia, Tartous — urban flat rate',
        descriptionAr: 'دمشق، حلب، حمص، حماة، اللاذقية، طرطوس — سعر المدن الرئيسية',
        nameAr: 'المدن الرئيسية',
        nameEn: 'Major Cities',
        areaCategory: 'region',
        baseRate: '4.00',
        govs: ['دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس'],
      },
      {
        labelEn: 'Rural & Remote',
        labelAr: 'الريف والمناطق البعيدة',
        descriptionEn: 'Deir ez-Zor, Raqqa, Hasakah, Idlib, Quneitra, Sweida, Daraa — remote rate',
        descriptionAr: 'دير الزور، الرقة، الحسكة، إدلب، القنيطرة، السويداء، درعا — سعر الريف',
        nameAr: 'الريف والمناطق البعيدة',
        nameEn: 'Rural & Remote',
        areaCategory: 'rural',
        baseRate: '7.00',
        govs: ['دير الزور', 'الرقة', 'الحسكة', 'إدلب', 'القنيطرة', 'السويداء', 'درعا'],
      },
    ],
    [allGovernorates],
  );

  function openFromTemplate(tpl: (typeof RATE_TEMPLATES)[0]) {
    setEditingId('new');
    setCurrentStep(1);
    setDrawerCompanyId('');
    setNameAr(tpl.nameAr);
    setNameEn(tpl.nameEn);
    setAreaCategory(tpl.areaCategory);
    setBaseRate(tpl.baseRate);
    setActive(true);
    setSelectedLocations(
      tpl.govs.map((gov) => ({
        key: `gov:${gov}`,
        level: 'governorate',
        governorate: gov,
        cityRegion: null,
        townNeighborhood: null,
      })),
    );
    setLocationSearch('');
    setPolicyMode('default');
  }

  // Filtered tree based on search
  const isSearching = locationSearch.trim().length > 0;
  const searchNormalized = locationSearch.trim().toLowerCase();

  const matchingGovs = useMemo(() => {
    if (!isSearching) return allGovernorates;
    return allGovernorates.filter((gov) => {
      if (gov.toLowerCase().includes(searchNormalized)) return true;
      const districts = listDistricts(gov);
      return districts.some((d) => {
        if (d.toLowerCase().includes(searchNormalized)) return true;
        const towns = listNeighborhoods(gov, d);
        return towns.some((t) => t.toLowerCase().includes(searchNormalized));
      });
    });
  }, [allGovernorates, isSearching, searchNormalized]);

  // Auto-expand branches when searching
  useEffect(() => {
    if (isSearching) {
      setExpandedGovs(new Set(matchingGovs));
      const expandedC = new Set<string>();
      matchingGovs.forEach((gov) => {
        listDistricts(gov).forEach((d) => expandedC.add(`${gov}:${d}`));
      });
      setExpandedCities(expandedC);
    }
  }, [isSearching, matchingGovs]);

  function toggleGovExpand(gov: string) {
    setExpandedGovs((prev) => {
      const next = new Set(prev);
      if (next.has(gov)) next.delete(gov);
      else next.add(gov);
      return next;
    });
  }

  function toggleCityExpand(gov: string, city: string) {
    const k = `${gov}:${city}`;
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // Selection handlers
  function toggleGovernorateSelection(gov: string) {
    const govKey = `gov:${gov}`;
    setSelectedLocations((prev) => {
      const hasGov = prev.some((l) => l.key === govKey);
      if (hasGov) {
        // Uncheck governorate & all its descendants
        return prev.filter((l) => l.governorate !== gov);
      }
      // Check whole governorate: remove any specific cities/towns and add whole gov
      const cleaned = prev.filter((l) => l.governorate !== gov);
      return [
        ...cleaned,
        {
          key: govKey,
          level: 'governorate',
          governorate: gov,
          cityRegion: null,
          townNeighborhood: null,
        },
      ];
    });
  }

  function toggleCitySelection(gov: string, city: string) {
    const govKey = `gov:${gov}`;
    const cityKey = `city:${gov}:${city}`;

    setSelectedLocations((prev) => {
      const isGovSelected = prev.some((l) => l.key === govKey);
      if (isGovSelected) {
        // If whole governorate was checked and user clicked a city, expand governorate into other cities!
        const allOtherDistricts = listDistricts(gov).filter((d) => d !== city);
        const withoutGov = prev.filter((l) => l.key !== govKey);
        const newCityNodes: DraftLocation[] = allOtherDistricts.map((d) => ({
          key: `city:${gov}:${d}`,
          level: 'city_region',
          governorate: gov,
          cityRegion: d,
          townNeighborhood: null,
        }));
        return [...withoutGov, ...newCityNodes];
      }

      const isCitySelected = prev.some((l) => l.key === cityKey);
      if (isCitySelected) {
        // Remove city & any of its towns
        return prev.filter((l) => !(l.governorate === gov && l.cityRegion === city));
      }
      // Select city: remove its towns and add city
      const cleaned = prev.filter((l) => !(l.governorate === gov && l.cityRegion === city));
      return [
        ...cleaned,
        {
          key: cityKey,
          level: 'city_region',
          governorate: gov,
          cityRegion: city,
          townNeighborhood: null,
        },
      ];
    });
  }

  function toggleTownSelection(gov: string, city: string, townName: string) {
    const townKey = `town:${gov}:${city}:${townName}`;
    setSelectedLocations((prev) => {
      const isTownSelected = prev.some((l) => l.key === townKey);
      if (isTownSelected) {
        return prev.filter((l) => l.key !== townKey);
      }
      return [
        ...prev,
        {
          key: townKey,
          level: 'town',
          governorate: gov,
          cityRegion: city,
          townNeighborhood: townName,
        },
      ];
    });
  }

  function removeLocationChip(key: string) {
    setSelectedLocations((prev) => prev.filter((l) => l.key !== key));
  }

  function clearAllSelections() {
    setSelectedLocations([]);
  }

  // Location tree stats
  const selectionStats = useMemo(() => {
    let govs = 0;
    let cities = 0;
    let towns = 0;
    for (const loc of selectedLocations) {
      if (loc.level === 'governorate') govs++;
      else if (loc.level === 'city_region') cities++;
      else if (loc.level === 'town') towns++;
    }
    return { govs, cities, towns, total: selectedLocations.length };
  }, [selectedLocations]);

  // Save group mutation
  const saveGroup = useMutation({
    mutationFn: async (reassign: boolean) => {
      const body = {
        companyId: drawerCompanyId.trim() ? drawerCompanyId.trim() : null,
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || null,
        areaCategory,
        baseRate: Number(baseRate),
        active,
        locations: selectedLocations.map(({ level, governorate: gov, cityRegion, townNeighborhood }) => ({
          level,
          governorate: gov,
          cityRegion: cityRegion ?? null,
          townNeighborhood: townNeighborhood ?? null,
        })),
        reassign,
      };
      if (editingId === 'new') return api.post('/shipping/fee-rates/groups', body);
      return api.put(`/shipping/fee-rates/groups/${editingId}`, body);
    },
    onSuccess: () => {
      toast.success(t(['Pricing group saved successfully.', 'تم حفظ مجموعة الأسعار بنجاح.']));
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ['shipping-fee-rates'] });
    },
    onError: (err: Error) => {
      if (err.message.includes('already belong')) {
        const move = window.confirm(
          t([
            `${err.message} Do you want to move them into this group?`,
            `${err.message} هل ترغب في نقلها إلى هذه المجموعة؟`,
          ]),
        );
        if (move) saveGroup.mutate(true);
        return;
      }
      toast.error(err.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: (group: FeeGroup) =>
      api.patch(`/shipping/fee-rates/groups/${group.id}/active`, { active: !group.active }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shipping-fee-rates'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  // Calculator / Preview state
  const [calcGov, setCalcGov] = useState('');
  const [calcCity, setCalcCity] = useState('');
  const [calcTown, setCalcTown] = useState('');
  const [calcWeight, setCalcWeight] = useState('2');
  const [calcResult, setCalcResult] = useState<{
    amount: number;
    currency: string;
    increments?: number;
    groupNameAr?: string;
    locationLevel?: string;
    isClientSpecific?: boolean;
    error?: string;
  } | null>(null);

  const calcDistricts = useMemo(() => (calcGov ? listDistricts(calcGov) : []), [calcGov]);
  const calcNeighborhoods = useMemo(
    () => (calcGov && calcCity ? listNeighborhoods(calcGov, calcCity) : []),
    [calcGov, calcCity],
  );

  const testPriceMutation = useMutation({
    mutationFn: () =>
      api
        .post<{
          amount: number;
          currency: string;
          increments?: number;
          groupNameAr?: string;
          locationLevel?: string;
          isClientSpecific?: boolean;
        }>('/shipping/fee-rates/preview', {
          scope: 'local',
          companyId: filterScope !== 'all' && filterScope !== 'global' ? filterScope : undefined,
          governorate: calcGov,
          cityRegion: calcCity || undefined,
          townNeighborhood: calcTown || undefined,
          weightKg: Number(calcWeight),
        })
        .then((response) => response.data),
    onSuccess: (data) => {
      setCalcResult(data);
    },
    onError: (err: Error) => {
      setCalcResult({ amount: 0, currency: '', error: err.message });
    },
  });

  const calculatorRef = useRef<HTMLDivElement>(null);

  function scrollToCalculator() {
    calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (!isSuperAdmin) return <Navigate to={defaultHomePath(user?.role)} replace />;

  return (
    <div className="space-y-6 animate-enter pb-12">
      {/* Top Breadcrumb & Link */}
      <div className="flex items-center justify-between">
        <Link
          to="/shipping/companies"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
        >
          <span>←</span>
          <span>{t(['Shipping Companies', 'شركات الشحن'])}</span>
        </Link>
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          className="text-xs text-text-muted hover:text-brand-700 underline font-medium"
        >
          ⚙ {t(['Global Weight & Currency Settings', 'إعدادات الوزن والعملة العامة'])}
        </button>
      </div>

      {/* Heading Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-brand-600 tracking-wider uppercase block mb-1">
            {t(['Shipping Configuration', 'إعدادات الشحن'])}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">
            {t(['Shipping Fee Rates', 'أسعار الشحن للعملاء'])}
          </h1>
          <p className="mt-1 text-sm text-text-muted max-w-2xl">
            {t([
              'Set the delivery price your client pays based on destination and shipment weight.',
              'حدد سعر التوصيل الذي يدفعه عميلك بناءً على الوجهة ووزن الشحنة.',
            ])}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="secondary" onClick={scrollToCalculator}>
            <span className="text-sm">▦</span>
            <span>{t(['Test a delivery price', 'اختبار سعر التوصيل'])}</span>
          </Button>
          <Button variant="primary" onClick={openNew}>
            <span>＋</span>
            <span>{t(['Add rate group', 'إضافة مجموعة أسعار'])}</span>
          </Button>
        </div>
      </div>

      {/* Pricing Scope Selector */}
      <div className="flex items-center gap-3 flex-wrap bg-surface p-3.5 rounded-xl border border-border-subtle shadow-xs">
        <div>
          <label className="text-xs font-bold text-text-muted block mb-1">
            {t(['Client', 'العميل'])}
          </label>
          <select
            className="w-72 max-w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
          >
            <option value="all">{t(['All Clients / All Groups', 'كافة العملاء / جميع المجموعات'])}</option>
            <option value="global">{t(['Global Default (Shared Rate Card)', 'الأسعار العامة (البطاقة المشتركة)'])}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-5">
          {filterScope === 'global' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {t(['Global default rate card', 'بطاقة التسعير العامة الافتراضية'])}
            </span>
          ) : filterScope === 'all' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              {t(['Showing all scopes', 'عرض كافة النطاقات'])}
            </span>
          ) : displayedGroups.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {selectedClient?.name ? `${selectedClient.name}: ` : ''}
              {t(['Client rate card active', 'بطاقة تسعير خاصة مفعّلة للعميل'])}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
              {selectedClient?.name ? `${selectedClient.name}: ` : ''}
              {t(['No client rate card · Using global fallback', 'لا توجد أسعار خاصة · يُستخدم السعر العام كبديل'])}
            </span>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-white border border-border-subtle rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">
            ◇
          </div>
          <div>
            <strong className="text-2xl font-bold text-text-strong block leading-none mb-1">
              {metrics.groupsCount}
            </strong>
            <span className="text-xs text-text-muted font-medium">
              {t(['Rate groups', 'مجموعات الأسعار'])}
            </span>
          </div>
        </div>

        <div className="bg-white border border-border-subtle rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">
            ⌖
          </div>
          <div>
            <strong className="text-2xl font-bold text-text-strong block leading-none mb-1">
              {metrics.govsCount}
            </strong>
            <span className="text-xs text-text-muted font-medium">
              {t(['Governorates covered', 'محافظات مشمولة'])}
            </span>
          </div>
        </div>

        <div className="bg-white border border-border-subtle rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">
            ✓
          </div>
          <div>
            <strong className="text-2xl font-bold text-text-strong block leading-none mb-1">
              {metrics.citiesCount}
            </strong>
            <span className="text-xs text-text-muted font-medium">
              {t(['Selected cities / regions', 'مدن ومناطق مختارة'])}
            </span>
          </div>
        </div>
      </div>

      {/* Coverage Warning Banner */}
      {uncoveredGovs.length > 0 && (filterScope === 'all' || filterScope === 'global') && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-base">
            ⚠
          </div>
          <div className="flex-1">
            <strong className="block text-sm font-bold text-amber-900">
              {t([
                `${uncoveredGovs.length} of 14 governorates have no active rate — customers from these areas cannot confirm orders.`,
                `${uncoveredGovs.length} من أصل 14 محافظة ليس لها سعر شحن نشط — لا يمكن للعملاء من هذه المناطق تأكيد طلباتهم.`,
              ])}
            </strong>
            <p className="text-xs text-amber-800 mt-0.5">
              {uncoveredGovs.join('، ')}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={openNew}>
            <span>＋</span>
            <span>{t(['Add rate group', 'إضافة مجموعة'])}</span>
          </Button>
        </div>
      )}

      {/* Quick-Start Templates (shown when no global groups exist yet) */}
      {allGroups.filter((g) => !g.companyId).length === 0 && (
        <div className="bg-white border border-border-subtle rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 sm:px-5 border-b border-border-subtle">
            <h2 className="text-base font-bold text-text-strong">
              {t(['Quick-start templates', 'قوالب البدء السريع'])}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {t([
                'No rate groups yet. Pick a template to pre-fill the form — you can edit all values before saving.',
                'لا توجد مجموعات أسعار بعد. اختر قالباً لملء النموذج تلقائياً — يمكنك تعديل جميع القيم قبل الحفظ.',
              ])}
            </p>
          </div>
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {RATE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.labelEn}
                type="button"
                onClick={() => openFromTemplate(tpl)}
                className="text-start border border-border-subtle rounded-xl p-3.5 hover:border-brand-400 hover:bg-brand-50/30 transition-all group"
              >
                <strong className="block text-sm font-bold text-text-strong group-hover:text-brand-700 mb-1">
                  {t([tpl.labelEn, tpl.labelAr])}
                </strong>
                <span className="block text-xs text-text-muted">
                  {t([tpl.descriptionEn, tpl.descriptionAr])}
                </span>
                <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  {t(['Base rate', 'السعر الأساسي'])}: ${tpl.baseRate}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rate Groups Table Card */}
      <div className="bg-white border border-border-subtle rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:px-5 flex items-center justify-between border-b border-border-subtle gap-3">
          <div>
            <h2 className="text-base font-bold text-text-strong">
              {t(['Rate groups', 'مجموعات الأسعار'])}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {t([
                'Choose where each price applies. More specific locations override broader locations.',
                'حدد أين يُطبق كل سعر. القواعد الأكثر تحديداً تلغي القواعد الأعم.',
              ])}
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={openNew}>
            <span>＋</span>
            <span>{t(['Add rate group', 'إضافة مجموعة'])}</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left rtl:text-right border-collapse">
            <thead>
              <tr className="bg-surface-sunken text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
                <th className="py-3 px-4 w-[28%]">{t(['Group', 'المجموعة'])}</th>
                <th className="py-3 px-4 w-[32%]">{t(['Coverage summary', 'ملخص التغطية'])}</th>
                <th className="py-3 px-4 w-[12%]">{t(['Base rate', 'السعر الأساسي'])}</th>
                <th className="py-3 px-4 w-[14%]">{t(['Weight policy', 'سياسة الوزن'])}</th>
                <th className="py-3 px-4 w-[8%]">{t(['Status', 'الحالة'])}</th>
                <th className="py-3 px-4 text-end w-[6%]">{t(['Actions', 'الإجراءات'])}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-sm">
              {configQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    {t(['Loading rate groups…', 'جارٍ تحميل مجموعات الأسعار…'])}
                  </td>
                </tr>
              ) : displayedGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <p className="text-text-muted text-sm font-medium">
                      {t(['No rate groups found for this scope.', 'لا توجد مجموعات أسعار مسجلة لهذا النطاق.'])}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {filterScope !== 'all' && filterScope !== 'global'
                        ? t([
                            'This client currently uses the Global Default rate card as fallback.',
                            'يعتمد هذا العميل حالياً على بطاقة التسعير العامة كبديل تلقائي.',
                          ])
                        : t(['Click "Add rate group" above to create your first pricing group.', 'انقر على "إضافة مجموعة" لإنشاء أول مجموعة أسعار.'])}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedGroups.map((group) => {
                  const dotColor = GROUP_COLORS[group.areaCategory] || '#078653';

                  // Generate concise coverage summary
                  const govLevel = group.locations.filter((l) => l.level === 'governorate');
                  const cityLevel = group.locations.filter((l) => l.level === 'city_region');
                  const townLevel = group.locations.filter((l) => l.level === 'town');

                  let mainSummary = '';
                  let subSummary = '';

                  if (govLevel.length > 0) {
                    mainSummary = govLevel.map((l) => l.governorate).join('، ');
                    subSummary = `${govLevel.length} governorate(s) · all cities & neighborhoods included`;
                  } else if (cityLevel.length > 0) {
                    const topCities = cityLevel.slice(0, 3).map((l) => l.cityRegion).join('، ');
                    mainSummary = topCities + (cityLevel.length > 3 ? ` و${cityLevel.length - 3} أخرى` : '');
                    subSummary = `${cityLevel.length} city/region(s) selected · descendants included`;
                  } else if (townLevel.length > 0) {
                    const topTowns = townLevel.slice(0, 3).map((l) => l.townNeighborhood).join('، ');
                    mainSummary = topTowns + (townLevel.length > 3 ? ` و${townLevel.length - 3} أخرى` : '');
                    subSummary = `${townLevel.length} specific neighborhood override(s)`;
                  } else {
                    mainSummary = t(['No destinations', 'لا توجد وجهات']);
                    subSummary = t(['Empty group', 'مجموعة فارغة']);
                  }

                  return (
                    <tr key={group.id} className="hover:bg-surface-sunken/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }}
                          />
                          <div>
                            <span className="font-bold text-text-strong block">
                              {group.nameAr}
                            </span>
                            {group.nameEn ? (
                              <span className="text-xs text-text-muted block">
                                {group.nameEn}
                              </span>
                            ) : null}
                            {group.company ? (
                              <span className="inline-block mt-0.5 rounded px-1.5 py-0.2 text-[10px] font-semibold bg-blue-50 text-blue-700">
                                {group.company.name}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <strong className="text-text-strong font-medium block text-xs sm:text-sm">
                          {mainSummary}
                        </strong>
                        <small className="text-[11px] text-text-muted block mt-0.5">
                          {subSummary}
                        </small>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-text-strong">
                        ${Number(group.baseRate).toFixed(2)}{' '}
                        <span className="text-xs text-text-muted font-normal">{currency}</span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-text-muted">
                        <div>Up to {baseWeightKg} kg</div>
                        <div className="text-[11px]">
                          +${incrementCharge} per {incrementKg} kg
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {group.active ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {t(['Active', 'نشطة'])}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {t(['Inactive', 'متوقفة'])}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-end">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(group)}
                            title={t(['Edit', 'تعديل'])}
                            className="p-1.5 text-text-muted hover:text-brand-700 hover:bg-surface rounded-lg transition-colors border border-border-subtle"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive.mutate(group)}
                            title={group.active ? t(['Deactivate', 'إيقاف']) : t(['Activate', 'تفعيل'])}
                            className="p-1.5 text-text-muted hover:text-brand-700 hover:bg-surface rounded-lg transition-colors border border-border-subtle"
                          >
                            {group.active ? '⏸' : '▶'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3.5 px-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between text-xs text-text-muted gap-2">
          <span>
            {t(['Showing', 'عرض'])} <strong>{displayedGroups.length}</strong>{' '}
            {t(['group(s)', 'مجموعة'])}
          </span>
          <span className="italic">
            {t([
              'Specific location rules take priority over broader rules.',
              'قواعد المواقع الأكثر تحديداً تأخذ الأولوية دائماً على القواعد الأعم.',
            ])}
          </span>
        </div>
      </div>

      {/* Test Delivery Price Calculator Card */}
      <div
        ref={calculatorRef}
        className="bg-white border border-border-subtle rounded-xl shadow-xs overflow-hidden"
      >
        <div className="p-4 sm:px-5 border-b border-border-subtle flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-text-strong">
              {t(['Test a delivery price', 'اختبار سعر التوصيل'])}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {t([
                'Check which rate group applies to a destination and shipment weight.',
                'تحقق من مجموعة الأسعار المطبقة على وجهة ووزن محددين وفق القواعد الحتمية.',
              ])}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-semibold border border-emerald-200">
            {t(['Preview only', 'معاينة فقط'])}
          </span>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <form
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              testPriceMutation.mutate();
            }}
          >
            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {t(['Governorate', 'المحافظة'])}
              </label>
              <select
                className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                value={calcGov}
                onChange={(e) => {
                  setCalcGov(e.target.value);
                  setCalcCity('');
                  setCalcTown('');
                }}
                required
              >
                <option value="">{t(['Select governorate', 'اختر المحافظة'])}</option>
                {allGovernorates.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {t(['City / Region', 'المدينة / المنطقة'])}
              </label>
              <select
                className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                value={calcCity}
                onChange={(e) => {
                  setCalcCity(e.target.value);
                  setCalcTown('');
                }}
              >
                <option value="">{t(['All / Select city', 'الكل / اختر المدينة'])}</option>
                {calcDistricts.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {t(['Neighborhood / Town', 'البلدة أو الحي'])}
              </label>
              <select
                className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                value={calcTown}
                onChange={(e) => setCalcTown(e.target.value)}
                disabled={!calcCity || calcNeighborhoods.length === 0}
              >
                <option value="">{t(['All / Select neighborhood', 'الكل / اختر الحي'])}</option>
                {calcNeighborhoods.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                {t(['Weight (kg)', 'الوزن (كغ)'])}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                value={calcWeight}
                onChange={(e) => setCalcWeight(e.target.value)}
                required
              />
            </div>

            <div>
              <Button
                variant="primary"
                type="submit"
                className="w-full py-2"
                disabled={testPriceMutation.isPending || !calcGov}
              >
                {testPriceMutation.isPending ? t(['Calculating…', 'جارٍ الاحتساب…']) : t(['Calculate', 'احسب'])}
              </Button>
            </div>
          </form>

          <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-blue-800 flex items-start gap-2">
            <span className="font-bold text-sm">ⓘ</span>
            <p>
              <b>{t(['Pricing resolver notice:', 'تنبيه نظام التسعير:'])}</b>{' '}
              {t([
                'This preview directly queries the backend pricing engine. Priority is: Town > City > Governorate; Client rate beats Global default at the same level.',
                'هذه المعاينة تستعلم مباشرة من محرك التسعير الفعلي. الأولوية: الحي > المدينة > المحافظة؛ وسعر العميل يتفوق على السعر العام عند نفس المستوى.',
              ])}
            </p>
          </div>

          {/* Calculator Output */}
          {calcResult ? (
            calcResult.error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
                <strong className="block font-bold mb-1">
                  {t(['No Matching Rate', 'لا يوجد سعر مطابق'])}
                </strong>
                <p className="text-xs text-amber-800">
                  {calcResult.error}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
                      {t(['APPLIED RATE GROUP', 'مجموعة الأسعار المطبقة'])}
                    </span>
                    <strong className="text-sm font-bold text-text-strong block">
                      {calcResult.groupNameAr ?? '—'}
                    </strong>
                    <span className="text-[11px] text-emerald-700 block mt-0.5 font-medium">
                      {calcResult.isClientSpecific
                        ? t(['Client-Specific Rate', 'سعر خاص بالعميل'])
                        : t(['Global Default Rate', 'سعر عام مشترك'])}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
                      {t(['DESTINATION', 'الوجهة المحسوبة'])}
                    </span>
                    <strong className="text-sm font-bold text-text-strong block">
                      {calcGov}
                      {calcCity ? ` · ${calcCity}` : ''}
                      {calcTown ? ` · ${calcTown}` : ''}
                    </strong>
                    <span className="text-[11px] text-emerald-700 block mt-0.5 font-medium">
                      {calcResult.locationLevel === 'town'
                        ? t(['Matched at Town Level (أدق تحديد)', 'تطابق على مستوى الحي'])
                        : calcResult.locationLevel === 'city_region'
                        ? t(['Matched at City Level', 'تطابق على مستوى المدينة'])
                        : t(['Matched at Governorate Level', 'تطابق على مستوى المحافظة'])}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
                      {t(['WEIGHT & INCREMENTS', 'الوزن والزيادات'])}
                    </span>
                    <strong className="text-sm font-bold text-text-strong block">
                      {calcWeight} kg
                    </strong>
                    <span className="text-[11px] text-emerald-700 block mt-0.5 font-medium">
                      {calcResult.increments ? `+${calcResult.increments} increment(s)` : 'Base weight included'}
                    </span>
                  </div>
                </div>

                <div className="text-start md:text-end pt-2 md:pt-0 border-t md:border-t-0 border-emerald-200 w-full md:w-auto">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
                    {t(['CLIENT SHIPPING COST', 'سعر الشحن للعميل'])}
                  </span>
                  <div className="text-3xl font-extrabold text-emerald-700 leading-none">
                    ${Number(calcResult.amount).toFixed(2)}{' '}
                    <span className="text-xs font-semibold text-emerald-800">{calcResult.currency}</span>
                  </div>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Guided 4-Step Drawer (Add / Edit Group) */}
      <Drawer
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        size="lg"
        className="w-full max-w-[700px] flex flex-col"
        title={
          <div className="border-b border-border-subtle pb-3">
            <h2 className="text-xl font-bold text-text-strong">
              {editingId === 'new'
                ? t(['Add rate group', 'إضافة مجموعة أسعار'])
                : t(['Edit rate group', 'تعديل مجموعة أسعار'])}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {t([
                'Create a delivery price and choose where it applies.',
                'حدد سعر الشحن واختر المناطق التي يُطبق عليها بدقة.',
              ])}
            </p>

            {/* Stepper Header */}
            <div className="flex items-center gap-1 sm:gap-2 mt-4 overflow-x-auto pb-1 text-xs">
              {[
                { step: 1, labelEn: 'Rate details', labelAr: 'تفاصيل السعر' },
                { step: 2, labelEn: 'Destinations', labelAr: 'الوجهات' },
                { step: 3, labelEn: 'Weight policy', labelAr: 'سياسة الوزن' },
                { step: 4, labelEn: 'Review', labelAr: 'المراجعة' },
              ].map(({ step, labelEn, labelAr }, idx, arr) => {
                const isActive = currentStep === step;
                const isCompleted = currentStep > step;
                return (
                  <div key={step} className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (step < currentStep) setCurrentStep(step);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-semibold transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : isCompleted
                          ? 'text-emerald-700 cursor-pointer'
                          : 'text-text-muted cursor-default'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isActive
                            ? 'bg-brand-600 text-white'
                            : isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isCompleted ? '✓' : step}
                      </span>
                      <span>{t([labelEn, labelAr])}</span>
                    </button>
                    {idx < arr.length - 1 ? (
                      <span className="text-slate-300">→</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3 w-full border-t border-border-subtle pt-3">
            <Button
              variant="secondary"
              onClick={() => {
                if (currentStep > 1) setCurrentStep((s) => s - 1);
                else setEditingId(null);
              }}
            >
              {currentStep > 1 ? t(['← Back', '← السابق']) : t(['Cancel', 'إلغاء'])}
            </Button>

            <div className="flex items-center gap-2">
              {currentStep < 4 ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    if (currentStep === 1) {
                      if (!nameAr.trim()) {
                        toast.error(t(['Arabic name is required.', 'الاسم بالعربية مطلوب.']));
                        return;
                      }
                      if (!baseRate || Number(baseRate) < 0) {
                        toast.error(t(['Enter a valid base delivery rate.', 'أدخل سعر توصيل أساسي صالح.']));
                        return;
                      }
                      setCurrentStep(2);
                    } else if (currentStep === 2) {
                      if (selectedLocations.length === 0) {
                        toast.error(t(['Select at least one destination.', 'اختر وجهة واحدة على الأقل.']));
                        return;
                      }
                      setCurrentStep(3);
                    } else if (currentStep === 3) {
                      setCurrentStep(4);
                    }
                  }}
                >
                  <span>
                    {currentStep === 1
                      ? t(['Next: Destinations →', 'التالي: الوجهات →'])
                      : currentStep === 2
                      ? t(['Next: Weight policy →', 'التالي: سياسة الوزن →'])
                      : t(['Review group →', 'مراجعة المجموعة →'])}
                  </span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={saveGroup.isPending}
                  onClick={() => saveGroup.mutate(false)}
                >
                  {saveGroup.isPending
                    ? t(['Saving…', 'جارٍ الحفظ…'])
                    : t(['Save rate group', 'حفظ مجموعة الأسعار'])}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-3">
          {/* STEP 1: Rate details */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-enter">
              <div>
                <h3 className="text-base font-bold text-text-strong">
                  {t(['Rate details', 'تفاصيل السعر'])}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {t([
                    'Give this group a name your team understands. The name does not determine its geographic coverage.',
                    'امنح المجموعة اسماً واضحاً لفريقك. الاسم للتنظيم ولا يحدد التغطية الجغرافية.',
                  ])}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {t(['Group name (Arabic)', 'اسم المجموعة (بالعربية)'])} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                    placeholder="مثال: ريف حلب، أو دمشق المركز"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {t(['Group name (English, optional)', 'اسم المجموعة (بالإنجليزية، اختياري)'])}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                    placeholder="e.g. Aleppo Rural"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {t(['Client Scope', 'نطاق التسعير'])}
                  </label>
                  <select
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                    value={drawerCompanyId}
                    onChange={(e) => setDrawerCompanyId(e.target.value)}
                  >
                    <option value="">{t(['Global Default (All Clients)', 'عام لكافة العملاء (افتراضي)'])}</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {t(['Status', 'الحالة'])}
                  </label>
                  <select
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                    value={active ? 'active' : 'inactive'}
                    onChange={(e) => setActive(e.target.value === 'active')}
                  >
                    <option value="active">{t(['Active', 'نشطة'])}</option>
                    <option value="inactive">{t(['Inactive', 'متوقفة'])}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {t(['Base delivery rate', 'سعر التوصيل الأساسي'])} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                    value={baseRate}
                    onChange={(e) => setBaseRate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    {t(['Area Category', 'تصنيف المنطقة'])}
                  </label>
                  <select
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                    value={areaCategory}
                    onChange={(e) => setAreaCategory(e.target.value as any)}
                  >
                    <option value="region">{t(['Main Region / City (مدينة رئيسية)', 'منطقة رئيسية'])}</option>
                    <option value="rural">{t(['Rural / Remote (ريف / بعيد)', 'ريف'])}</option>
                    <option value="mixed">{t(['Mixed (مختلط)', 'مختلط'])}</option>
                    <option value="custom">{t(['Custom (مخصص)', 'مخصص'])}</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-blue-800 flex items-start gap-2">
                <span className="font-bold text-sm">ⓘ</span>
                <p>
                  {t([
                    'This is the client-facing shipping charge. Carrier names and carrier costs are managed separately and never appear in the client portal.',
                    'هذا هو المبلغ الذي يُحسب على العميل للشحن. أسماء وتكاليف شركات الشحن تدار بشكل منفصل تماماً ومحجوبة عن بوابة العميل.',
                  ])}
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Choose Destinations */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-enter">
              <div>
                <h3 className="text-base font-bold text-text-strong">
                  {t(['Choose destinations', 'تحديد الوجهات والمواقع'])}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {t([
                    'Select a whole governorate, a city, or specific neighborhoods. A more specific rate overrides a broader one.',
                    'اختر كامل المحافظة، أو مدناً ومناطق بعينها، أو أحياء محددة. التحديد الأدق يلغي التحديد الأعم دائماً.',
                  ])}
                </p>
              </div>

              {/* Selected Chips Box */}
              <div className="border border-border-subtle rounded-xl p-3 bg-surface-sunken/40">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted mb-2">
                  <span>
                    {t(['Selected destinations', 'الوجهات المختارة'])} ({selectedLocations.length})
                  </span>
                  {selectedLocations.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearAllSelections}
                      className="text-red-600 hover:text-red-700 font-semibold"
                    >
                      {t(['Clear all', 'مسح الكل'])}
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                  {selectedLocations.length === 0 ? (
                    <span className="text-xs text-text-muted italic py-1">
                      {t(['No destinations selected yet.', 'لم يتم اختيار وجهات بعد.'])}
                    </span>
                  ) : (
                    selectedLocations.map((loc) => (
                      <span
                        key={loc.key}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                      >
                        <span>{formatLocationLabel(loc)}</span>
                        <button
                          type="button"
                          onClick={() => removeLocationChip(loc.key)}
                          className="text-emerald-700 hover:text-emerald-900 font-bold"
                          title={t(['Remove', 'حذف'])}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder={t([
                    'Search governorate, city, or neighborhood…',
                    'ابحث عن محافظة، أو مدينة، أو حي…',
                  ])}
                  className="w-full rounded-lg border border-border-subtle bg-white px-3.5 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                />
                {locationSearch ? (
                  <button
                    type="button"
                    onClick={() => setLocationSearch('')}
                    className="absolute end-3 top-2.5 text-xs text-text-muted hover:text-text-strong font-bold"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {/* Tree View Layout + Sidebar Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-3 border border-border-subtle rounded-xl max-h-[380px] overflow-y-auto p-2.5 bg-white divide-y divide-border-subtle">
                  {matchingGovs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-text-muted">
                      {t(['No matching locations found.', 'لم يتم العثور على مواقع مطابقة للبحث.'])}
                    </div>
                  ) : (
                    matchingGovs.map((gov) => {
                      const isGovExpanded = expandedGovs.has(gov);
                      const isGovChecked = selectedLocations.some((l) => l.key === `gov:${gov}`);
                      const districts = listDistricts(gov);

                      // Check if any child of this governorate is selected
                      const anyChildSelected = selectedLocations.some(
                        (l) => l.governorate === gov && l.level !== 'governorate',
                      );
                      const isGovIndeterminate = !isGovChecked && anyChildSelected;

                      return (
                        <div key={gov} className="py-1">
                          <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-sunken transition-colors">
                            <button
                              type="button"
                              onClick={() => toggleGovExpand(gov)}
                              className="w-5 text-center text-text-muted hover:text-text-strong font-bold"
                            >
                              {isGovExpanded ? '⌄' : '›'}
                            </button>
                            <input
                              type="checkbox"
                              checked={isGovChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = isGovIndeterminate;
                              }}
                              onChange={() => toggleGovernorateSelection(gov)}
                              className="accent-brand-600 rounded"
                            />
                            <span
                              className="text-xs font-bold text-text-strong cursor-pointer flex-1"
                              onClick={() => toggleGovExpand(gov)}
                            >
                              {gov}
                            </span>
                            <span className="text-[10px] text-text-muted bg-surface-sunken px-1.5 py-0.5 rounded">
                              {districts.length} {t(['cities', 'مدن'])}
                            </span>
                          </div>

                          {/* Expanded Districts */}
                          {isGovExpanded && (
                            <div className="ms-6 border-s border-border-subtle ps-2 py-1 space-y-1">
                              {districts.map((d) => {
                                const cityKey = `city:${gov}:${d}`;
                                const isCityExpanded = expandedCities.has(`${gov}:${d}`);
                                const isCityChecked =
                                  isGovChecked || selectedLocations.some((l) => l.key === cityKey);
                                const neighborhoods = listNeighborhoods(gov, d);

                                const anyTownSelected = selectedLocations.some(
                                  (l) => l.governorate === gov && l.cityRegion === d && l.level === 'town',
                                );
                                const isCityIndeterminate =
                                  !isGovChecked && !isCityChecked && anyTownSelected;

                                return (
                                  <div key={d}>
                                    <div className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-surface-sunken transition-colors">
                                      {neighborhoods.length > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleCityExpand(gov, d)}
                                          className="w-4 text-center text-text-muted hover:text-text-strong"
                                        >
                                          {isCityExpanded ? '⌄' : '›'}
                                        </button>
                                      ) : (
                                        <span className="w-4" />
                                      )}
                                      <input
                                        type="checkbox"
                                        checked={isCityChecked}
                                        ref={(el) => {
                                          if (el) el.indeterminate = isCityIndeterminate;
                                        }}
                                        onChange={() => toggleCitySelection(gov, d)}
                                        className="accent-brand-600 rounded"
                                      />
                                      <span
                                        className="text-xs text-text-strong cursor-pointer flex-1"
                                        onClick={() =>
                                          neighborhoods.length > 0 && toggleCityExpand(gov, d)
                                        }
                                      >
                                        {d}
                                      </span>
                                      {neighborhoods.length > 0 ? (
                                        <span className="text-[10px] text-text-muted">
                                          {neighborhoods.length} {t(['towns', 'أحياء'])}
                                        </span>
                                      ) : null}
                                    </div>

                                    {/* Expanded Towns */}
                                    {isCityExpanded && (
                                      <div className="ms-6 border-s border-border-subtle ps-2 py-0.5 space-y-0.5">
                                        {neighborhoods.map((town) => {
                                          const isTownChecked =
                                            isGovChecked ||
                                            isCityChecked ||
                                            selectedLocations.some(
                                              (l) =>
                                                l.key === `town:${gov}:${d}:${town}` ||
                                                (l.governorate === gov &&
                                                  l.cityRegion === d &&
                                                  l.townNeighborhood === town),
                                            );

                                          return (
                                            <label
                                              key={town}
                                              className="flex items-center gap-2 py-0.5 px-1.5 rounded hover:bg-surface-sunken text-xs text-text-muted cursor-pointer"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isTownChecked}
                                                onChange={() => toggleTownSelection(gov, d, town)}
                                                className="accent-brand-600 rounded"
                                              />
                                              <span>{town}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sidebar Summary Box */}
                <div className="border border-border-subtle rounded-xl p-3.5 bg-surface-sunken/40 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-text-strong uppercase mb-3">
                      {t(['Selection summary', 'ملخص التحديد'])}
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border-subtle pb-1.5">
                        <span className="text-text-muted">{t(['Whole Governorates', 'محافظات كاملة'])}</span>
                        <strong className="text-text-strong font-bold">{selectionStats.govs}</strong>
                      </div>
                      <div className="flex justify-between border-b border-border-subtle pb-1.5">
                        <span className="text-text-muted">{t(['Cities / Regions', 'مدن ومناطق'])}</span>
                        <strong className="text-text-strong font-bold">{selectionStats.cities}</strong>
                      </div>
                      <div className="flex justify-between border-b border-border-subtle pb-1.5">
                        <span className="text-text-muted">{t(['Neighborhoods', 'أحياء وبلدات'])}</span>
                        <strong className="text-text-strong font-bold">{selectionStats.towns}</strong>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-muted leading-relaxed mt-4 italic">
                    {t([
                      'Parent selections automatically include all their descendants unless a more specific override is created.',
                      'تحديد المحافظة أو المدينة يشمل جميع تفرعاتها تلقائياً ما لم يتم إنشاء قاعدة أكثر تحديداً لتجاوزها.',
                    ])}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Weight policy */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-enter">
              <div>
                <h3 className="text-base font-bold text-text-strong">
                  {t(['Weight policy', 'سياسة الوزن والتسعير الإضافي'])}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {t([
                    'Choose whether this group uses the shared global weight policy or customized thresholds.',
                    'حدد ما إذا كانت هذه المجموعة تستخدم سياسة الوزن العامة المشتركة أو عتبات مخصصة.',
                  ])}
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3.5 border border-border-subtle rounded-xl cursor-pointer hover:bg-surface-sunken transition-colors">
                  <input
                    type="radio"
                    name="policyMode"
                    value="default"
                    checked={policyMode === 'default'}
                    onChange={() => setPolicyMode('default')}
                    className="accent-brand-600 mt-1"
                  />
                  <div>
                    <strong className="text-sm font-bold text-text-strong block">
                      {t(['Use system default weight policy (Recommended)', 'استخدام سياسة الوزن العامة (موصى به)'])}
                    </strong>
                    <p className="text-xs text-text-muted mt-0.5">
                      {t([
                        `Standard base threshold of ${baseWeightKg} kg, with +$${incrementCharge} charged for each started ${incrementKg} kg.`,
                        `الوزن الأساسي المشمول ${baseWeightKg} كغ، مع زيادة $${incrementCharge} لكل ${incrementKg} كغ إضافية تبدأ.`,
                      ])}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 border border-border-subtle rounded-xl cursor-pointer hover:bg-surface-sunken transition-colors">
                  <input
                    type="radio"
                    name="policyMode"
                    value="custom"
                    checked={policyMode === 'custom'}
                    onChange={() => setPolicyMode('custom')}
                    className="accent-brand-600 mt-1"
                  />
                  <div>
                    <strong className="text-sm font-bold text-text-strong block">
                      {t(['Custom weight thresholds for this group', 'تخصيص عتبات الوزن لهذه المجموعة'])}
                    </strong>
                    <p className="text-xs text-text-muted mt-0.5">
                      {t([
                        'Define a different included weight or incremental charge for remote or special zones.',
                        'حدد وزناً مشمولاً أو كلفة زيادة مختلفة للمناطق الوعرة أو الخاصة.',
                      ])}
                    </p>
                  </div>
                </label>
              </div>

              {policyMode === 'custom' && (
                <div className="border border-border-subtle rounded-xl p-4 bg-surface-sunken/40 space-y-3">
                  <h4 className="text-xs font-bold text-text-strong uppercase">
                    {t(['Custom weight thresholds', 'عتبات الوزن المخصصة'])}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-text-muted block mb-1">
                        {t(['Included weight (kg)', 'الوزن المشمول (كغ)'])}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong"
                        value={customIncWeight}
                        onChange={(e) => setCustomIncWeight(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-text-muted block mb-1">
                        {t(['Extra increment (kg)', 'شريحة الزيادة (كغ)'])}
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong"
                        value={customStepWeight}
                        onChange={(e) => setCustomStepWeight(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-text-muted block mb-1">
                        {t(['Charge per increment', 'مبلغ الزيادة'])}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-strong"
                        value={customStepCharge}
                        onChange={(e) => setCustomStepCharge(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Live Calculation preview card */}
              <div className="border border-border-subtle rounded-xl p-4 bg-white">
                <h4 className="text-xs font-bold text-text-strong uppercase mb-2">
                  {t(['Example calculation', 'مثال على الاحتساب'])}
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-border-subtle pb-1.5">
                    <span className="text-text-muted">{t(['Base rate', 'السعر الأساسي'])}</span>
                    <strong className="text-text-strong">${Number(baseRate || 0).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between border-b border-border-subtle pb-1.5">
                    <span className="text-text-muted">{t(['Weight included', 'الوزن المشمول'])}</span>
                    <strong className="text-text-strong">
                      Up to {policyMode === 'custom' ? customIncWeight : baseWeightKg} kg
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t(['Additional charge', 'الكلفة الإضافية'])}</span>
                    <strong className="text-text-strong">
                      +${policyMode === 'custom' ? customStepCharge : incrementCharge} per{' '}
                      {policyMode === 'custom' ? customStepWeight : incrementKg} kg started
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review before saving */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-enter">
              <div>
                <h3 className="text-base font-bold text-text-strong">
                  {t(['Review before saving', 'مراجعة المجموعة قبل الحفظ'])}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {t([
                    'Confirm the rate, coverage, and weight policy before persisting to the system.',
                    'تأكد من صحة السعر والمواقع المحددة وسياسة الوزن قبل الاعتماد.',
                  ])}
                </p>
              </div>

              <div className="border border-border-subtle rounded-xl overflow-hidden divide-y divide-border-subtle text-xs bg-white">
                <div className="flex justify-between p-3.5">
                  <span className="text-text-muted">{t(['Group name', 'اسم المجموعة'])}</span>
                  <strong className="text-text-strong text-sm">{nameAr} {nameEn ? `(${nameEn})` : ''}</strong>
                </div>

                <div className="flex justify-between p-3.5">
                  <span className="text-text-muted">{t(['Scope / Ownership', 'نطاق المجموعة'])}</span>
                  <strong>
                    {drawerCompanyId
                      ? companies.find((c) => c.id === drawerCompanyId)?.name ?? 'Client-specific'
                      : t(['Global Default (All Clients)', 'عام (لكافة العملاء)'])}
                  </strong>
                </div>

                <div className="flex justify-between p-3.5">
                  <span className="text-text-muted">{t(['Base rate', 'السعر الأساسي'])}</span>
                  <strong className="text-text-strong text-sm text-emerald-700 font-bold">
                    ${Number(baseRate || 0).toFixed(2)} {currency}
                  </strong>
                </div>

                <div className="flex justify-between p-3.5">
                  <span className="text-text-muted">{t(['Status', 'الحالة'])}</span>
                  <span className={`font-semibold ${active ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {active ? t(['Active', 'نشطة']) : t(['Inactive', 'متوقفة'])}
                  </span>
                </div>

                <div className="flex justify-between p-3.5">
                  <span className="text-text-muted">{t(['Destinations count', 'عدد الوجهات المختارة'])}</span>
                  <strong className="text-text-strong">
                    {selectedLocations.length} {t(['location(s)', 'موقع'])}
                  </strong>
                </div>

                <div className="flex justify-between p-3.5">
                  <span className="text-text-muted">{t(['Weight policy', 'سياسة الوزن'])}</span>
                  <strong className="text-text-strong">
                    {policyMode === 'custom'
                      ? t(['Custom group policy', 'سياسة مخصصة للمجموعة'])
                      : t(['System default policy', 'سياسة النظام العامة'])}
                  </strong>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50/60 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
                <span className="font-bold text-sm">✓</span>
                <p>
                  <b>{t(['Precedence rule reminder:', 'تذكير بقواعد الأسبقية:'])}</b>{' '}
                  {t([
                    'A neighborhood rate overrides a city rate; a city rate overrides a governorate rate. Client-specific rates take precedence over Global rates at the same level.',
                    'سعر الحي يلغي سعر المدينة؛ وسعر المدينة يلغي سعر المحافظة. وسعر العميل يسبق السعر العام عند نفس المستوى الجغرافي.',
                  ])}
                </p>
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* Global Weight Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-bold text-base text-text-strong">
                {t(['System Weight & Currency Settings', 'إعدادات الوزن والعملة العامة للنظام'])}
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-text-muted hover:text-text-strong font-bold"
              >
                ✕
              </button>
            </div>

            <form
              className="space-y-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                saveSettings.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={t(['Currency', 'العملة'])}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
                <TextField
                  label={t(['Base weight included (kg)', 'الوزن الأساسي المشمول (كغ)'])}
                  value={baseWeightKg}
                  onChange={(e) => setBaseWeightKg(e.target.value)}
                  inputMode="decimal"
                />
                <TextField
                  label={t(['Additional increment (kg)', 'شريحة الزيادة (كغ)'])}
                  value={incrementKg}
                  onChange={(e) => setIncrementKg(e.target.value)}
                  inputMode="decimal"
                />
                <TextField
                  label={t(['Charge per increment', 'مبلغ الزيادة'])}
                  value={incrementCharge}
                  onChange={(e) => setIncrementCharge(e.target.value)}
                  inputMode="decimal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <Button variant="secondary" onClick={() => setShowSettingsModal(false)}>
                  {t(['Cancel', 'إلغاء'])}
                </Button>
                <Button variant="primary" type="submit" disabled={saveSettings.isPending}>
                  {saveSettings.isPending ? t(['Saving…', 'جارٍ الحفظ…']) : t(['Save Settings', 'حفظ الإعدادات'])}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
