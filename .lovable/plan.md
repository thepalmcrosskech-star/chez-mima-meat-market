# Nouveau circuit de l’agent de comptoir

## Objectif

Une tablette guide le salarié avec une seule action principale à chaque étape. La caisse reste dans Chez Mima Gestion : la tablette sert à recevoir, préparer, contrôler et suivre les commandes de l’application.

## Circuit commun

1. **Nouvelle commande** : elle apparaît en direct avec une alerte. Le salarié vérifie les articles, les quantités, le client, le total et le mode de livraison ou de retrait.
2. **Accepter la commande** : le salarié l’accepte avant de commencer. Il peut encore l’annuler si la commande est impossible à préparer.
3. **Commencer la préparation** : les articles et les notes du client restent visibles pendant la préparation.
4. **Saisir la vente en caisse** : le salarié utilise le volet Application de Chez Mima Gestion, imprime le ticket, puis le photographie avec la tablette.
5. **Commande prête** : cette étape reste bloquée tant que la photo du ticket n’est pas enregistrée. La photo reste privée.

## Si la commande est livrée

6. **Appeler le coursier** : le salarié appelle le coursier habituel puis enregistre l’appel.
7. **Espèces reçues** : à l’arrivée du coursier, le salarié confirme avoir reçu le montant en espèces. Cette confirmation est obligatoire avant la remise pour une commande en espèces.
8. **Remettre au coursier** : le salarié donne la commande et le ticket papier, puis enregistre le départ en livraison.
9. **Confirmer la livraison** : la commande n’est clôturée que lorsque le coursier a confirmé que le client l’a reçue.

Pour une future carte bancaire, aucune confirmation d’espèces ne sera demandée : l’écran indiquera que le règlement sera reçu ultérieurement.

## Si le client retire en boutique

6. **Préparer la remise** : la commande et le ticket papier sont prêts au comptoir.
7. **Règlement reçu sur place** : le salarié confirme l’encaissement avant la clôture.
8. **Commande récupérée** : le salarié remet la commande et le ticket au client, puis clôture.

## Présentation sur la tablette

- Un bandeau montre clairement l’étape actuelle et la prochaine action.
- Des repères montrent ce qui est terminé : acceptation, préparation, ticket, règlement, coursier et clôture.
- Les boutons restent grands et une étape ne peut pas être validée par accident.
- Les rubriques Nouvelles, À préparer, Prêtes, En livraison et Terminées permettent de retrouver rapidement les commandes.
- La gestion des produits et les droits actuels du salarié restent inchangés.

## Ce qu’il faut en pratique

- **Une tablette**, branchée sur son chargeur, avec une connexion Wi-Fi stable et la page Comptoir ouverte. L’alerte sonore doit être activée après la connexion.
- **Un accès salarié**, créé par vous depuis Administration → Utilisateurs.
- **Chez Mima Gestion et l’imprimante de tickets** au comptoir. Le volet Application reste à créer dans le projet Chez Mima Gestion depuis son propre chat.
- **Le téléphone du coursier** et une consigne simple : il règle en espèces au départ, puis confirme la livraison au salarié.
- **La monnaie nécessaire en boutique** pour les règlements sur place.
- **Aucun CMI pour le lancement** : le paiement carte et le règlement différé seront traités plus tard.

## Détails techniques

- Ajouter un suivi interne horodaté du règlement confirmé, de la remise au coursier et de la clôture par le salarié.
- Ajouter une action sécurisée « Espèces reçues » ou « Règlement reçu sur place » et faire respecter cette condition par le serveur.
- Conserver les transitions actuelles et les notifications clients, sans modifier les anciennes commandes.
- Vérifier les deux parcours complets avec des commandes fictives : livraison en espèces et retrait sur place, ainsi que les refus d’étapes dans le mauvais ordre.
- Vérifier qu’un client ne peut pas utiliser les actions du salarié et que la photo du ticket reste privée.
