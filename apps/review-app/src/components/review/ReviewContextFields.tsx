import { Label } from '@/components/ui/label';
import { AD_TYPE_OPTIONS, type AdTypeValue } from '@/lib/ad-type-copy';

const fieldClassName =
  'flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

type ReviewContextFieldsProps = {
  productSku: string;
  adType: AdTypeValue;
  onProductSkuChange: (value: string) => void;
  onAdTypeChange: (value: AdTypeValue) => void;
  disabled?: boolean;
  /** When true, shows batch-level helper copy under ad type. */
  batchMode?: boolean;
};

export function ReviewContextFields({
  productSku,
  adType,
  onProductSkuChange,
  onAdTypeChange,
  disabled,
  batchMode,
}: ReviewContextFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="product-sku" className="font-medium text-ink">
          产品型号
        </Label>
        <input
          id="product-sku"
          type="text"
          className={fieldClassName}
          value={productSku}
          disabled={disabled}
          placeholder="例如 PC201（可选）"
          onChange={(event) => onProductSkuChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          填写后证据判断会用于型号匹配；留空则仅依赖文案与证据自述别名。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ad-type" className="font-medium text-ink">
          内容类型
        </Label>
        <select
          id="ad-type"
          className={fieldClassName}
          value={adType}
          disabled={disabled}
          onChange={(event) => onAdTypeChange(event.target.value as AdTypeValue)}
        >
          {AD_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value || 'unlabeled'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {batchMode && (
          <p className="text-xs text-muted-foreground">对本批次全部文案生效，无需逐行选择。</p>
        )}
      </div>
    </div>
  );
}
