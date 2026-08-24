@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'rap2next demo: Product (projection)'
@Metadata.allowExtensions: true
define root view entity ZR2N_C_Product
  provider contract transactional_query
  as projection on ZR2N_I_Product
{
  key ProductUUID,
      ProductID,
      ProductName,
      Category,
      OriginCountry,
      BaseUnit,
      @Semantics.amount.currencyCode: 'CurrencyCode'
      ListPrice,
      CurrencyCode,
      InStock,
      Description,
      CreatedAt,
      ChangedAt,

      _PriceTier : redirected to composition child ZR2N_C_PriceTier,
      _Currency,
      _Country,
      _Unit
}
