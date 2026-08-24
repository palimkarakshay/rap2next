* Local handler — empty instance-authorization = no restrictions (demo only!)
* Put real authorization logic here before any production use.
CLASS lhc_product DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS get_instance_authorizations FOR INSTANCE AUTHORIZATION
      IMPORTING keys REQUEST requested_authorizations FOR product RESULT result.
ENDCLASS.

CLASS lhc_product IMPLEMENTATION.

  METHOD get_instance_authorizations.
  ENDMETHOD.

ENDCLASS.
