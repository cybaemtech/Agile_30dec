import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Currency, 
  CurrencyConverter, 
  calculateTotalCost, 
  formatCurrency,
  parseCurrencyString 
} from "@/lib/currency-utils";
import { useCurrencyConversion } from "@/hooks/use-currency";

// Form validation schema
const licenseFormSchema = z.object({
  name: z.string().min(1, "License name is required"),
  version: z.string().optional(),
  vendor: z.string().min(1, "Vendor is required"),
  costPerUser: z.number().min(0, "Cost per user must be positive"),
  inputCurrency: z.nativeEnum(Currency),
  numberOfLicenses: z.number().min(1, "Number of licenses must be at least 1"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  expirationDate: z.string().optional(),
});

type LicenseFormValues = z.infer<typeof licenseFormSchema>;

interface LicenseFormProps {
  onSave?: (data: LicenseFormValues & { 
    totalCostInInputCurrency: number;
    totalCostInUSD: number;
  }) => void;
  onCancel?: () => void;
  initialData?: Partial<LicenseFormValues>;
}

export function LicenseForm({ onSave, onCancel, initialData }: LicenseFormProps) {
  const form = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      version: initialData?.version || "",
      vendor: initialData?.vendor || "",
      costPerUser: initialData?.costPerUser || 0,
      inputCurrency: initialData?.inputCurrency || Currency.INR,
      numberOfLicenses: initialData?.numberOfLicenses || 1,
      purchaseDate: initialData?.purchaseDate || new Date().toISOString().split('T')[0],
      expirationDate: initialData?.expirationDate || "",
    },
  });

  // Use the custom hook for currency conversion
  const currencyConversion = useCurrencyConversion({
    costPerUser: form.watch("costPerUser") || 0,
    numberOfLicenses: form.watch("numberOfLicenses") || 1,
    inputCurrency: form.watch("inputCurrency") || Currency.INR,
    outputCurrency: Currency.USD
  });

  const onSubmit = (data: LicenseFormValues) => {
    if (onSave) {
      onSave({
        ...data,
        totalCostInInputCurrency: currencyConversion.totalInInputCurrency,
        totalCostInUSD: currencyConversion.totalInOutputCurrency,
      });
    }
  };

  const handleCostInputChange = (value: string) => {
    // Try to parse currency string first
    const parsed = parseCurrencyString(value);
    if (parsed) {
      form.setValue("costPerUser", parsed.amount);
      form.setValue("inputCurrency", parsed.currency);
    } else {
      // Just set the numeric value
      const numericValue = parseFloat(value) || 0;
      form.setValue("costPerUser", numericValue);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>License Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* License Name */}
          <div className="space-y-2">
            <Label htmlFor="name">License Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Enter license name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Version */}
          <div className="space-y-2">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              {...form.register("version")}
              placeholder="Enter version (optional)"
            />
          </div>

          {/* Vendor */}
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              {...form.register("vendor")}
              placeholder="Enter vendor name"
            />
            {form.formState.errors.vendor && (
              <p className="text-sm text-red-600">{form.formState.errors.vendor.message}</p>
            )}
          </div>

          {/* Cost Per User with Currency Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costPerUser">Cost per User</Label>
              <div className="flex space-x-2">
                <Input
                  id="costPerUser"
                  type="number"
                  step="0.01"
                  {...form.register("costPerUser", { valueAsNumber: true })}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Select
                  value={form.watch("inputCurrency")}
                  onValueChange={(value) => form.setValue("inputCurrency", value as Currency)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Currency.INR}>INR</SelectItem>
                    <SelectItem value={Currency.USD}>USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-gray-600">
                {formatCurrency(form.watch("costPerUser") || 0, form.watch("inputCurrency"))}
              </p>
              {form.formState.errors.costPerUser && (
                <p className="text-sm text-red-600">{form.formState.errors.costPerUser.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberOfLicenses">Number of Licenses</Label>
              <Input
                id="numberOfLicenses"
                type="number"
                min="1"
                {...form.register("numberOfLicenses", { valueAsNumber: true })}
                placeholder="1"
              />
              {form.formState.errors.numberOfLicenses && (
                <p className="text-sm text-red-600">{form.formState.errors.numberOfLicenses.message}</p>
              )}
            </div>
          </div>

          {/* Total Cost Display */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Cost ({form.watch("inputCurrency")}):</span>
              <span className="text-lg font-bold">
                {currencyConversion.formattedInputTotal}
              </span>
            </div>
            {form.watch("inputCurrency") !== Currency.USD && (
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Total Cost (USD):</span>
                <span className="font-medium">
                  {currencyConversion.formattedOutputTotal}
                </span>
              </div>
            )}
            <div className="text-xs text-gray-500">
              Exchange rate: 1 {form.watch("inputCurrency")} = {" "}
              {form.watch("inputCurrency") === Currency.INR 
                ? `$${currencyConversion.exchangeRate.toFixed(4)}`
                : `₹${currencyConversion.exchangeRate.toFixed(2)}`
              }
            </div>
          </div>

          {/* Purchase Date */}
          <div className="space-y-2">
            <Label htmlFor="purchaseDate">Purchase Date</Label>
            <Input
              id="purchaseDate"
              type="date"
              {...form.register("purchaseDate")}
            />
            {form.formState.errors.purchaseDate && (
              <p className="text-sm text-red-600">{form.formState.errors.purchaseDate.message}</p>
            )}
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label htmlFor="expirationDate">Expiration Date</Label>
            <Input
              id="expirationDate"
              type="date"
              {...form.register("expirationDate")}
              placeholder="dd/mm/yyyy"
            />
          </div>

          {/* Form Actions */}
          <div className="flex space-x-4 pt-4">
            <Button type="submit" className="flex-1">
              Save Changes
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Usage example component
export function LicenseFormExample() {
  const handleSave = (data: any) => {
    console.log("License data:", data);
    // Here you would typically save the data to your backend
    // The data includes:
    // - All form fields
    // - totalCostInInputCurrency: the total in the currency the user entered
    // - totalCostInUSD: the total converted to USD for consistent storage
  };

  const handleCancel = () => {
    console.log("Form cancelled");
  };

  return (
    <div className="p-8">
      <LicenseForm 
        onSave={handleSave}
        onCancel={handleCancel}
        initialData={{
          vendor: "StackBlitz",
          costPerUser: 2400,
          inputCurrency: Currency.INR,
          numberOfLicenses: 2,
        }}
      />
    </div>
  );
}