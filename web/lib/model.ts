/**
 * The normalized ServiceModel contract — see docs/ARCHITECTURE.md ("Normalized model").
 *
 * This is the ONLY shape the UI (pages/components) is allowed to depend on. Nothing in
 * app/ may import @sap-ux/* types directly — the metadata layer (lib/metadata.ts) is the
 * sole place that talks to the SAP annotation converter and translates its output into
 * this neutral, framework-agnostic model.
 */

export interface ServiceModel {
  serviceUrl: string;
  entities: EntityModel[];
}

export interface EntityModel {
  set: string; // EntitySet name, e.g. "Travel"
  typeName: string; // EntityType name
  keys: string[];
  properties: PropertyModel[]; // all structural properties
  columns: ColumnModel[]; // UI.LineItem -> list columns (fallback: first 6 props)
  selectionFields: string[]; // UI.SelectionFields -> filter bar
  headerInfo?: {
    typeName: string;
    typeNamePlural: string;
    titlePath?: string;
    descriptionPath?: string;
  };
  facets: FacetModel[]; // resolved object-page sections
  navsToMany: { name: string; targetSet?: string }[];
}

export interface PropertyModel {
  name: string;
  label: string;
  type: string;
  nullable: boolean;
  maxLength?: number;
}

export interface ColumnModel {
  path: string;
  label: string;
  type: string;
}

export type FacetModel =
  | { kind: "group"; label: string; fields: ColumnModel[] } // ReferenceFacet -> FieldGroup
  | { kind: "table"; label: string; nav: string; columns: ColumnModel[] }; // nav/@UI.LineItem
