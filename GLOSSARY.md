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

**Alias**:
Another name a person might search for a Drug or Food by.
_Avoid_: Synonym, nickname

**Brand name**:
A manufacturer's trade name for a Drug, such as Zocor, recorded as an Alias.
_Avoid_: Trade name

**Food category**:
A display-only label for the kind of Food, such as fruit, dairy or beverage. It plays no part in interactions.
_Avoid_: Food group, food type

## Interactions

**Dataset**:
Every Approved Interaction plus the Drugs, Foods and Mechanisms they refer to. Absence from the Dataset does not mean a combination is safe.
_Avoid_: Database (as a domain term)

**Interaction**:
A documented change in a Drug's action caused by a Food that is worth warning about, with a Severity, Effect, Mechanisms and citations. When and how much to eat belongs in its advice, not in separate terms.
_Avoid_: Contraindication, conflict, warning (as a data term)

**Severity**:
How strongly we advise against combining the Food and Drug: avoid, caution, monitor or minimal. It is advice, not a clinical grade, and it always comes from the primary Citation.
_Avoid_: Risk level, grade

**Effect**:
The direction in which the Food pushes the Drug's action: increases or decreases.
_Avoid_: Impact, outcome

**Mechanism**:
The biological reason a Food changes a Drug's action, naming the responsible compound where known. An Interaction can have several.
_Avoid_: Pathway, cause

**Citation**:
A link to published evidence for an Interaction. Shown to people under the label "Sources".
_Avoid_: Reference, evidence (as nouns)

**Direct interaction**:
An Interaction recorded against the exact Food and Drug being viewed.
_Avoid_: Exact match

**Inherited interaction**:
An Interaction recorded against a Drug class or Food group that applies to one of its members. A Direct interaction for the same pair always takes its place, even when the Direct interaction is milder.
_Avoid_: Via row, group match, fallback

**Example exchange**:
An illustrative patient–pharmacist dialogue attached to an Interaction. Not a real case.
_Avoid_: Testimonial, case, story

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
A specific Drug from the Dataset that a particular person takes. Never a Drug class, and never a drug outside the Dataset.
_Avoid_: Med (outside the UI), prescription

**Medication list**:
The Medications a person has entered. It stays on their device and is never sent anywhere.
_Avoid_: My meds (outside the UI), profile, regimen, prescriptions

**Food warning**:
One Food that interacts with something on a Medication list, shown at its worst Severity with every affected Medication. Shown to people under "Foods to watch".
_Avoid_: Alert, hit
