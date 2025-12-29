import { useState, useEffect, useCallback } from "react";
import { 
  Currency, 
  CurrencyConverter, 
  calculateTotalCost, 
  formatCurrency,
  EXCHANGE_RATES 
} from "@/lib/currency-utils";

interface UseCurrencyConversionProps {
  costPerUser: number;
  numberOfLicenses: number;
  inputCurrency: Currency;
  outputCurrency?: Currency;
}

interface CurrencyConversionResult {
  totalInInputCurrency: number;
  totalInOutputCurrency: number;
  formattedInputTotal: string;
  formattedOutputTotal: string;
  exchangeRate: number;
  convertAmount: (amount: number, from: Currency, to: Currency) => number;
}

/**
 * Custom hook for handling currency conversion in forms
 */
export function useCurrencyConversion({
  costPerUser,
  numberOfLicenses,
  inputCurrency,
  outputCurrency = Currency.USD
}: UseCurrencyConversionProps): CurrencyConversionResult {
  const [totals, setTotals] = useState({
    totalInInputCurrency: 0,
    totalInOutputCurrency: 0
  });

  // Calculate totals whenever inputs change
  useEffect(() => {
    if (costPerUser >= 0 && numberOfLicenses >= 0) {
      const calculated = calculateTotalCost(
        costPerUser,
        inputCurrency,
        numberOfLicenses,
        outputCurrency
      );
      setTotals(calculated);
    }
  }, [costPerUser, numberOfLicenses, inputCurrency, outputCurrency]);

  // Get exchange rate between input and output currencies
  const exchangeRate = inputCurrency === outputCurrency 
    ? 1 
    : inputCurrency === Currency.INR 
      ? EXCHANGE_RATES.INR_TO_USD 
      : EXCHANGE_RATES.USD_TO_INR;

  // Convert any amount between currencies
  const convertAmount = useCallback((amount: number, from: Currency, to: Currency): number => {
    return CurrencyConverter.convert(amount, from, to);
  }, []);

  return {
    totalInInputCurrency: totals.totalInInputCurrency,
    totalInOutputCurrency: totals.totalInOutputCurrency,
    formattedInputTotal: formatCurrency(totals.totalInInputCurrency, inputCurrency),
    formattedOutputTotal: formatCurrency(totals.totalInOutputCurrency, outputCurrency),
    exchangeRate,
    convertAmount
  };
}

/**
 * Hook for managing currency state in forms
 */
interface UseCurrencyStateProps {
  initialCurrency?: Currency;
  initialAmount?: number;
}

interface CurrencyState {
  amount: number;
  currency: Currency;
  setAmount: (amount: number) => void;
  setCurrency: (currency: Currency) => void;
  getAmountInCurrency: (targetCurrency: Currency) => number;
  getFormattedAmount: (targetCurrency?: Currency) => string;
}

export function useCurrencyState({
  initialCurrency = Currency.INR,
  initialAmount = 0
}: UseCurrencyStateProps = {}): CurrencyState {
  const [amount, setAmount] = useState(initialAmount);
  const [currency, setCurrency] = useState(initialCurrency);

  const getAmountInCurrency = useCallback((targetCurrency: Currency): number => {
    return CurrencyConverter.convert(amount, currency, targetCurrency);
  }, [amount, currency]);

  const getFormattedAmount = useCallback((targetCurrency?: Currency): string => {
    const targetCurr = targetCurrency || currency;
    const targetAmount = targetCurrency ? getAmountInCurrency(targetCurrency) : amount;
    return formatCurrency(targetAmount, targetCurr);
  }, [amount, currency, getAmountInCurrency]);

  return {
    amount,
    currency,
    setAmount,
    setCurrency,
    getAmountInCurrency,
    getFormattedAmount
  };
}

/**
 * Hook for form validation with currency conversion
 */
interface UseCurrencyValidationProps {
  maxAmount?: number;
  maxCurrency?: Currency;
  minAmount?: number;
  minCurrency?: Currency;
}

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export function useCurrencyValidation({
  maxAmount,
  maxCurrency = Currency.USD,
  minAmount = 0,
  minCurrency = Currency.USD
}: UseCurrencyValidationProps = {}) {
  const validateAmount = useCallback((
    amount: number, 
    currency: Currency
  ): ValidationResult => {
    // Convert to common currency for comparison (USD)
    const amountInUSD = CurrencyConverter.convert(amount, currency, Currency.USD);
    
    if (minAmount !== undefined) {
      const minInUSD = CurrencyConverter.convert(minAmount, minCurrency, Currency.USD);
      if (amountInUSD < minInUSD) {
        return {
          isValid: false,
          message: `Amount must be at least ${formatCurrency(minAmount, minCurrency)}`
        };
      }
    }

    if (maxAmount !== undefined) {
      const maxInUSD = CurrencyConverter.convert(maxAmount, maxCurrency, Currency.USD);
      if (amountInUSD > maxInUSD) {
        return {
          isValid: false,
          message: `Amount cannot exceed ${formatCurrency(maxAmount, maxCurrency)}`
        };
      }
    }

    return { isValid: true };
  }, [maxAmount, maxCurrency, minAmount, minCurrency]);

  return { validateAmount };
}