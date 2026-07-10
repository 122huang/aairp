import { DEMO_SA_CATEGORIES, type DemoReviewCountryId, type DemoSaCategoryId } from '@aairp/shared-kernel';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REVIEW_APP_VISIBLE_COUNTRIES } from '@/lib/review-countries';
import { cn } from '@/lib/utils';

type SharedReviewDimensionsProps = {
  countryId: DemoReviewCountryId | '';
  categoryId: DemoSaCategoryId;
  onCountryChange: (value: DemoReviewCountryId) => void;
  onCategoryChange: (value: DemoSaCategoryId) => void;
  disabled?: boolean;
  countryShake?: boolean;
};

export function SharedReviewDimensions({
  countryId,
  categoryId,
  onCountryChange,
  onCategoryChange,
  disabled,
  countryShake,
}: SharedReviewDimensionsProps) {
  const countrySelected = countryId !== '';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={cn('space-y-2', countryShake && 'animate-shake')}>
        <Label className="font-medium text-ink">
          国家 <span className="text-reject">*</span>
        </Label>
        <Select
          value={countryId || undefined}
          onValueChange={(value) => onCountryChange(value as DemoReviewCountryId)}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn('bg-white', countrySelected ? 'border-gray-200' : 'border-orange-300')}
          >
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            {REVIEW_APP_VISIBLE_COUNTRIES.map((country) => (
              <SelectItem key={country.id} value={country.id}>
                {country.id} · {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="font-medium text-ink">品类</Label>
        <Select
          value={categoryId}
          onValueChange={(value) => onCategoryChange(value as DemoSaCategoryId)}
          disabled={disabled}
        >
          <SelectTrigger className="border-gray-200 bg-white">
            <SelectValue placeholder="选择品类" />
          </SelectTrigger>
          <SelectContent>
            {DEMO_SA_CATEGORIES.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
