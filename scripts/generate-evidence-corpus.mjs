import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(repoRoot, 'docs/knowledge/evidence-corpus/evidence');
mkdirSync(dir, { recursive: true });

const base = {
  evidence_status: 'production',
  evidence_version: '1.0.0',
  owner: 'compliance-apac@aairp',
  owner_type: 'compliance',
  last_reviewed: '2026-07-01T00:00:00.000Z',
  review_status: 'legal_reviewed',
  confidence_level: 'high',
  case_refs: [],
};

const entries = [
  {
    evidence_id: 'product-certification-scope-verification',
    evidence_type_key: 'certification',
    requirement_scope: 'certification-scope',
    evidence_purpose:
      'Validate that certification evidence scope matches the advertised product category and claimed benefits.',
    summary:
      'Reviewers must confirm certificate scope explicitly covers the product and claims shown in the advertisement.',
    review_guidance:
      'TRIGGER: Product-specific benefit tied to certification mark. ACTION: Compare certificate scope text to SKU and claims. CHECK: Product name, model, category class. ESCALATE IF: Certificate scope is generic or unrelated.',
    evidence_purpose_tags: ['certification-scope'],
    resolves_expected_evidence_types: ['certification'],
    document_ref_spec: {
      ref_kind: 'certification_scope_record',
      id_format: '{issuer}-{cert_number}-scope',
      storage_system: 'KOS',
      example: 'SIRIM-EC-2024-456-scope',
    },
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['certification-claim'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-hsa-certification-marks', 'regulation:th-tisi-certification-mark'],
      rules: ['demo-apac-sa-certification-evidence'],
      skills: ['skill:certification-claim-review'],
      rewrites: ['rewrite:cite-evidence'],
    },
    benchmark_refs: ['AF-009'],
    validation_criteria: {
      checks: [
        'Match certificate product list to advertised SKU or range',
        'Confirm claimed benefit is within certificate scope',
        'Verify market jurisdiction on certificate matches ad market',
      ],
      reject_if: ['Certificate scope excludes advertised product class'],
    },
    tags: ['confidence:high', 'evidence:required', 'certification'],
  },
  {
    evidence_id: 'certification-expiry-validation',
    evidence_type_key: 'certification',
    requirement_scope: 'certification-expiry',
    evidence_purpose:
      'Ensure certification evidence remains valid for the campaign flight dates and review timestamp.',
    summary: 'Certification substantiation must not be expired relative to campaign dates and review date.',
    review_guidance:
      'TRIGGER: Certification mark with visible validity period or registration number. ACTION: Check expiry against campaign schedule. CHECK: Issue date, expiry date, renewal status. ESCALATE IF: Certificate expired before publication.',
    evidence_purpose_tags: ['certification-expiry'],
    resolves_expected_evidence_types: ['certification'],
    document_ref_spec: {
      ref_kind: 'certification_record',
      id_format: '{issuer}-{cert_number}',
      storage_system: 'compliance_dms',
      example: 'TISI-2023-78901',
    },
    validity_window: {
      typical_validity_months: 12,
      renewal_review_trigger: 'annual',
      notes: 'Reviewer confirms instance validity.',
    },
    applicability: {
      countries: ['SG', 'MY', 'TH', 'ID', 'KR'],
      claim_types: ['certification-claim'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:kr-ks-certification-mark', 'regulation:id-sni-certification-mark'],
      rules: ['demo-apac-sa-certification-evidence'],
      skills: ['skill:certification-claim-review'],
    },
    benchmark_refs: ['RC18-004'],
    validation_criteria: {
      checks: [
        'Confirm certificate expiry date is after campaign end date',
        'Verify renewal certificate if within 30-day grace window',
        'Check registration number resolves to active record',
      ],
      reject_if: ['Certificate expired at review date'],
    },
    tags: ['confidence:high', 'evidence:required', 'certification'],
  },
  {
    evidence_id: 'certification-on-ad-legibility',
    evidence_type_key: 'certification',
    requirement_scope: 'certification-legibility',
    evidence_purpose:
      'Require certification marks and registration references to be legible at published ad resolution.',
    summary:
      'On-ad certification marks must be readable and not misleading through distortion or partial display.',
    review_guidance:
      'TRIGGER: Small or stylized certification badge in digital creative. ACTION: Inspect at published resolution. CHECK: Mark clarity, registration number readability. ESCALATE IF: Mark is illegible or altered.',
    evidence_purpose_tags: ['certification-legibility'],
    resolves_expected_evidence_types: ['certification'],
    document_ref_spec: {
      ref_kind: 'certification_record',
      id_format: '{issuer}-{cert_number}',
      storage_system: 'KOS',
      example: 'ISO-9001-ORG-2024',
    },
    applicability: {
      countries: ['SG', 'MY', 'TH', 'AU'],
      claim_types: ['certification-claim'],
      modalities: ['image', 'text'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:au-accc-certification-schemes', 'regulation:jp-jis-certification-mark'],
      rules: ['demo-apac-sa-certification-evidence'],
      skills: ['skill:certification-claim-review'],
      rewrites: ['rewrite:cite-evidence'],
    },
    benchmark_refs: ['AF-010'],
    validation_criteria: {
      checks: [
        'View mark at final published resolution',
        'Confirm registration number is readable if required by regulation',
        'Verify mark is official artwork not recreated',
      ],
      reject_if: ['Mark illegible at published size'],
    },
    tags: ['confidence:high', 'evidence:required', 'certification'],
  },
  {
    evidence_id: 'third-party-certification-body',
    evidence_type_key: 'certification',
    requirement_scope: 'certification-body',
    evidence_purpose:
      'Validate that certification issuer is a recognized third-party body for the target market and claim type.',
    summary: 'Only recognized certification bodies may substantiate third-party certification claims in advertising.',
    review_guidance:
      'TRIGGER: Third-party certification or quality mark claim. ACTION: Verify issuer against recognized body list. CHECK: Issuer name, accreditation status. ESCALATE IF: Self-declared or unrecognized body.',
    evidence_purpose_tags: ['certification-body'],
    resolves_expected_evidence_types: ['certification'],
    document_ref_spec: {
      ref_kind: 'certification_record',
      id_format: '{issuer}-{cert_number}',
      storage_system: 'KOS',
      example: 'HSA-GMP-2024-001',
    },
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['certification-claim'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-hsa-certification-marks'],
      rules: ['demo-apac-sa-certification-evidence'],
      skills: ['skill:certification-claim-review'],
    },
    validation_criteria: {
      checks: [
        'Confirm issuer on recognized body list for market',
        'Verify accreditation body if applicable',
        'Reject self-certified or manufacturer-only marks',
      ],
      reject_if: ['Issuer not recognized for target market'],
      acceptable_issuers: ['HSA', 'SIRIM', 'TISI', 'SNI', 'KS', 'JIS'],
    },
    tags: ['confidence:high', 'evidence:required', 'certification'],
  },
  {
    evidence_id: 'performance-lab-report',
    evidence_type_key: 'lab_report',
    requirement_scope: 'performance-lab-report',
    evidence_purpose:
      'Require laboratory test report substantiation for quantitative performance claims in advertising.',
    summary:
      'Quantitative performance claims require traceable lab test reports with method and conditions disclosed.',
    review_guidance:
      'TRIGGER: Quantitative performance metric in ad copy. ACTION: Request lab report reference. CHECK: Test method, conditions, sample size. ESCALATE IF: Report cannot be traced or conflicts with on-pack label.',
    evidence_purpose_tags: ['performance-lab-report'],
    resolves_expected_evidence_types: ['lab_report'],
    document_ref_spec: {
      ref_kind: 'lab_report',
      id_format: '{lab_id}-{report_number}',
      storage_system: 'compliance_dms',
      example: 'SGS-LR-2024-8821',
    },
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['performance-claim'],
      modalities: ['text'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: [
        'regulation:sg-hsa-efficacy-performance',
        'regulation:au-accc-performance-representations',
      ],
      rules: ['demo-apac-sa-performance-claim'],
      skills: ['skill:performance-claim-review'],
      rewrites: ['rewrite:cite-evidence'],
    },
    benchmark_refs: ['AF-004', 'AF-005'],
    validation_criteria: {
      checks: [
        'Confirm lab is accredited for test type',
        'Match reported metric to ad claim wording',
        'Verify test conditions reflect typical use',
      ],
      reject_if: ['Report predates product formulation change'],
    },
    tags: ['confidence:high', 'evidence:required', 'performance'],
  },
  {
    evidence_id: 'quantitative-claim-lab-report',
    evidence_type_key: 'lab_report',
    requirement_scope: 'quantitative-lab-report',
    evidence_purpose:
      'Substantiate specific numerical performance percentages and duration claims with lab report evidence.',
    summary:
      'Percentage, duration, and capacity numbers in ads require lab reports showing measurement methodology.',
    review_guidance:
      'TRIGGER: Percentage, duration, or capacity number in headline or body. ACTION: Trace number to lab report table. CHECK: Unit, rounding, statistical basis. ESCALATE IF: Number not found in report.',
    evidence_purpose_tags: ['quantitative-lab-report'],
    resolves_expected_evidence_types: ['lab_report'],
    document_ref_spec: {
      ref_kind: 'lab_report',
      id_format: '{lab_id}-{report_number}',
      storage_system: 'KOS',
      example: 'TUV-QA-2024-1192',
    },
    applicability: {
      countries: ['SG', 'MY', 'TH', 'KR'],
      claim_types: ['performance-claim'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:kr-kftc-performance-claims', 'regulation:my-sirim-performance-claims'],
      rules: ['demo-apac-sa-performance-claim', 'demo-apac-sa-absolute-claim'],
      skills: ['skill:performance-claim-review', 'skill:superlative-claim-review'],
      rewrites: ['rewrite:cite-evidence'],
    },
    benchmark_refs: ['PC-007'],
    validation_criteria: {
      checks: [
        'Locate exact figure in lab report',
        'Confirm rounding matches ad presentation',
        'Check sample size supports claim',
      ],
      reject_if: ['Ad figure exceeds report maximum'],
    },
    tags: ['confidence:high', 'evidence:required', 'performance'],
  },
  {
    evidence_id: 'capacity-test-method-evidence',
    evidence_type_key: 'test_method',
    requirement_scope: 'capacity-test-method',
    evidence_purpose: 'Require documented test method for capacity and fill-level performance claims.',
    summary: 'Capacity claims must reference a documented test method aligned with on-pack specifications.',
    review_guidance:
      'TRIGGER: Capacity, volume, or fill-level claim. ACTION: Request test method document. CHECK: Method standard, fill conditions, tolerance. ESCALATE IF: Method differs from on-pack specification.',
    evidence_purpose_tags: ['capacity-test-method'],
    resolves_expected_evidence_types: ['test_method'],
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['performance-claim'],
      modalities: ['text'],
    },
    requirement_level: 'recommended',
    linkage: {
      regulations: ['regulation:th-tisi-performance-claims'],
      rules: ['demo-apac-sa-capacity-claim'],
      skills: ['skill:performance-claim-review'],
      rewrites: ['rewrite:qualify-performance'],
    },
    benchmark_refs: ['AF-005'],
    validation_criteria: {
      checks: [
        'Confirm test method standard is cited',
        'Match capacity unit to on-pack label',
        'Verify fill-level conditions stated in ad or on-pack',
      ],
      reject_if: ['No test method on file'],
    },
    tags: ['confidence:high', 'evidence:recommended', 'performance'],
  },
  {
    evidence_id: 'standardized-test-protocol-reference',
    evidence_type_key: 'test_method',
    requirement_scope: 'standardized-test-protocol',
    evidence_purpose:
      'Reference recognized standardized test protocols supporting performance qualification rewrites.',
    summary:
      'Performance qualification may cite recognized industry test protocols when full lab report is supplementary.',
    review_guidance:
      'TRIGGER: Qualified performance claim referencing test standard. ACTION: Confirm protocol version and applicability. CHECK: Standard body, revision date. ESCALATE IF: Protocol obsolete or inapplicable.',
    evidence_purpose_tags: ['standardized-test-protocol'],
    resolves_expected_evidence_types: ['test_method'],
    applicability: {
      countries: ['SG', 'MY', 'TH', 'AU'],
      claim_types: ['performance-claim'],
      modalities: ['text'],
    },
    requirement_level: 'recommended',
    linkage: {
      regulations: ['regulation:jp-jftc-performance-representations'],
      rules: ['demo-apac-sa-capacity-claim'],
      skills: ['skill:performance-claim-review'],
      rewrites: ['rewrite:qualify-performance'],
    },
    validation_criteria: {
      checks: [
        'Identify cited test standard and version',
        'Confirm standard applies to product category',
        'Cross-check with on-pack specification',
      ],
      reject_if: ['Standard revoked or superseded'],
    },
    tags: ['confidence:medium', 'evidence:recommended', 'performance'],
  },
  {
    evidence_id: 'performance-claim-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'performance-substantiation',
    evidence_purpose: 'General substantiation requirement for efficacy and performance advertising claims.',
    summary:
      'Performance claims require substantiation file demonstrating typical results under disclosed conditions.',
    review_guidance:
      'TRIGGER: Efficacy or performance benefit claim. ACTION: Locate substantiation file. CHECK: Study design, typical results framing. ESCALATE IF: No file or absolute wording unsupported.',
    evidence_purpose_tags: ['performance-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['performance-claim'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-hsa-efficacy-performance', 'regulation:id-bpom-performance-claims'],
      rules: ['demo-apac-sa-performance-claim'],
      skills: ['skill:performance-claim-review'],
      rewrites: ['rewrite:qualify-performance'],
    },
    benchmark_refs: ['AF-004'],
    validation_criteria: {
      checks: [
        'Confirm substantiation file exists',
        'Verify claim wording matches file conclusions',
        'Check typical-use conditions disclosed',
      ],
      reject_if: ['Substantiation file missing'],
    },
    tags: ['confidence:high', 'evidence:required', 'performance'],
  },
  {
    evidence_id: 'absolute-performance-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'absolute-performance',
    evidence_purpose:
      'Substantiation for absolute or omnibus performance claims requiring qualification or removal.',
    summary:
      'Absolute performance claims require substantiation demonstrating the stated outcome under defined conditions.',
    review_guidance:
      'TRIGGER: Absolute words like perfect, always, guaranteed in performance context. ACTION: Review substantiation strength. CHECK: Omnibus wording, testimonial basis. ESCALATE IF: No substantiation for absolute claim.',
    evidence_purpose_tags: ['performance-substantiation', 'efficacy-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['performance-claim', 'superlative-claim'],
      modalities: ['text'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-asasa-substantiation'],
      rules: ['demo-apac-sa-absolute-claim', 'demo-apac-sa-absolute-claim-soft'],
      skills: ['skill:superlative-claim-review', 'skill:performance-claim-review'],
      rewrites: ['rewrite:qualify-performance', 'rewrite:qualify-efficacy'],
    },
    benchmark_refs: ['AF-002', 'AF-006'],
    validation_criteria: {
      checks: [
        'Assess whether substantiation supports absolute wording',
        'Require qualification if only typical results available',
        'Verify testimonial traceability if used',
      ],
      reject_if: ['Absolute claim with no substantiation'],
    },
    tags: ['confidence:high', 'evidence:required', 'superlative'],
  },
  {
    evidence_id: 'capacity-claim-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'capacity-substantiation',
    evidence_purpose: 'Substantiation backing volume and capacity claims against on-pack specifications.',
    summary: 'Capacity substantiation must align advertised volume with packaging label and test conditions.',
    review_guidance:
      'TRIGGER: ml, litre, or capacity figure in ad. ACTION: Compare to on-pack and test file. CHECK: Fill level, tolerance. ESCALATE IF: Ad exceeds labeled capacity.',
    evidence_purpose_tags: ['performance-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['performance-claim'],
      modalities: ['text'],
    },
    requirement_level: 'recommended',
    linkage: {
      regulations: ['regulation:my-sirim-performance-claims'],
      rules: ['demo-apac-sa-capacity-claim'],
      skills: ['skill:performance-claim-review'],
      rewrites: ['rewrite:qualify-performance'],
    },
    benchmark_refs: ['AF-005'],
    validation_criteria: {
      checks: [
        'Match capacity figure to on-pack label',
        'Confirm test fill conditions',
        'Check unit consistency',
      ],
      reject_if: ['Ad capacity exceeds labeled maximum'],
    },
    tags: ['confidence:high', 'evidence:recommended', 'performance'],
  },
  {
    evidence_id: 'health-claim-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'health-substantiation',
    evidence_purpose:
      'Substantiation requirements for permitted health and wellness benefit claims in advertising.',
    summary:
      'Health benefit claims require substantiation aligned with product regulatory classification and permitted claim list.',
    review_guidance:
      'TRIGGER: Health or wellness benefit language on supplement or food ad. ACTION: Check product class and permitted claims. CHECK: Substantiation file, ingredient dosage. ESCALATE IF: Disease or cure implication.',
    evidence_purpose_tags: ['health-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['health-claim'],
      categories: ['health.supplement'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-hsa-supplement-health-claims', 'regulation:my-npra-supplement-health'],
      rules: ['demo-apac-sa-health-implication'],
      skills: ['skill:health-claim-review'],
    },
    benchmark_refs: ['PC-008', 'PC-011'],
    validation_criteria: {
      checks: [
        'Confirm product regulatory category permits claim',
        'Verify substantiation matches ingredient and dosage',
        'Check for prohibited disease wording',
      ],
      reject_if: ['Claim exceeds permitted health claim list'],
    },
    tags: ['confidence:high', 'evidence:required', 'health'],
  },
  {
    evidence_id: 'supplement-health-evidence',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'supplement-health',
    evidence_purpose:
      'Evidence requirements specific to supplement health claims including classification and substantiation alignment.',
    summary: 'Supplement ads making health claims must hold classification-appropriate substantiation on file.',
    review_guidance:
      'TRIGGER: Supplement product with nutritional or functional benefit claim. ACTION: Verify NPRA/HSA classification. CHECK: On-pack label, substantiation dossier. ESCALATE IF: Unregistered supplement or off-label claim.',
    evidence_purpose_tags: ['health-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH', 'ID'],
      claim_types: ['health-claim'],
      categories: ['health.supplement'],
      modalities: ['text'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:id-bpom-supplement-claims', 'regulation:th-fda-supplement-claims'],
      rules: ['demo-apac-sa-health-claim-blocker'],
      skills: ['skill:health-claim-review'],
    },
    benchmark_refs: ['PC-013'],
    validation_criteria: {
      checks: [
        'Confirm supplement registration status',
        'Match claim to approved label wording',
        'Verify substantiation dossier on file',
      ],
      reject_if: ['Product not registered for claimed market'],
    },
    tags: ['confidence:high', 'evidence:required', 'health'],
  },
  {
    evidence_id: 'health-implication-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'health-implication',
    evidence_purpose:
      'Substantiation for implied health benefits on non-health or misclassified product categories.',
    summary:
      'Implied health benefits on general products require substantiation or claim removal per health implication rules.',
    review_guidance:
      'TRIGGER: Healthier, lower sugar, or wellness outcome on non-supplement product. ACTION: Assess product category fit. CHECK: Nutritional substantiation, comparative basis. ESCALATE IF: Implies medicinal effect.',
    evidence_purpose_tags: ['health-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['health-claim'],
      categories: ['sa.*'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-hpa-s7-prohibited-claims', 'regulation:au-tga-complementary-medicines'],
      rules: ['demo-sg-health-forbidden-claim', 'demo-apac-sa-health-implication'],
      skills: ['skill:health-claim-review'],
      rewrites: ['rewrite:remove-health-claim'],
    },
    benchmark_refs: ['PC-008'],
    validation_criteria: {
      checks: [
        'Confirm product category allows implied health framing',
        'Verify nutritional comparison substantiation if used',
        'Check no disease or cure language',
      ],
      reject_if: ['Health implication on prohibited product class'],
    },
    tags: ['confidence:high', 'evidence:required', 'health'],
  },
  {
    evidence_id: 'comparative-claim-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'comparative-substantiation',
    evidence_purpose:
      'Substantiation for comparative advertising claims including baseline product and test method disclosure.',
    summary:
      'Comparative claims require substantiation identifying baseline product, test method, and measurable difference.',
    review_guidance:
      'TRIGGER: Versus, compared to, or better than language. ACTION: Request comparison substantiation file. CHECK: Named baseline, test conditions. ESCALATE IF: Competitor identifiable but test absent.',
    evidence_purpose_tags: ['comparative-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH', 'AU'],
      claim_types: ['comparative-claim'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-asas-comparative-claims', 'regulation:au-accc-comparative-advertising'],
      rules: ['demo-apac-sa-comparative-claim'],
      skills: ['skill:comparative-claim-review'],
      rewrites: ['rewrite:qualify-comparative'],
    },
    benchmark_refs: ['AF-003', 'AF-006'],
    validation_criteria: {
      checks: [
        'Confirm baseline product named in substantiation',
        'Verify test method and conditions disclosed',
        'Check measurable difference stated',
      ],
      reject_if: ['No identifiable comparison baseline'],
    },
    tags: ['confidence:high', 'evidence:required', 'comparative'],
  },
  {
    evidence_id: 'comparative-test-evidence',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'comparative-test',
    evidence_purpose: 'Test evidence supporting side-by-side or chart-based comparative advertising claims.',
    summary:
      'Chart and side-by-side comparisons require test evidence with axis labels and fair comparison methodology.',
    review_guidance:
      'TRIGGER: Comparison chart or side-by-side imagery. ACTION: Inspect test evidence for chart data. CHECK: Axis labels, sample parity. ESCALATE IF: Chart misleading or incomplete.',
    evidence_purpose_tags: ['comparative-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['comparative-claim'],
      modalities: ['image', 'text'],
    },
    requirement_level: 'recommended',
    linkage: {
      regulations: ['regulation:my-masa-comparative-advertising', 'regulation:kr-kftc-comparative-ads'],
      rules: ['demo-apac-sa-comparative-claim'],
      skills: ['skill:comparative-claim-review', 'skill:superlative-claim-review'],
      rewrites: ['rewrite:qualify-comparative'],
    },
    benchmark_refs: ['PC-012'],
    validation_criteria: {
      checks: [
        'Trace chart data to test report',
        'Confirm axis labels and units present',
        'Verify fair comparison sample design',
      ],
      reject_if: ['Chart data unsupported by test file'],
    },
    tags: ['confidence:high', 'evidence:recommended', 'comparative'],
  },
  {
    evidence_id: 'comparative-superiority-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'comparative-superiority',
    evidence_purpose:
      'Substantiation for superiority and ranking claims against competitors or industry standards.',
    summary:
      'Superiority claims require substantiation with named benchmark and statistically supportable difference.',
    review_guidance:
      'TRIGGER: Number one, industry leading, or goes beyond language. ACTION: Require benchmark substantiation. CHECK: Ranking basis, survey or test method. ESCALATE IF: Omnibus superiority without benchmark.',
    evidence_purpose_tags: ['comparative-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH', 'JP'],
      claim_types: ['comparative-claim', 'superlative-claim'],
      modalities: ['text'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:jp-jftc-comparative-ads', 'regulation:th-ocpb-comparative-ads'],
      rules: ['demo-apac-sa-comparative-claim'],
      skills: ['skill:comparative-claim-review', 'skill:superlative-claim-review'],
      rewrites: ['rewrite:qualify-comparative'],
    },
    benchmark_refs: ['AF-006'],
    validation_criteria: {
      checks: [
        'Identify ranking or superiority basis',
        'Confirm benchmark named and verifiable',
        'Check statistical or survey methodology',
      ],
      reject_if: ['Superiority claim without named benchmark'],
    },
    tags: ['confidence:high', 'evidence:required', 'comparative'],
  },
  {
    evidence_id: 'efficacy-superlative-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'efficacy-substantiation',
    evidence_purpose: 'Substantiation for superlative efficacy and testimonial claims requiring qualification.',
    summary:
      'Superlative efficacy claims require substantiation file or must be qualified to typical-results framing.',
    review_guidance:
      'TRIGGER: Clinically proven, guaranteed, miracle, or 100% efficacy language. ACTION: Locate substantiation or require qualification. CHECK: Clinical reference, testimonial verifiability. ESCALATE IF: Cure or miracle language on health product.',
    evidence_purpose_tags: ['efficacy-substantiation'],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH'],
      claim_types: ['superlative-claim'],
      modalities: ['text'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-asasa-substantiation'],
      rules: ['demo-sg-health-superlative'],
      skills: ['skill:superlative-claim-review'],
      rewrites: ['rewrite:qualify-efficacy'],
    },
    benchmark_refs: ['sg-health-warn-superlative'],
    validation_criteria: {
      checks: [
        'Confirm substantiation supports efficacy wording',
        'Require qualification for omnibus results',
        'Verify testimonial attribution if used',
      ],
      reject_if: ['Absolute efficacy with no substantiation'],
    },
    tags: ['confidence:high', 'evidence:required', 'superlative'],
  },
  {
    evidence_id: 'general-advertising-substantiation',
    evidence_type_key: 'substantiation_general',
    requirement_scope: 'general-substantiation',
    evidence_purpose:
      'Cross-cutting substantiation requirement for advertising claims under general fair advertising substantiation rules.',
    summary:
      'Advertisers must hold substantiation for material claims before publication under general substantiation obligations.',
    review_guidance:
      'TRIGGER: Material claim likely to influence purchase decision. ACTION: Confirm substantiation on file before approval. CHECK: Claim materiality, file completeness. ESCALATE IF: No substantiation for material claim.',
    evidence_purpose_tags: [
      'general-substantiation',
      'performance-substantiation',
      'health-substantiation',
      'comparative-substantiation',
      'efficacy-substantiation',
    ],
    resolves_expected_evidence_types: ['substantiation_general'],
    applicability: {
      countries: ['SG', 'MY', 'TH', 'AU', 'JP', 'KR'],
      claim_types: ['performance-claim', 'health-claim', 'comparative-claim', 'superlative-claim'],
      modalities: ['text', 'image'],
    },
    requirement_level: 'required',
    linkage: {
      regulations: ['regulation:sg-asasa-substantiation'],
      rules: ['demo-apac-sa-absolute-claim-soft'],
      skills: ['skill:superlative-claim-review'],
    },
    benchmark_refs: ['AF-002'],
    validation_criteria: {
      checks: [
        'Assess claim materiality',
        'Confirm substantiation file exists before publication',
        'Document substantiation review outcome',
      ],
      reject_if: ['Material claim with no substantiation on file'],
    },
    tags: ['confidence:high', 'evidence:required', 'advertising'],
  },
];

for (const entry of entries) {
  const doc = {
    knowledge_id: `evidence:${entry.evidence_id}`,
    corpus_type: 'evidence',
    ...base,
    ...entry,
  };
  writeFileSync(join(dir, `${entry.evidence_id}.json`), `${JSON.stringify(doc, null, 2)}\n`);
}

console.log(`Wrote ${entries.length} evidence entries (plus certification-mark-substantiation.json manually)`);
