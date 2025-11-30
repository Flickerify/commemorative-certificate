# Capability: Compatibility Engine

Rule-based compatibility evaluation engine supporting JSONLogic rules, multi-state verdicts, and configurable policies.

**Storage**: Rules, policies, and overrides are stored in PlanetScale. Evaluation is performed via Next.js API routes. Results are cached in PlanetScale and synced to Convex for frontend display.

## ADDED Requirements

### Requirement: Feature Rules

The system SHALL support JSONLogic-based feature rules for compatibility evaluation.

#### Scenario: Create feature rule
- **GIVEN** a public page with linked source and target datasets
- **WHEN** the user creates a feature rule:
  ```json
  {
    "name": "Battery Voltage Valid",
    "required": true,
    "weight": 1,
    "category": "Sensors",
    "logic": {
      "and": [
        { "var": "source.batteryAvailable" },
        { ">=": [{ "var": "source.batteryVoltage" }, 0] },
        { "<=": [{ "var": "source.batteryVoltage" }, 15] }
      ]
    }
  }
  ```
- **THEN** the system MUST validate the JSONLogic syntax
- **AND** store the rule with `pageId` and `organizationId` scope

#### Scenario: Rule validation
- **GIVEN** a JSONLogic expression
- **WHEN** validation is performed
- **THEN** the system MUST verify:
  - Valid JSONLogic operators are used
  - Referenced variables exist in source or target schema
  - No infinite loops or unsafe operations

#### Scenario: Rule limit by tier
- **GIVEN** an organization with `planTier: personal` (10 rule limit)
- **AND** a page with 10 existing rules
- **WHEN** the user attempts to add an 11th rule
- **THEN** the system MUST reject with "Rule limit reached (10/10)"

---

### Requirement: Rule Evaluation

The system SHALL evaluate feature rules against source-target pairs.

#### Scenario: Evaluate single rule
- **GIVEN** a feature rule with JSONLogic `{"var": "source.fuelAvailable"}`
- **AND** a source row with `{fuelAvailable: true}`
- **AND** a target row
- **WHEN** the rule is evaluated with context `{source, target}`
- **THEN** the result MUST be `true`

#### Scenario: Evaluate all rules for a pair
- **GIVEN** multiple feature rules for a page
- **AND** a source-target pair
- **WHEN** all rules are evaluated
- **THEN** the system MUST return a map: `{ruleId: boolean, ...}`
- **AND** track which rules passed/failed

#### Scenario: Rule evaluation with missing data
- **GIVEN** a rule referencing `source.optionalField`
- **AND** a source row where `optionalField` is undefined
- **WHEN** the rule is evaluated
- **THEN** the JSONLogic `var` MUST return `null`
- **AND** comparison operations with `null` follow JSONLogic semantics

---

### Requirement: Device Policy

The system SHALL support configurable device policies for per-target verdict calculation.

#### Scenario: Configure device policy
- **GIVEN** a public page
- **WHEN** the user configures the device policy:
  ```json
  {
    "requiredMode": "ANY_REQUIRED_FAIL_IS_0",
    "fullThreshold": 1.0,
    "partialThreshold": 0.4
  }
  ```
- **THEN** the system MUST store the policy on the page record

#### Scenario: Verdict calculation - required failure
- **GIVEN** a device policy with `requiredMode: ANY_REQUIRED_FAIL_IS_0`
- **AND** 5 rules where 2 are `required: true`
- **WHEN** one required rule fails
- **THEN** the device verdict MUST be `0` (incompatible)
- **AND** the reason MUST be `"required-fail"`

#### Scenario: Verdict calculation - full compatibility
- **GIVEN** a device policy with `fullThreshold: 1.0`
- **AND** all required rules pass
- **AND** 100% of optional rules pass (weighted)
- **WHEN** verdict is calculated
- **THEN** the device verdict MUST be `2` (fully compatible)

#### Scenario: Verdict calculation - partial compatibility
- **GIVEN** a device policy with `partialThreshold: 0.4, fullThreshold: 1.0`
- **AND** all required rules pass
- **AND** 60% of optional rule weight passes
- **WHEN** verdict is calculated
- **THEN** the device verdict MUST be `1` (partial)
- **AND** the score MUST be `0.6`

#### Scenario: Verdict calculation - incompatible by score
- **GIVEN** a device policy with `partialThreshold: 0.4`
- **AND** all required rules pass
- **AND** only 20% of optional rule weight passes
- **WHEN** verdict is calculated
- **THEN** the device verdict MUST be `0` (incompatible)
- **AND** the reason MUST be `"low-score"`

---

### Requirement: Selection Policy

The system SHALL support configurable selection policies for aggregate verdicts across all targets.

#### Scenario: Configure selection policy
- **GIVEN** a public page
- **WHEN** the user configures the selection policy:
  ```json
  {
    "aggregate": {
      "mode": "ANY_DEVICE_FULL_IS_COMPATIBLE",
      "elseMode": "ANY_DEVICE_PARTIAL_IS_PARTIAL"
    },
    "recommendation": {
      "strategy": "HIGHEST_VERDICT_THEN_SCORE"
    }
  }
  ```
- **THEN** the system MUST store the policy on the page record

#### Scenario: Selection verdict - any full
- **GIVEN** a selection policy with `mode: ANY_DEVICE_FULL_IS_COMPATIBLE`
- **AND** device verdicts: `[0, 0, 2, 1]` (one full compatible)
- **WHEN** selection verdict is calculated
- **THEN** the selection verdict MUST be `2` (compatible)
- **AND** the recommended device MUST be the one with verdict `2`

#### Scenario: Selection verdict - any partial
- **GIVEN** a selection policy with `elseMode: ANY_DEVICE_PARTIAL_IS_PARTIAL`
- **AND** device verdicts: `[0, 0, 1, 1]` (no full, some partial)
- **WHEN** selection verdict is calculated
- **THEN** the selection verdict MUST be `1` (partial)

#### Scenario: Selection verdict - none compatible
- **GIVEN** device verdicts: `[0, 0, 0, 0]` (all incompatible)
- **WHEN** selection verdict is calculated
- **THEN** the selection verdict MUST be `0`
- **AND** no recommendation is made

#### Scenario: Recommendation tie-breaker
- **GIVEN** multiple devices with verdict `2`
- **AND** recommendation strategy `HIGHEST_VERDICT_THEN_SCORE`
- **WHEN** recommendation is calculated
- **THEN** the device with highest `score` among verdict `2` devices is recommended

---

### Requirement: Manual Overrides

The system SHALL support manual compatibility overrides that take precedence over rules.

#### Scenario: Create override
- **GIVEN** a source row with `keyHash: abc123`
- **AND** a target row with `keyHash: def456`
- **WHEN** the user creates an override:
  ```json
  {
    "sourceKeyHash": "abc123",
    "targetKeyHash": "def456",
    "value": true,
    "note": "Verified by testing team"
  }
  ```
- **THEN** the system MUST store the override

#### Scenario: Override precedence
- **GIVEN** an override setting compatibility to `true` for a source-target pair
- **AND** rules that would result in verdict `0`
- **WHEN** compatibility is evaluated
- **THEN** the override MUST take precedence
- **AND** the device verdict MUST be `2` (force compatible)
- **AND** the reason MUST include `"override"`

#### Scenario: Negative override
- **GIVEN** an override setting compatibility to `false`
- **AND** rules that would result in verdict `2`
- **WHEN** compatibility is evaluated
- **THEN** the device verdict MUST be `0` (force incompatible)

---

### Requirement: Compatibility Evaluation API

The system SHALL provide a Next.js API route to evaluate compatibility for a selection.

#### Scenario: Evaluate compatibility
- **GIVEN** a public page with source/target datasets and rules
- **AND** a selection `{year: 2025, make: "AUDI", model: "Q8", engine: "3.0"}`
- **WHEN** `POST /api/pages/[id]/evaluate` is called
- **THEN** the system MUST:
  1. Find source row matching the selection
  2. Load all target rows
  3. Load rules and policies
  4. Check overrides first
  5. Evaluate rules for each non-overridden pair
  6. Calculate device verdicts
  7. Calculate selection verdict and recommendation
  8. Return structured result

#### Scenario: Evaluation result structure
- **GIVEN** a completed evaluation
- **THEN** the result MUST include:
  ```json
  {
    "selectionKey": "year=2025|make=AUDI|model=Q8|engine=3.0",
    "selectionVerdict": 2,
    "recommendedTargetId": "target_123",
    "targets": [
      { "id": "target_123", "verdict": 2, "score": 0.95 },
      { "id": "target_456", "verdict": 1, "score": 0.6 }
    ],
    "features": [
      { "name": "Battery", "target_123": true, "target_456": true },
      { "name": "Fuel", "target_123": true, "target_456": false }
    ],
    "evaluatedAt": "2025-11-30T12:00:00Z"
  }
  ```

---

### Requirement: Result Caching

The system SHALL cache compatibility results in PlanetScale and sync to Convex for frontend display.

#### Scenario: Cache on first evaluation
- **GIVEN** a selection that has not been evaluated
- **WHEN** evaluation completes
- **THEN** the result MUST be stored in PlanetScale `compat_results` with:
  - `selection_hash`: SHA-256 of selection key
  - `revision_id`: current page revision
  - `page_num`: pagination index
  - `payload_json`: serialized result
- **AND** synced to Convex `resultCache` table for frontend reads

#### Scenario: Return cached result
- **GIVEN** a cached result for a selection+revision
- **WHEN** the same selection is queried via Convex
- **THEN** the system MUST return the cached result from Convex
- **AND** NOT re-evaluate rules

#### Scenario: Cache miss with compute
- **GIVEN** a selection NOT in Convex cache
- **WHEN** the frontend requests results
- **THEN** the system MUST call the API route to evaluate
- **AND** store result in PlanetScale
- **AND** sync to Convex for immediate display

#### Scenario: Cache invalidation
- **GIVEN** cached results for a page
- **WHEN** rules, policies, or data are modified
- **THEN** the page `revision_id` MUST be incremented
- **AND** old cache entries become stale (new queries compute fresh)

#### Scenario: Result pagination
- **GIVEN** a page with 500 targets
- **AND** Convex 1MB document limit
- **WHEN** results are synced to Convex
- **THEN** results MUST be split into pages of ~100 targets each
- **AND** each page stored as separate `resultCache` document

