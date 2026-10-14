-- MySQL dump 10.13  Distrib 8.0.33, for Linux (x86_64)
--
-- Tiny hand-made excerpt in the exact format of FinalFooDrugs_v4.sql (Zenodo 6638469).
-- mysqldump writes one multi-row INSERT per line, strings quoted with ' and escaped with a backslash.
--

/*!50503 SET NAMES utf8mb4 */;

--
-- Table structure for table `TM_interactions`
--

DROP TABLE IF EXISTS `TM_interactions`;
CREATE TABLE `TM_interactions` (
  `TM_interactions_ID` int NOT NULL,
  `texts_ID` int NOT NULL,
  `start_index` int DEFAULT NULL,
  `end_index` int DEFAULT NULL,
  `food` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `drug` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`TM_interactions_ID`),
  KEY `texts_ID` (`texts_ID`),
  CONSTRAINT `TM_interactions_ibfk_1` FOREIGN KEY (`texts_ID`) REFERENCES `texts` (`texts_ID`) ON DELETE CASCADE,
  CONSTRAINT `TM_interactions_chk_1` CHECK ((`start_index` < `end_index`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `TM_interactions`
--

LOCK TABLES `TM_interactions` WRITE;
/*!40000 ALTER TABLE `TM_interactions` DISABLE KEYS */;
INSERT INTO `TM_interactions` VALUES (0,0,0,116,'Grapefruit','simvastatin'),(1,0,1943,2220,'grapefruit','simvastatin'),(2,0,2289,2392,'grapefruit','simvastatin'),(3,1,10,90,'Grapefruit Juice','Zocor'),(4,2,0,50,'grapefruit','simvastatin'),(5,3,0,50,'GRAPEFRUIT','simvastatin'),(6,7,5,60,'grapefruit juice','simvastatin'),(7,5,0,40,'grapefruit','verapamil'),(8,4,0,40,'grapefruit','verapamil');
INSERT INTO `TM_interactions` VALUES (9,10,0,40,'alcohol','verapamil'),(10,6,0,30,'pomelo','atorvastatin'),(11,6,0,30,'Pomelo','simvastatin'),(12,11,0,30,'Seville orange','simvastatin'),(13,8,0,30,'grapefruit','6\'-acetyl-mystery, X'),(14,9,0,30,'grapefruit','ranolazine'),(15,12,0,30,'grapefruit','atorvastatin'),(16,14,0,30,'grapefruit','simvastatin'),(17,13,0,30,NULL,'simvastatin');
/*!40000 ALTER TABLE `TM_interactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cmap_foodrugs`
--

DROP TABLE IF EXISTS `cmap_foodrugs`;
CREATE TABLE `cmap_foodrugs` (
  `foodrugs_ID` int NOT NULL,
  `gene_ID` int NOT NULL,
  `value` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

LOCK TABLES `cmap_foodrugs` WRITE;
INSERT INTO `cmap_foodrugs` VALUES (241,42260,-85.1486),(241,36114,66.0931),(212,70321,-75.8565);
UNLOCK TABLES;

--
-- Table structure for table `topTable`
--

DROP TABLE IF EXISTS `topTable`;
LOCK TABLES `topTable` WRITE;
INSERT INTO `topTable` VALUES (1,'grapefruit','tadalafil',0.001),(2,'Grapefruit','simvastatin',0.002);
UNLOCK TABLES;

--
-- Table structure for table `texts`
--

DROP TABLE IF EXISTS `texts`;
CREATE TABLE `texts` (
  `texts_ID` int NOT NULL,
  `document` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `link` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `citation` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`texts_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `texts`
--

LOCK TABLES `texts` WRITE;
/*!40000 ALTER TABLE `texts` DISABLE KEYS */;
INSERT INTO `texts` VALUES (0,'Grapefruit juice raises simvastatin levels. It\'s a (known) effect; see "text",\nnew line.','https://pubmed.ncbi.nlm.nih.gov/1000001/','A. Author. Grapefruit and simvastatin. PMID: 1000001.'),(1,'Zocor and grapefruit juice.','https://pubmed.ncbi.nlm.nih.gov/1000002/','B. Author. PMID: 1000002.'),(2,'Grapefruit and simvastatin again.','https://pubmed.ncbi.nlm.nih.gov/1000003/','C. Author. PMID: 1000003.'),(3,'Another grapefruit study.','https://pubmed.ncbi.nlm.nih.gov/1000004/','D. Author. PMID: 1000004.'),(4,'Verapamil trial.','https://clinicaltrials.gov/ct2/show/NCT00000001','Trial NCT00000001'),(5,'Verapamil and grapefruit.','https://pubmed.ncbi.nlm.nih.gov/1000005/','E. Author. PMID: 1000005.');
INSERT INTO `texts` VALUES (6,'Pomelo.','https://pubmed.ncbi.nlm.nih.gov/1000006/','F. Author. PMID: 1000006.'),(7,'Grapefruit juice study.','https://pubmed.ncbi.nlm.nih.gov/1000007/','G. Author. PMID: 1000007.'),(8,'Mystery drug.','https://pubmed.ncbi.nlm.nih.gov/1000008/','H. Author. PMID: 1000008.'),(9,'Ranolazine.','https://pubmed.ncbi.nlm.nih.gov/1000009/','I. Author. PMID: 1000009.'),(10,'Alcohol and verapamil trial.','https://clinicaltrials.gov/ct2/show/NCT00000002','Trial NCT00000002'),(11,'Seville orange.','https://pubmed.ncbi.nlm.nih.gov/1000011/','K. Author. PMID: 1000011.'),(12,'Grapefruit and atorvastatin.','https://pubmed.ncbi.nlm.nih.gov/1000012/','L. Author. PMID: 1000012.'),(13,'Drug label text with a raw CRand a raw LS.','https://www.drugs.com/food-interactions/simvastatin.html',NULL),(14,'Text with no link.',NULL,NULL);
/*!40000 ALTER TABLE `texts` ENABLE KEYS */;
UNLOCK TABLES;
