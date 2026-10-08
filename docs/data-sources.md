# Data sources

Published food–drug interaction databases used to find and cross-check candidate interactions.

Most of their records are *potential* interactions, either text-mined or computationally predicted. So they are never the only evidence for an interaction's severity, summary or advice. Every seeded interaction still needs a drug label, an NIH fact sheet or a peer-reviewed review as its citation. A database paper may be added as an extra `type: study` citation when the database's record for that exact food–drug pair points to that evidence.

We link to these sources and never copy their records or text into `data/`.

| Database | What it contains | Paper | Data | Licence (paper) |
|---|---|---|---|---|
| **FooDrugs** | About 3.4 million potential interactions: about 1.1 million text-mined from scientific documents and clinical trials, about 2.3 million inferred from gene-expression similarity | Lacruz-Pleguezuelos B, et al. *Database* 2023;baad075. [doi:10.1093/database/baad075](https://doi.org/10.1093/database/baad075) · PMID [37951712](https://pubmed.ncbi.nlm.nih.gov/37951712/) | [Zenodo 10.5281/zenodo.6638469](https://doi.org/10.5281/zenodo.6638469) | CC BY 4.0 |
| **FARFOOD** | Interactions predicted from structural similarity between food compounds and drugs; two (lisinopril, bupropion) checked by docking and patient surveys | Nevado-Bulnes AM, et al. *BioData Mining* 2025;18:82. [doi:10.1186/s13040-025-00493-2](https://doi.org/10.1186/s13040-025-00493-2) · PMID [41291847](https://pubmed.ncbi.nlm.nih.gov/41291847/) | Database and app described in the paper | CC BY-NC-ND 4.0 |
| **DDID** (Diet-Drug Interactions Database) | 23,950 interaction records across 1,338 foods/herbs and 1,516 drugs, each graded positive, negative, no effect, harmful or possible, with mechanisms | Hong Y, et al. *Briefings in Bioinformatics* 2024;25(3):bbae212. [doi:10.1093/bib/bbae212](https://doi.org/10.1093/bib/bbae212) · PMID [38711369](https://pubmed.ncbi.nlm.nih.gov/38711369/) | [bddg.hznu.edu.cn/ddid](https://bddg.hznu.edu.cn/ddid/) | CC BY 4.0 |

The licences above apply to the papers. Check each database's own terms before any bulk download or reuse of its data.
