import { pickSilaChildArea, walkSilaAreaHierarchy } from './sila-area.util';

describe('pickSilaChildArea', () => {
  const children = [
    { id: 'prov-child-homs', name_ar: 'حمص', level: 'city', is_leaf: false },
    { id: 'dablan', name_ar: 'الدبلان', level: 'city', is_leaf: true },
    { id: 'armen-south', name_ar: 'حي الأرمن - الجنوبي', level: 'city', is_leaf: true },
    { id: 'armen', name_ar: 'حي الأرمن', level: 'city', is_leaf: true },
    { id: 'city-homs', name_ar: 'مدينة حمص', level: 'neighborhood', is_leaf: false },
  ];

  it('picks the neighbourhood that matches the town, not the province or a longer partial', () => {
    const picked = pickSilaChildArea(children, {
      province: 'حمص',
      city: 'مدينة حمص',
      neighborhood: 'الأرمن',
    });
    expect(picked?.id).toBe('armen');
  });

  it('picks the city when no neighbourhood is set', () => {
    const picked = pickSilaChildArea(children, {
      province: 'حمص',
      city: 'مدينة حمص',
    });
    expect(picked?.id).toBe('city-homs');
  });

  it('splits a combined neighbourhood and still matches the city child', () => {
    const picked = pickSilaChildArea(
      [{ id: 'qamishli', name_ar: 'مركز القامشلي', level: 'city' }],
      { province: 'الحسكة', neighborhood: 'التفاحية - مركز القامشلي' },
    );
    expect(picked?.id).toBe('qamishli');
  });

  it('does not guess a random child when the address does not match', () => {
    expect(
      pickSilaChildArea(children, { province: 'حمص', city: 'حمص' }),
    ).toBeNull();
  });
});

describe('walkSilaAreaHierarchy', () => {
  const tree: Record<string, Array<{ id: string; name_ar: string; level: string; is_leaf?: boolean }>> = {
    hasaka: [
      { id: 'qamishli', name_ar: 'مركز القامشلي', level: 'city' },
      { id: 'hasaka-city', name_ar: 'مركز الحسكة', level: 'city' },
    ],
    qamishli: [
      { id: 'apple', name_ar: 'التفاحية - مركز القامشلي', level: 'neighborhood', is_leaf: true },
    ],
    aleppo: [
      { id: 'jarablus-center', name_ar: 'مركز جرابلس', level: 'city' },
      { id: 'aleppo-city', name_ar: 'مدينة حلب', level: 'city' },
    ],
    'jarablus-center': [
      { id: 'jarablus', name_ar: 'جرابلس', level: 'neighborhood', is_leaf: true },
      { id: 'jarablus-lower', name_ar: 'جرابلس تحتاني', level: 'neighborhood', is_leaf: true },
    ],
  };

  it('walks Qamishli down to the neighbourhood and never returns the province', async () => {
    const result = await walkSilaAreaHierarchy('hasaka', 'province', {
      province: 'الحسكة',
      neighborhood: 'التفاحية - مركز القامشلي',
    }, async (id) => tree[id] ?? []);
    expect(result).toEqual({ areaId: 'apple' });
  });

  it('walks Jarablus free text to the town, not the province', async () => {
    const result = await walkSilaAreaHierarchy('aleppo', 'province', {
      province: 'حلب',
      district: 'حلب جرابلس عند المعبر الشرقي',
    }, async (id) => tree[id] ?? []);
    expect(result).toEqual({ areaId: 'jarablus' });
  });

  it('stays on the city when a child only contains the city name', async () => {
    const tree: Record<string, Array<{ id: string; name_ar: string; level: string; is_leaf?: boolean }>> = {
      'jarablus-city': [
        { id: 'qadi', name_ar: 'القاضي جرابلس', level: 'neighborhood', is_leaf: true },
      ],
    };
    const result = await walkSilaAreaHierarchy(
      'jarablus-city',
      'city',
      { city: 'جرابلس', district: 'حلب جرابلس عند المعبر الشرقي' },
      async (id) => tree[id] ?? [],
      'جرابلس',
    );
    expect(result).toEqual({ areaId: 'jarablus-city' });
  });

  it('still descends from a city to a different neighbourhood token', async () => {
    const result = await walkSilaAreaHierarchy(
      'qamishli',
      'city',
      { neighborhood: 'التفاحية - مركز القامشلي' },
      async (id) => tree[id] ?? [],
      'مركز القامشلي',
    );
    expect(result).toEqual({ areaId: 'apple' });
  });

  it('reports the missing level instead of falling back to the province', async () => {
    const result = await walkSilaAreaHierarchy('hasaka', 'province', {
      province: 'الحسكة',
      city: 'مكان غير موجود',
    }, async (id) => tree[id] ?? []);
    expect(result).toEqual({ missingLevel: 'city' });
  });
});
