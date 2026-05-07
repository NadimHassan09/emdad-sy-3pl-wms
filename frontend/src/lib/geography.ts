export interface CountryOption {
  code: string;
  name: string;
  cities: string[];
}

/**
 * Curated short list of countries we operate in. Selecting a country narrows
 * the city dropdown; "Other" falls back to a free-text input.
 */
export const COUNTRIES: CountryOption[] = [
  {
    code: 'SA',
    name: 'Saudi Arabia',
    cities: ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Khobar', 'Taif', 'Tabuk'],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah'],
  },
  {
    code: 'EG',
    name: 'Egypt',
    cities: ['Cairo', 'Alexandria', 'Giza', 'Suez', 'Port Said', 'Mansoura'],
  },
  {
    code: 'KW',
    name: 'Kuwait',
    cities: ['Kuwait City', 'Al Ahmadi', 'Hawalli'],
  },
  {
    code: 'BH',
    name: 'Bahrain',
    cities: ['Manama', 'Muharraq', 'Riffa'],
  },
  {
    code: 'OM',
    name: 'Oman',
    cities: ['Muscat', 'Salalah', 'Sohar'],
  },
  {
    code: 'QA',
    name: 'Qatar',
    cities: ['Doha', 'Al Wakrah', 'Al Rayyan'],
  },
  {
    code: 'JO',
    name: 'Jordan',
    cities: ['Amman', 'Zarqa', 'Irbid', 'Aqaba'],
  },
  {
    code: 'US',
    name: 'United States',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
  },
];

export const OTHER_COUNTRY = 'OTHER';
