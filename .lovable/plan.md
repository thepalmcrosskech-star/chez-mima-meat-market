# Comptoir salarié Chez Mima

## Fonctionnement sur la tablette

- Un nouvel espace `/staff`, distinct du site client et de l’administration, avec uniquement **Commandes** et **Produits**.
- Le salarié se connecte avec son propre accès et arrive directement sur les commandes de l’application.
- Une nouvelle commande apparaît sans recharger la page ; le salarié peut activer une alerte sonore sur la tablette.

## Parcours d’une commande

1. **À confirmer** : le salarié consulte le client, les articles, les quantités, le total et le mode de retrait ou de livraison.
2. **En préparation** : il confirme puis prépare la commande comme une commande de plateforme.
3. **Ticket de caisse** : il saisit la vente dans Chez Mima Gestion, imprime le ticket, puis prend sa photo depuis la tablette.
4. **Prête** : la photo du ticket est obligatoire avant cette étape. Elle reste visible uniquement par le salarié et l’administrateur.
5. **Livreur** : pour une livraison, le salarié appelle le coursier, enregistre « Livreur appelé », puis remet la commande et le ticket papier au coursier avant d’indiquer le départ en livraison. Aucun livreur interne n’est attribué automatiquement depuis ce comptoir.
6. **Livrée** : la clôture reste disponible pour le suivi interne. Les notifications client existantes sont conservées.

## Produits

- Reprise de la gestion existante : ajout, modification, photo, prix, rayon et disponibilité.
- Les produits masqués restent visibles dans cet espace pour pouvoir être réactivés.
- Aucun accès aux catégories, bannières, réglages, zones, bannissements ou comptes utilisateurs.

## Création des accès

- Dans **Admin → Utilisateurs**, un bouton **Inviter un salarié** envoie une invitation par e-mail.
- Le salarié choisit son mot de passe puis arrive dans `/staff`.
- Le rôle **Salarié** est également disponible pour un compte déjà inscrit.

## Protections et vérifications

- Le rôle `employee` est contrôlé côté serveur ; modifier les données depuis le navigateur ne permet pas d’obtenir d’autres droits.
- Les changements de statut du salarié passent par une fonction limitée au parcours prévu. Prix, paiement, coordonnées et articles restent intouchables.
- La photo du ticket est enregistrée dans un espace privé, avec accès réservé au personnel et à l’administrateur.
- Vérifications : client exclu, salarié limité, administrateur conservé, photo obligatoire avant « Prête », parcours de livraison et gestion des produits.

## Détails techniques

- Nouvelle fonction de contrôle du rôle salarié et règles de ligne limitées aux commandes, articles, clients concernés et produits.
- Colonnes de suivi interne pour la photo du ticket et l’appel au coursier.
- Fonction sécurisée pour les changements de statut et les notifications, stockage privé des tickets, invitation par fonction serveur.
- Abonnement temps réel aux commandes, correctement fermé lorsque l’écran est quitté.
