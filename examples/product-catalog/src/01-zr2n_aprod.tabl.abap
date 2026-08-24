@EndUserText.label : 'rap2next demo: Products'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #A
@AbapCatalog.dataMaintenance : #RESTRICTED
define table zr2n_aprod {
  key client     : abap.clnt not null;
  key prod_uuid  : sysuuid_x16 not null;
  product_id     : abap.char(10) not null;
  product_name   : abap.char(60);
  category       : abap.char(20);
  origin_country : abap.char(3);
  base_unit      : abap.unit(3);
  @Semantics.amount.currencyCode : 'zr2n_aprod.currency_code'
  list_price     : abap.curr(15,2);
  currency_code  : abap.cuky;
  in_stock       : abap_boolean;
  description    : abap.char(255);
  created_at     : abap.utclong;
  changed_at     : abap.utclong;
}
