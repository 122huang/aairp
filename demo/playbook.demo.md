# Health Supplement Review Playbook (Demo)

pack_version: demo-playbook-1.0.0
playbook_id: demo-health-supplement-playbook

## urgency-cta

trigger_keywords: buy now, act now, limited time, hurry, 立即购买
severity_hint: MEDIUM
decision: WARN
guidance: Urgency call-to-action detected. Add offer validity dates or remove pressure language that may mislead consumers.
typical_decision: REVIEW

## unsubstantiated-testimonial

trigger_keywords: clinically proven, doctor recommended, users love
severity_hint: HIGH
decision: REVIEW
guidance: Efficacy or testimonial claim detected. Require substantiation, qualification, or remove absolute wording before publishing.
typical_decision: REVIEW

## before-after-imagery

trigger_keywords: before and after, transformation, 前后对比
severity_hint: LOW
decision: CONDITIONAL
guidance: Before/after or transformation claim detected. Require disclaimers and avoid implying guaranteed outcomes.
typical_decision: CONDITIONAL_PASS
