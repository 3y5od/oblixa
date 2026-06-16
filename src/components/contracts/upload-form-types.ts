import type { UiSelectOption } from "@/components/ui/ui-select";

export const CONTRACT_TYPE_OPTIONS: UiSelectOption[] = [
  { value: "MSA", label: "Master Service Agreement" },
  { value: "SOW", label: "Statement of Work" },
  { value: "NDA", label: "Non-Disclosure Agreement" },
  { value: "SaaS", label: "SaaS Agreement" },
  { value: "Employment", label: "Employment Agreement" },
  { value: "Other", label: "Other" },
];

export interface UploadFormMember {
  value: string;
  label: string;
  email?: string | null;
}

export type FileSelectionNotice = {
  accepted: number;
  duplicate: number;
  skippedType: number;
  skippedSize: number;
};

export type MetadataDraft = {
  title: string;
  counterparty: string;
  ownerId: string;
  contractType: string;
  region: string;
  annualValue: string;
  sourceSystem: string;
  externalReferenceId: string;
};

export const emptyMetadata: MetadataDraft = {
  title: "",
  counterparty: "",
  ownerId: "",
  contractType: "",
  region: "",
  annualValue: "",
  sourceSystem: "",
  externalReferenceId: "",
};

export function fileSelectionKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}
