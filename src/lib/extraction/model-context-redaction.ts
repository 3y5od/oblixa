import { preprocessContractTextForExtraction } from "@/lib/extraction/preprocess-text";

export const MODEL_CONTEXT_REDACTION_REPLACEMENT = "[redacted from model context]";

const AUTH_HEADER_LINE_RE =
  /^(\s*(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-amz-security-token|x-integration-token|x-inbound-automation-token)\s*:\s*).+$/gim;
const SIGNED_MODEL_CONTEXT_URL_PARAM_RE =
  /([?&](?:token|signature|sig|code|access_token|refresh_token|api_key|key|X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|X-Goog-Signature|X-Goog-Credential|GoogleAccessId|AWSAccessKeyId|Policy)=)[^&#\s]+/gi;
const PROVIDER_TOKEN_RE =
  /\b(?:Bearer\s+[A-Za-z0-9._~+/=-]{8,}|(?:sk|rk)_(?:live|test|proj)_[A-Za-z0-9._-]{8,}|sk-proj-[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9]{48,}|whsec_[A-Za-z0-9._-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/g;
const SENSITIVE_MODEL_CONTEXT_ASSIGNMENT_RE =
  /\b((?:access|refresh|id|api|webhook|oauth|client|private|shared|signing|session|csrf|xsrf|inbound|integration|provider|cookie)[_-]?(?:token|secret|key|code|password|cookie|signature)|(?:password|secret|token|api[_-]?key|private[_-]?url|signed[_-]?url))(\s*[:=]\s*)(?:"[^"\n]{4,}"|'[^'\n]{4,}'|[^\s,;)\]}]{4,})/gi;
const ORG_ASSIGNMENT_RE =
  /\b((?:organization|org|tenant|workspace)[_-]?(?:id|external_id))(\s*[:=]\s*)(?:"?(?:org|tenant|workspace)_[A-Za-z0-9_-]{4,}"?|"?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"?)/gi;
const UNRELATED_ORG_IDENTIFIER_RE = /\b(?:org|tenant|workspace)_[A-Za-z0-9_-]{6,}\b/g;

export function redactModelBoundContractText(contractText: string): string {
  if (!contractText) return contractText;
  return contractText
    .replace(AUTH_HEADER_LINE_RE, `$1${MODEL_CONTEXT_REDACTION_REPLACEMENT}`)
    .replace(SENSITIVE_MODEL_CONTEXT_ASSIGNMENT_RE, `$1$2${MODEL_CONTEXT_REDACTION_REPLACEMENT}`)
    .replace(ORG_ASSIGNMENT_RE, `$1$2${MODEL_CONTEXT_REDACTION_REPLACEMENT}`)
    .replace(SIGNED_MODEL_CONTEXT_URL_PARAM_RE, `$1${MODEL_CONTEXT_REDACTION_REPLACEMENT}`)
    .replace(UNRELATED_ORG_IDENTIFIER_RE, MODEL_CONTEXT_REDACTION_REPLACEMENT)
    .replace(PROVIDER_TOKEN_RE, MODEL_CONTEXT_REDACTION_REPLACEMENT);
}

export function prepareModelBoundContractText(raw: string): string {
  return redactModelBoundContractText(preprocessContractTextForExtraction(raw));
}
