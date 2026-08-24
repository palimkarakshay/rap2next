@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'rap2next demo: Product (interface)'
define root view entity ZR2N_I_Product
  as select from zr2n_aprod
  composition [0..*] of ZR2N_I_PriceTier as _PriceTier
  association [0..1] to I_Currency       as _Currency on $projection.CurrencyCode = _Currency.Currency
  association [0..1] to I_Country        as _Country  on $projection.OriginCountry = _Country.Country
  association [0..1] to I_UnitOfMeasure  as _Unit     on $projection.BaseUnit = _Unit.UnitOfMeasure
{
  key prod_uuid      as ProductUUID,
      product_id     as ProductID,
      product_name   as ProductName,
      category       as Category,
      origin_country as OriginCountry,
      base_unit      as BaseUnit,
      @Semantics.amount.currencyCode: 'CurrencyCode'
      list_price     as ListPrice,
      currency_code  as CurrencyCode,
      in_stock       as InStock,
      description    as Description,
      created_at     as CreatedAt,
      changed_at     as ChangedAt,

      _PriceTier,
      _Currency,
      _Country,
      _Unit
}
