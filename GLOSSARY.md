# Food-Drug Interaction Map

A public reference showing which foods change how drugs work, why, and how strongly to avoid combining them.

## Catalogue

**Drug**:
A medicine in the catalogue whose effect a food can change.
_Avoid_: Substance, medicine (as a data term)

**Drug class**:
A named set of Drugs that share interactions, such as statins or MAO inhibitors.
_Avoid_: Drug group, drug category

**Food**:
Anything consumed alongside a medicine that can change its effect, including drinks, alcohol, herbal products and supplements, unless that supplement is itself the Drug being affected.
_Avoid_: Substance, consumable, ingredient

**Food group**:
A named set of Foods that share interactions, such as leafy greens or aged cheeses.
_Avoid_: Food class, food category

**Food category**:
A display-only label for the kind of Food, such as fruit, dairy or beverage. It plays no part in interactions.
_Avoid_: Food group, food type

## Interactions

**Interaction**:
A documented change in a Drug's action caused by a Food, with a Severity, Effect, Mechanisms and citations.
_Avoid_: Contraindication, conflict, warning (as a data term)

**Severity**:
How strongly we advise against combining the Food and Drug: avoid, caution, monitor or minimal. It is advice, not a clinical grade.
_Avoid_: Risk level, grade

**Effect**:
The direction in which the Food pushes the Drug's action: increases or decreases.
_Avoid_: Impact, outcome

**Direct interaction**:
An Interaction recorded against the exact Food and Drug being viewed.
_Avoid_: Exact match

**Inherited interaction**:
An Interaction recorded against a Drug class or Food group that applies to one of its members. A Direct interaction for the same pair takes its place.
_Avoid_: Via row, group match, fallback

## Curation

**Reviewed**:
A person has checked an Interaction's summary, Severity and citations against its cited source.

**Approved**:
Reviewed and cleared for publication. Only Approved interactions are shown.
_Avoid_: Published, live

**Pending**:
Not yet Approved.

**Rejected**:
Reviewed and turned down.

## Patients

**Medication**:
A Drug that a particular person takes.
_Avoid_: Med (outside the UI), prescription

**Medication list**:
The Medications a person has entered. It stays on their device and is never sent anywhere.
_Avoid_: My meds (outside the UI), profile, regimen, prescriptions
