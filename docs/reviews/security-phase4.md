# Phase 4 Security Audit Report: Template Engine, Drift Remapping, Storage & UI Components

**Auditor**: Independent Application Security Auditor (Unsheet Security)  
**Date**: October 4, 2026  
**Status**: Completed  
**Target Path**: Phase 4 Deliverables (`packages/engine/src/template/**`, `packages/engine/src/drift/remapping.ts`, `apps/web/lib/template/storage.ts`, `apps/web/components/editor/**`, `apps/web/components/template/**`, `apps/web/components/drift/**`)  
**Reference Document**: `docs/THREAT_MODEL.md`

---

## 1. Executive Summary

This security audit evaluates the Phase 4 deliverables of Unsheet against the 14 Mandatory Security Mitigations and the STRIDE threat model defined in `docs/THREAT_MODEL.md`. 

Overall, the architecture demonstrates robust foundational security controls:
- Schema fingerprinting (`packages/engine/src/template/fingerprint.ts`) is deterministic, uses SHA-256 hashing, and strictly enforces Zod validation via `SchemaFingerprintSchema`.
- Spec remapping execution (`packages/engine/src/drift/remapping.ts`) validates output structures through `DashboardSpecSchema.parse()`.
- React components across editor, template management, and drift resolution maintain zero usage of `dangerouslySetInnerHTML`, relying on React's automatic text node escaping to prevent Cross-Site Scripting (XSS).

However, **critical and high severity vulnerabilities** were identified in JSON import parsing, `localStorage` loading persistence, and prototype pollution defenses during template import and remapping operations. Specifically:
1. **Unvalidated JSON Import (`High`)**: `importTemplateJson` in `apps/web/lib/template/storage.ts` uses `JSON.parse` and casts data directly to `Template` without Zod validation or size bounds, bypassing contract safety.
2. **Unvalidated LocalStorage Loading (`Medium`)**: `loadLocalTemplates` loads and parses stored templates without validating items against `TemplateSchema`.
3. **Prototype Pollution via Remapping Dictionaries (`Medium`)**: `applyRemappings` accepts arbitrary key-value remapping records without stripping dangerous keys (`__proto__`, `constructor`, `prototype`).
4. **Lack of Input Size & String Length Bounds on Template Creation (`Low`)**: Template names, descriptions, and tags lack character length limits, exposing the client to UI rendering sluggishness and storage quota exhaustion.

---

## 2. Detailed Findings & Threat Matrix Alignment

### SEC-401: Unvalidated JSON Import Parsing & Missing Size Bounds (High)
- **Component**: `apps/web/lib/template/storage.ts` (`importTemplateJson`)
- **Threat Model Mapping**: **THREAT-04 (Tampering / Type Confusion)** & **THREAT-01 (Denial of Service)**
- **Description**: The function `importTemplateJson(jsonString: string)` parses untrusted JSON via `JSON.parse(jsonString)` and performs a type assertion (`data as Template`) without enforcing file/string size limits (e.g., max 1MB) or validating the parsed object against `TemplateSchema`. 
- **Risk**: An attacker supplying a malformed or maliciously crafted `.unsheet.json` file can inject arbitrary properties (including prototype pollution vectors or unexpected spec structures), causing type confusion, runtime exceptions, or state corruption when loaded into the application.
- **Recommendation**:
  1. Enforce a maximum JSON string length check (e.g., `MAX_TEMPLATE_JSON_BYTES = 1 * 1024 * 1024`).
  2. Validate all imported JSON data strictly using `TemplateSchema.parse(data)` before returning or storing the template.

---

### SEC-402: Unvalidated LocalStorage Hydration (Medium)
- **Component**: `apps/web/lib/template/storage.ts` (`loadLocalTemplates`)
- **Threat Model Mapping**: **THREAT-04 (Tampering / State Corruption)**
- **Description**: `loadLocalTemplates()` reads raw JSON strings from `window.localStorage` and checks only `Array.isArray(parsed)`, returning the parsed array without validating individual template objects against `TemplateSchema`.
- **Risk**: If `localStorage` is tampered with (via XSS or browser extension), corrupted or malformed template records will be loaded into application state, potentially causing rendering crashes or unhandled runtime type errors.
- **Recommendation**:
  - Iterate over parsed template items and validate each item using `TemplateSchema.safeParse()`. Discard or sanitize invalid entries.

---

### SEC-403: Potential Prototype Pollution in Spec Remapping (Medium)
- **Component**: `packages/engine/src/drift/remapping.ts` (`applyRemappings`)
- **Threat Model Mapping**: **THREAT-04 (Elevation of Privilege / Prototype Pollution)**
- **Description**: `applyRemappings(spec, remappings)` accepts an arbitrary `Record<string, string>` dictionary. Property lookups such as `remappings[k] ?? k` or `remappings[key]` are executed directly. If `remappings` contains prototype keys (e.g., `__proto__`, `constructor`, `prototype`), property access on standard JavaScript objects can return built-in prototypes or cause unexpected remapping behavior.
- **Risk**: Although `DashboardSpecSchema.parse()` validates the output spec structure, un-sanitized remapping dictionaries can lead to unexpected key substitution or prototype state leakage.
- **Recommendation**:
  - Explicitly reject or strip forbidden keys (`__proto__`, `constructor`, `prototype`) from the `remappings` input dictionary before processing.

---

### SEC-404: Lack of Input Length Constraints on Template Saving & Naming (Low)
- **Component**: `apps/web/components/template/TemplateSaveModal.tsx` & `TemplateLibraryModal.tsx`
- **Threat Model Mapping**: **THREAT-01 (Denial of Service / Storage Exhaustion)**
- **Description**: Template names, descriptions, categories, and tags accepted from user inputs in `TemplateSaveModal` lack maximum length restrictions (e.g., max 100 chars for names, max 500 chars for descriptions).
- **Risk**: Users can save templates with excessively large strings, consuming `localStorage` quota and potentially degrading UI rendering performance in the template library modal.
- **Recommendation**:
  - Add explicit HTML `maxLength` attributes to inputs/textareas and validate string lengths prior to saving.

---

## 3. Positive Security Controls Verified

1. **Deterministic Schema Fingerprinting**: `packages/engine/src/template/fingerprint.ts` correctly sorts column keys alphabetically, builds a canonical representation, and computes a SHA-256 hash. Output is strictly guarded by `SchemaFingerprintSchema.parse()`.
2. **Zero XSS in UI Components**: All web components (`WidgetConfigModal`, `FilterConfigModal`, `TemplateLibraryModal`, `DriftResolutionModal`, `WidgetActionsToolbar`) render dynamic titles, tags, and column keys exclusively through React JSX text interpolation, ensuring automatic escaping. No `dangerouslySetInnerHTML` is present.
3. **Robust Spec Validation on Remapping**: `applyRemappings` concludes by passing the modified spec through `DashboardSpecSchema.parse()`, guaranteeing that malformed or invalid remappings fail closed.
4. **Safe Download Sanitization**: `TemplateSaveModal` sanitizes downloaded filenames using `.replace(/[^a-z0-9]/g, '_')`, preventing path traversal vulnerabilities.

---

## 4. Action Summary & Remediation Roadmap

| Finding ID | Severity | Category | Target File | Recommended Remediation | Status |
|---|---|---|---|---|---|
| **SEC-401** | High | Tampering / DoS | `apps/web/lib/template/storage.ts` | Add size bounds and Zod validation (`TemplateSchema.parse()`) in `importTemplateJson`. | Open |
| **SEC-402** | Medium | Tampering | `apps/web/lib/template/storage.ts` | Validate each loaded template item with `TemplateSchema.safeParse()` during `loadLocalTemplates`. | Open |
| **SEC-403** | Medium | Prototype Pollution | `packages/engine/src/drift/remapping.ts` | Filter out forbidden keys (`__proto__`, `constructor`, `prototype`) from `remappings`. | Open |
| **SEC-404** | Low | DoS / Storage | `apps/web/components/template/TemplateSaveModal.tsx` | Enforce max length constraints on template name, description, and tags. | Open |

---
*Signed,*  
**Independent Application Security Auditor**
