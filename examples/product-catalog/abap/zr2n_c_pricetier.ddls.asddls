@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'rap2next demo: Price Tier (projection)'
@Metadata.allowExtensions: true
define view entity ZR2N_C_PriceTier
  as projection on ZR2N_I_PriceTier
{
  key TierUUID,
      ProductUUID,
      @Semantics.quantity.unitOfMeasure: 'QtyUnit'
      MinQty,
      QtyUnit,
      @Semantics.amount.currencyCode: 'CurrencyCode'
      TierPrice,
      CurrencyCode,
      ValidFrom,

      _Product : redirected to parent ZR2N_C_Product
}
