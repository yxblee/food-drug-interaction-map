# Data sources

Published food–drug interaction databases used to find and cross-check candidate interactions.

Most of their records are *potential* interactions, either text-mined or computationally predicted. So they are never the only evidence for an interaction's severity, summary or advice. Every seeded interaction still needs a drug label, an NIH fact sheet or a peer-reviewed review as its citation. A database paper may be added as an extra `type: study` citation when the database's record for that exact food–drug pair points to that evidence.

We link to these sources and never copy their records or text into `data/`.

Their grades, such as DDID's positive, negative, no effect, harmful or possible, are never mapped onto our Severity. A reviewer sets Severity from the primary citation. A database's grade only flags which pairs are worth checking.

| Database | What it contains | Paper | Data | Licence (paper) |
|---|---|---|---|---|
| **FooDrugs** | About 3.4 million potential interactions: about 1.1 million text-mined from scientific documents and clinical trials, about 2.3 million inferred from gene-expression similarity | Lacruz-Pleguezuelos B, et al. *Database* 2023;baad075. [doi:10.1093/database/baad075](https://doi.org/10.1093/database/baad075) · PMID [37951712](https://pubmed.ncbi.nlm.nih.gov/37951712/) | [Zenodo 10.5281/zenodo.6638469](https://doi.org/10.5281/zenodo.6638469) | CC BY 4.0 |
| **FARFOOD** | Interactions predicted from structural similarity between food compounds and drugs; two (lisinopril, bupropion) checked by docking and patient surveys | Nevado-Bulnes AM, et al. *BioData Mining* 2025;18:82. [doi:10.1186/s13040-025-00493-2](https://doi.org/10.1186/s13040-025-00493-2) · PMID [41291847](https://pubmed.ncbi.nlm.nih.gov/41291847/) | Database and app described in the paper | CC BY-NC-ND 4.0 |
| **DDID** (Diet-Drug Interactions Database) | 23,950 interaction records across 1,338 foods/herbs and 1,516 drugs, each graded positive, negative, no effect, harmful or possible, with mechanisms | Hong Y, et al. *Briefings in Bioinformatics* 2024;25(3):bbae212. [doi:10.1093/bib/bbae212](https://doi.org/10.1093/bib/bbae212) · PMID [38711369](https://pubmed.ncbi.nlm.nih.gov/38711369/) | [bddg.hznu.edu.cn/ddid](https://bddg.hznu.edu.cn/ddid/) | CC BY 4.0 |

The licences above apply to the papers. Check each database's own terms before any bulk download or reuse of its data.

## Use in the curation pipeline

The curation pipeline proposes Pending interactions from two of these databases. It takes only the food–drug pair and the PubMed IDs of the studies behind it, and cites those studies, not the database.

- **FooDrugs**: data is CC BY 4.0 ([Zenodo record](https://zenodo.org/records/6638469)). Only its text-mined pairs are used, never the ones inferred from gene expression.
  - Run it with `node --run pipeline -- --source foodrugs`. Download `FinalFooDrugs_v4.sql` (about 1.6 GB) into `.cache/pipeline/` first. The dump is streamed line by line, with no MySQL.
  - Only the `TM_interactions` and `texts` tables are read. A pair is kept when its food name equals a catalogue Food name or Alias (ignoring case), its drug name resolves through RxNav to a catalogue Drug's RxNorm CUI, and a PubMed document mentions it. FooDrugs never proposes a new Drug: because the names are text-mined, most uncatalogued ones are not medications, so their records are skipped and the report counts them and lists the most frequent names. Up to 3 PMIDs per pair become `study` Citations, and the draft is checked against their abstracts. The dump has no drug identifiers or confidence scores.
- **DDID**: its CSVs are freely downloadable, but no licence for the data is stated. We use it anyway on the terms in [ADR 0004](adr/0004-ddid-used-without-confirmed-data-licence.md). Only pairs graded harmful or negative are used.
  - Run it with `node --run pipeline -- --source ddid`. Download the "Interaction Information.csv" link from [the DDID download page](https://bddg.hznu.edu.cn/ddid/download/) (about 17 MB) and save it as `.cache/pipeline/DDID-Interaction.csv`.
  - Rows whose `Effect` is `Harmful` or `Negative` (ignoring case) are kept; the other grades (`Possible`, `Positive`, `No Effect`) are dropped. The grade only filters and never becomes Severity. Food matching, RxNav resolution, PMID Citations and the excerpt check are the same as for FooDrugs. Unlike FooDrugs, a drug that is not in the catalogue is proposed as a new Drug. Rows without a numeric PMID are skipped and counted in the report. Some rows cite a study about a different food, which the excerpt check drops.
- **FARFOOD**: not used. Its paper is CC BY-NC-ND and it has no downloadable data.

Downloaded files stay in a local cache and are never committed. Some database records cite a study about a different food, so every draft is checked against its study's abstract.

## Brand names from RxNorm

Brand-name Aliases in `data/drugs/` come from [RxNorm](https://www.nlm.nih.gov/research/umls/rxnorm/), read through the NLM [RxNav REST API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html). The API is free, needs no key or licence, and allows 20 requests per second ([terms of service](https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html)).

> This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.

- Run it with `node --run pipeline -- brands`. It needs no API key and no downloads, and rewrites only the `aliases` of Drug files.
- For each Drug with an `rxnorm` id (never a Drug class), it reads the Brand names (`/rxcui/{id}/related.json?tty=BN`) and keeps those whose only ingredient (`tty=IN`) is that Drug. A combination product's brand, such as Vytorin (ezetimibe and simvastatin), is not an Alias of either ingredient.
- New Brand names are added after the existing Aliases, which are never removed or reordered. A name another Drug already answers to is skipped and printed.
- A Drug without an `rxnorm` id is looked up by name (`/rxcui.json?name=…&search=2`) and printed for a person to confirm. Nothing is written for it.
- RxNorm also lists veterinary products and brands sold only for the skin, eye or ear. Those were dropped on review and are listed in `EXCLUDED` in `apps/pipeline/src/brands.ts`, so a rerun does not bring them back. Review the diff of every run the same way.

## Medication pages from MedlinePlus

The "About this medication (MedlinePlus)" link on a Drug comes from the NLM [MedlinePlus Connect](https://medlineplus.gov/connect/service.html) web service, which maps an RxNorm id to a MedlinePlus drug page. MedlinePlus says you are welcome to link to and display the data its services provide. Content shown on this site is not copied from it: only the link is stored.

> Source: MedlinePlus, National Library of Medicine. NLM is not responsible for and does not endorse this site.

- Run it with `node --run pipeline -- medlineplus`. It needs no key and no downloads, and writes only a `medlineplus` line after the `rxnorm` line of Drug files.
- For each Drug with an `rxnorm` id and no link yet (never a Drug class), it asks `https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=2.16.840.1.113883.6.88&mainSearchCriteria.v.c={rxcui}&knowledgeResponseType=application/json`. The first entry whose link is an https `medlineplus.gov/druginfo/meds/` page is kept, without its tracking query. Connect also returns health-topic pages such as "Statins"; those are ignored.
- A Drug with no such page gets no link and is printed. Nothing is guessed from the name. Drugs without an `rxnorm` id are skipped.
- The link opens in a new tab, and its accessible name says so. It appears in the Explore side panel for a Drug and beside each medication in My meds.

## Labels from DailyMed

The "Read the label (DailyMed)" link on a Drug opens its official US label on [DailyMed](https://dailymed.nlm.nih.gov/dailymed/), the NLM provider of FDA label information. Its [web services v2](https://dailymed.nlm.nih.gov/dailymed/services/v2/) are free and need no key. NLM's web policy lets works of the US government be reproduced in the US and asks for "Source: National Library of Medicine". The services page states no separate licence, so the NLM policy and its disclaimer (NLM does not endorse or warrant) apply. Label text is written by manufacturers and may be copyrighted: only the setid (a UUID) is stored, never label text.

> Source: DailyMed, National Library of Medicine. NLM is not responsible for and does not endorse this site.

When a Drug shows both the MedlinePlus and DailyMed links, one line names both ("MedlinePlus and DailyMed").

- Run it with `node --run pipeline -- dailymed`. It writes only a `dailymed` line after the `medlineplus` line (else after `rxnorm`) of Drug files.
- Verified query (curl, 2026-11-18): `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?rxcui={rxcui}&pagesize=100` returns `data[]` of `{setid, title, spl_version, published_date}` plus `metadata.total_elements`. `/spls.json?rxcui=` is the RxNorm-to-setid lookup; `/rxcuis.json` only lists the rxcuis DailyMed knows and does not return setids. The page link is `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={setid}`.
- Order of preference: (1) the setid cited in the Sources (`citations[].setid`) of the Interactions that reference the Drug, which a person already chose in review; exactly one distinct setid is written, several are printed and nothing is written; (2) only when no Interaction cites a label, the DailyMed lookup below.
- An ingredient rxcui matches every label containing it, repackagers and combination products included (simvastatin: 183). The command therefore writes a setid only when exactly one label matches. With several, it prints each setid and title and writes nothing, for a person to choose by hand (add the line, confirming it is the manufacturer's label for this Drug alone). With none, the Drug is printed and gets no link. Nothing is guessed from the name.
