// Currency conversion utilities
export interface ExchangeRates {
  INR_TO_USD: number;
  USD_TO_INR: number;
}

// Current exchange rates (you should update these regularly or fetch from an API)
export const EXCHANGE_RATES: ExchangeRates = {
  INR_TO_USD: 0.012, // 1 INR = ~0.012 USD (approximate, update as needed)
  USD_TO_INR: 83.5,  // 1 USD = ~83.5 INR (approximate, update as needed)
};

export enum Currency {
  INR = 'INR',
  USD = 'USD'
}

export interface CurrencyAmount {
  amount: number;
  currency: Currency;
}

export class CurrencyConverter {
  /**
   * Convert an amount from one currency to another
   */
  static convert(
    amount: number, 
    fromCurrency: Currency, 
    toCurrency: Currency,
    exchangeRates: ExchangeRates = EXCHANGE_RATES
  ): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    if (fromCurrency === Currency.INR && toCurrency === Currency.USD) {
      return amount * exchangeRates.INR_TO_USD;
    }

    if (fromCurrency === Currency.USD && toCurrency === Currency.INR) {
      return amount * exchangeRates.USD_TO_INR;
    }

    throw new Error(`Conversion from ${fromCurrency} to ${toCurrency} is not supported`);
  }

  /**
   * Convert INR to USD
   */
  static inrToUsd(inrAmount: number, exchangeRates: ExchangeRates = EXCHANGE_RATES): number {
    return inrAmount * exchangeRates.INR_TO_USD;
  }

  /**
   * Convert USD to INR
   */
  static usdToInr(usdAmount: number, exchangeRates: ExchangeRates = EXCHANGE_RATES): number {
    return usdAmount * exchangeRates.USD_TO_INR;
  }
}

/**
 * Format currency amount with proper symbol and decimals
 */
export const formatCurrency = (
  amount: number, 
  currency: Currency,
  options: { showSymbol?: boolean; decimals?: number } = {}
): string => {
  const { showSymbol = true, decimals = 2 } = options;
  
  const symbols = {
    [Currency.INR]: '₹',
    [Currency.USD]: '$'
  };

  const formattedAmount = amount.toFixed(decimals);
  
  if (showSymbol) {
    return `${symbols[currency]}${formattedAmount}`;
  }
  
  return formattedAmount;
};

/**
 * Parse currency string to extract amount and currency
 */
export const parseCurrencyString = (currencyString: string): CurrencyAmount | null => {
  // Remove whitespace
  const cleaned = currencyString.trim();
  
  // Match patterns like ₹2400, $100, 2400 INR, 100 USD
  const patterns = [
    /^₹([\d,]+(?:\.\d{1,2})?)$/,  // ₹2400.00
    /^\$([\d,]+(?:\.\d{1,2})?)$/, // $100.00
    /^([\d,]+(?:\.\d{1,2})?)\s*INR$/i, // 2400 INR
    /^([\d,]+(?:\.\d{1,2})?)\s*USD$/i, // 100 USD
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = cleaned.match(patterns[i]);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const currency = i === 0 || i === 2 ? Currency.INR : Currency.USD;
      return { amount, currency };
    }
  }

  return null;
};

/**
 * Calculate total cost with proper currency conversion
 */
export const calculateTotalCost = (
  costPerUser: number,
  inputCurrency: Currency,
  numberOfLicenses: number,
  outputCurrency: Currency = Currency.USD
): { totalInInputCurrency: number; totalInOutputCurrency: number } => {
  const totalInInputCurrency = costPerUser * numberOfLicenses;
  
  const totalInOutputCurrency = CurrencyConverter.convert(
    totalInInputCurrency,
    inputCurrency,
    outputCurrency
  );

  return {
    totalInInputCurrency,
    totalInOutputCurrency
  };
};

/**
 * Get current exchange rates from an API (optional enhancement)
 */
export const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  try {
    // You can replace this with a real API call
    // For example: https://api.exchangerate-api.com/v4/latest/USD
    // const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    // const data = await response.json();
    // return {
    //   INR_TO_USD: 1 / data.rates.INR,
    //   USD_TO_INR: data.rates.INR
    // };
    
    // For now, return default rates
    return EXCHANGE_RATES;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    return EXCHANGE_RATES;
  }
};