# SAE 2.06 Organisation d'un travail d'équipe 

## Contexte du projet (SAE)

Ce projet a été réalisé dans le cadre d’une SAE du BUT Informatique, à l’IUT Lyon 1 – site de Bourg-en-Bresse.

La SAE s’inscrit dans une démarche de **communication et de valorisation du site de Bourg-en-Bresse** (IUT, départements, ville, département de l’Ain), notamment à travers la création de supports multi-supports destinés à des événements tels que les Journées Portes Ouvertes.

Le projet s’inscrit dans un **cadre pédagogique**, avec un objectif de production concrète répondant à un besoin de communication réel.

---

## Présentation du projet

Dans ce contexte, une des réalisations consistait à produire des **cartes étudiantes associées à un site web personnel**, permettant de valoriser les étudiants et leurs compétences.

Afin de structurer et fiabiliser ce processus, j’ai développé un **outil en ligne de commande (CLI) en Node.js** permettant d’automatiser l’ensemble du workflow :

* hébergement des sites étudiants
* récupération des URLs publiques
* génération de QR codes
* génération de cartes étudiantes au format SVG

Ce projet permet de transformer une production initialement manuelle en un **processus automatisé et reproductible**.

---

## Objectifs pédagogiques

* Mettre en œuvre une démarche de projet
* Produire un support de communication concret
* Utiliser des outils graphiques (SVG, templates)
* Automatiser un processus de production
* Structurer un projet logiciel

---

## Travail réalisé

* Développement d’un CLI en Node.js
* Automatisation de l’upload des sites étudiants
* Résolution d’un problème lié aux URLs PinMe
* Parsing de sorties terminal
* Génération de QR codes
* Génération de cartes SVG personnalisées
* Structuration d’un pipeline complet

---

## Fonctionnement du projet

Le script s’appuie sur plusieurs étapes :

### Upload des sites

Les dossiers étudiants sont parcourus automatiquement et uploadés via la commande `pinme upload`.

### Récupération des URLs publiques

La commande `pinme upload` ne retourne qu’une URL de preview.

La solution mise en place consiste à :

* exécuter tous les uploads
* appeler `pinme list`
* parser les résultats pour récupérer les URLs finales

### Génération des QR codes

Chaque URL est convertie en QR code à l’aide de la librairie `qrcode`.

### Génération des cartes

Un template SVG est utilisé pour produire des cartes personnalisées intégrant :

* les informations étudiantes
* le QR code

---

## Organisation du travail

Projet réalisé en groupe dans le cadre de la SAE.

### Membres du groupe

* Yann Madry
* Tristan Muller
* Jolan Berbey

### Répartition du travail

Le projet initial portait sur la conception de supports de communication réalisés de manière collaborative.

Les aspects liés à la conception graphique et au rendu final ont été réalisés en groupe, avec une réflexion commune sur l’utilisation des supports dans un contexte événementiel.

### Contribution personnelle

J’ai pris en charge le développement d’un outil CLI permettant d’automatiser l’ensemble du processus.

Cette contribution inclut :

* l’automatisation des uploads
* la gestion des URLs publiques
* le parsing des résultats PinMe
* la génération des QR codes
* la génération des cartes SVG

Ce travail permet de transformer une production manuelle en un **outil structuré et réutilisable**.

---

## Documents

Les documents associés au projet peuvent être ajoutés dans le dossier `documents/` :

* consignes de la SAE
* notice d’utilisation

---

## Implémentation

Le projet est développé en **Node.js**.

Les principaux éléments du projet sont :

* script principal (CLI)
* template SVG
* fichiers étudiants
* génération des QR codes

---

## Suite du projet

Des évolutions possibles incluent :

* amélioration du parsing des données
* ajout d’une interface graphique
* export vers d’autres formats (PDF)
* amélioration de la configuration du projet

Ces éléments constituent des pistes d’évolution et non des limitations bloquantes.
