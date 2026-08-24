@EndUserText.label : 'rap2next demo: Product price tiers'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #A
@AbapCatalog.dataMaintenance : #RESTRICTED
define table zr2n_aprice {
  key client    : abap.clnt not null;
  key tier_uuid : sysuuid_x16 not null;
  prod_uuid     : sysuuid_x16 not null;
  min_qty       : abap.quan(13,3);
  qty_unit      : abap.unit(3);
  @Semantics.amount.currencyCode : 'zr2n_aprice.currency_code'
  tier_price    : abap.curr(15,2);
  currency_code : abap.cuky;
  valid_from    : abap.dats;
}
