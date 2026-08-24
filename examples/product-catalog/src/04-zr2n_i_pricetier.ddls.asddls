@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'rap2next demo: Price Tier (interface)'
define view entity ZR2N_I_PriceTier
  as select from zr2n_aprice
  association to parent ZR2N_I_Product as _Product on $projection.ProductUUID = _Product.ProductUUID
{
  key tier_uuid    as TierUUID,
      prod_uuid    as ProductUUID,
      @Semantics.quantity.unitOfMeasure: 'QtyUnit'
      min_qty      as MinQty,
      qty_unit     as QtyUnit,
      @Semantics.amount.currencyCode: 'CurrencyCode'
      tier_price   as TierPrice,
      currency_code as CurrencyCode,
      valid_from   as ValidFrom,

      _Product
}
