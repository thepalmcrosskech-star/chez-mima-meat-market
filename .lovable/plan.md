# Portail Salariés Chez Mima

## Ce qui sera visible

- Un nouvel espace `/staff`, séparé de l’administration et du site client, avec uniquement trois rubriques : **Comptoir**, **Commandes** et **Produits**.
- Après connexion, un salarié arrive directement dans cet espace. Il ne peut pas ouvrir les pages d’administration, de livraison ou les réglages sensibles.

## 1. Comptoir

- Recherche et sélection des produits disponibles, avec filtres par rayon.
- Panier de vente au poids ou à la pièce, quantités modifiables et total calculé automatiquement.
- Encaissement en espèces ou par carte, calcul de la monnaie pour les espèces.
- Validation de la vente, affichage d’un ticket imprimable et liste des ventes récentes du comptoir.

## 2. Commandes de l’application

- Reprise de l’écran de commandes existant : recherche, filtres, détail client, articles, montants et changement de statut.
- Attribution d’un livreur et notifications client conservées.
- Le bannissement d’IP et toute modification des prix ou du paiement d’une commande restent réservés à l’administrateur.

## 3. Produits

- Reprise de la gestion existante : ajout, modification, photo, prix, rayon et disponibilité.
- Les salariés peuvent voir les produits masqués afin de les réactiver, sans accéder à la gestion des catégories, bannières ou paramètres.

## 4. Création des accès

- Dans **Admin → Utilisateurs**, ajout d’un bouton **Inviter un salarié** avec nom et e-mail.
- Le salarié reçoit une invitation, choisit son mot de passe, puis est dirigé vers `/staff`.
- Le choix **Salarié** sera aussi disponible dans la gestion des rôles existants.

## Protections et vérifications

- Nouveau rôle protégé `employee`, contrôlé côté serveur pour chaque lecture et modification.
- Les ventes du comptoir seront enregistrées séparément des commandes clients, avec leurs articles et le salarié ayant encaissé.
- Les prix et totaux des ventes seront recalculés côté serveur pour empêcher toute modification depuis le navigateur.
- Tests des droits : un client reste exclu ; un salarié peut gérer uniquement le comptoir, les commandes et les produits ; un administrateur conserve tous ses accès.
- Vérification complète dans le navigateur : invitation, choix du mot de passe, connexion, vente avec ticket, changement de statut et modification de disponibilité.

## Détails techniques

- Ajout des règles de ligne et de fonctions serveur strictement limitées au comptoir et aux opérations autorisées.
- Les montants des commandes clients resteront protégés par le contrôle existant ; seuls le statut et l’attribution du livreur seront ouverts aux salariés.
- Une fonction sécurisée enverra les invitations sans exposer de clé privée dans l’application.
