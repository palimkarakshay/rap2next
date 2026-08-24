CLASS zr2n_cl_demo_data DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.

ENDCLASS.


CLASS zr2n_cl_demo_data IMPLEMENTATION.

  METHOD if_oo_adt_classrun~main.

    " demo-data reset: touches ONLY this example's own tables
    DELETE FROM zr2n_aprice.
    DELETE FROM zr2n_aprod.

    " read a released API on purpose: validate our currencies against I_Currency
    SELECT Currency FROM i_currency
      WHERE Currency IN ( 'EUR', 'USD', 'CAD', 'JPY' )
      INTO TABLE @DATA(valid_currencies).
    out->write( |I_Currency check: { lines( valid_currencies ) }/4 currencies found| ).

    TYPES: BEGIN OF ty_seed,
             id       TYPE c LENGTH 10,
             name     TYPE string,
             category TYPE c LENGTH 20,
             country  TYPE c LENGTH 3,
             unit     TYPE c LENGTH 3,
             price    TYPE p LENGTH 8 DECIMALS 2,
             curr     TYPE c LENGTH 5,
             stock    TYPE abap_boolean,
             descr    TYPE string,
           END OF ty_seed,
           ty_seed_tab TYPE STANDARD TABLE OF ty_seed WITH EMPTY KEY.

    DATA(seeds) = VALUE ty_seed_tab(
      ( id = 'HW-1001' name = 'Cordless Drill 18V'      category = 'Power Tools' country = 'DE' unit = 'ST' price = '129.00'  curr = 'EUR' stock = abap_true  descr = 'Brushless 18V drill with two batteries and charger.' )
      ( id = 'HW-1002' name = 'Orbital Sander'          category = 'Power Tools' country = 'DE' unit = 'ST' price = '79.50'   curr = 'EUR' stock = abap_true  descr = 'Random-orbit sander, 125mm pad, dust extraction port.' )
      ( id = 'HW-1003' name = 'Laser Level Cross-Line'  category = 'Measuring'   country = 'JP' unit = 'ST' price = '18900'   curr = 'JPY' stock = abap_false descr = 'Self-leveling cross-line laser, 25m range, IP54.' )
      ( id = 'HW-1004' name = 'Digital Caliper 150mm'   category = 'Measuring'   country = 'JP' unit = 'ST' price = '4200'    curr = 'JPY' stock = abap_true  descr = 'Stainless digital caliper with data output.' )
      ( id = 'FA-2001' name = 'Hex Bolt M8x40 (Box)'    category = 'Fasteners'   country = 'CA' unit = 'BOX' price = '14.90'  curr = 'CAD' stock = abap_true  descr = 'Zinc-plated 8.8 hex bolts, 100 per box.' )
      ( id = 'FA-2002' name = 'Wood Screw 4x50 (Box)'   category = 'Fasteners'   country = 'CA' unit = 'BOX' price = '9.75'   curr = 'CAD' stock = abap_true  descr = 'Torx wood screws, yellow zinc, 200 per box.' )
      ( id = 'SF-3001' name = 'Safety Goggles ClearPro' category = 'Safety'      country = 'US' unit = 'ST' price = '12.99'   curr = 'USD' stock = abap_true  descr = 'Anti-fog, scratch-resistant, EN166 rated.' )
      ( id = 'SF-3002' name = 'Work Gloves Gr. 10'      category = 'Safety'      country = 'US' unit = 'PAA' price = '6.49'   curr = 'USD' stock = abap_false descr = 'Nitrile-coated precision work gloves.' )
      ( id = 'SF-3003' name = 'Ear Defenders 32dB'      category = 'Safety'      country = 'DE' unit = 'ST' price = '21.00'   curr = 'EUR' stock = abap_true  descr = 'Foldable ear defenders, SNR 32 dB.' )
      ( id = 'EL-4001' name = 'LED Work Light 50W'      category = 'Electrical'  country = 'US' unit = 'ST' price = '39.90'   curr = 'USD' stock = abap_true  descr = 'Tripod-mountable 50W LED site light, IP65.' )
      ( id = 'EL-4002' name = 'Cable Drum 25m'          category = 'Electrical'  country = 'DE' unit = 'ST' price = '54.00'   curr = 'EUR' stock = abap_true  descr = '25m rubber cable drum with 4 sockets, IP44.' )
      ( id = 'EL-4003' name = 'Multimeter AutoRange'    category = 'Electrical'  country = 'JP' unit = 'ST' price = '9800'    curr = 'JPY' stock = abap_true  descr = 'CAT III 600V auto-ranging digital multimeter.' ) ).

    DATA products TYPE STANDARD TABLE OF zr2n_aprod WITH EMPTY KEY.
    DATA tiers    TYPE STANDARD TABLE OF zr2n_aprice WITH EMPTY KEY.
    DATA(now) = utclong_current( ).

    LOOP AT seeds INTO DATA(seed).
      TRY.
          DATA(prod_uuid) = cl_system_uuid=>create_uuid_x16_static( ).
        CATCH cx_uuid_error.
          out->write( `UUID generation failed` ).
          RETURN.
      ENDTRY.
      APPEND VALUE zr2n_aprod(
        prod_uuid      = prod_uuid
        product_id     = seed-id
        product_name   = seed-name
        category       = seed-category
        origin_country = seed-country
        base_unit      = seed-unit
        list_price     = seed-price
        currency_code  = seed-curr
        in_stock       = seed-stock
        description    = seed-descr
        created_at     = now
        changed_at     = now ) TO products.

      " 3 price tiers per product: 1 / 10 / 50 units with growing discount
      DO 3 TIMES.
        DATA(factor) = SWITCH decfloat34( sy-index WHEN 1 THEN '1.00'
                                                   WHEN 2 THEN '0.93'
                                                   ELSE '0.85' ).
        TRY.
            DATA(tier_uuid) = cl_system_uuid=>create_uuid_x16_static( ).
          CATCH cx_uuid_error.
            RETURN.
        ENDTRY.
        APPEND VALUE zr2n_aprice(
          tier_uuid     = tier_uuid
          prod_uuid     = prod_uuid
          min_qty       = SWITCH #( sy-index WHEN 1 THEN 1 WHEN 2 THEN 10 ELSE 50 )
          qty_unit      = seed-unit
          tier_price    = seed-price * factor
          currency_code = seed-curr
          valid_from    = cl_abap_context_info=>get_system_date( ) ) TO tiers.
      ENDDO.
    ENDLOOP.

    INSERT zr2n_aprod FROM TABLE @products.
    INSERT zr2n_aprice FROM TABLE @tiers.
    COMMIT WORK.

    out->write( |Inserted { lines( products ) } products and { lines( tiers ) } price tiers.| ).
    out->write( `Now open the rap2next shell — the catalog should render.` ).

  ENDMETHOD.

ENDCLASS.
