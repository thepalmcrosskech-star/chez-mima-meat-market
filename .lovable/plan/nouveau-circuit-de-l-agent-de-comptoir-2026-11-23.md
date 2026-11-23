# Nouveau circuit de l’agent de comptoir

## Objectif

Une tablette guide le salarié avec une seule action principale à chaque étape. La caisse reste dans Chez Mima Gestion : la tablette sert à recevoir, préparer, contrôler et suivre les commandes de l’application.

## Choix du client pendant la commande

Comme sur Glovo, chaque article comporte une consigne **Si ce produit est indisponible** :

- **M’appeler pour choisir**, proposé par défaut.
- **Remplacer par un article similaire**.
- **Annuler cet article**, sans annuler le reste de la commande.

Si le remplacement n’a pas le même prix, le salarié appelle le client avant de modifier la commande.

## Circuit commun

1. **Nouvelle commande** : elle apparaît en direct avec une alerte. Le salarié vérifie les articles, les quantités, les consignes de rupture, le client, le total et le mode de livraison ou de retrait.
2. **Accepter la commande** : le salarié l’accepte avant de commencer. Il peut encore l’annuler si la commande est impossible à préparer.
3. **Commencer la préparation** : les articles, les notes et les consignes du client restent visibles.
4. **Traiter les indisponibilités** : le salarié suit la consigne de chaque article. Il peut appeler le client, enregistrer un remplacement ou retirer uniquement l’article concerné. Le total est recalculé et le client est informé. Si tous les articles sont retirés, la commande est annulée.
5. **Saisir la vente en caisse** : une fois les articles définitifs, le salarié utilise le volet Application de Chez Mima Gestion, imprime le ticket, puis le photographie avec la tablette.
6. **Commande prête** : cette étape reste bloquée tant que les indisponibilités ne sont pas traitées et que la photo du ticket n’est pas enregistrée. La photo reste privée.

## Si la commande est livrée

7. **Appeler le coursier** : le salarié appelle le coursier habituel puis enregistre l’appel.
8. **Espèces reçues** : à l’arrivée du coursier, le salarié confirme avoir reçu le montant en espèces. Cette confirmation est obligatoire avant la remise pour une commande en espèces.
9. **Remettre au coursier** : le salarié donne la commande et le ticket papier, puis enregistre le départ en livraison.
10. **Confirmer la livraison** : la commande n’est clôturée que lorsque le coursier a confirmé que le client l’a reçue.

Pour une future carte bancaire, aucune confirmation d’espèces ne sera demandée : l’écran indiquera que le règlement sera reçu ultérieurement.

## Si le client retire en boutique

7. **Préparer la remise** : la commande et le ticket papier sont prêts au comptoir.
8. **Règlement reçu sur place** : le salarié confirme l’encaissement avant la clôture.
9. **Commande récupérée** : le salarié remet la commande et le ticket au client, puis clôture.

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

- Enregistrer la consigne de rupture sur chaque article et la transmettre avec la commande ; seules les trois consignes prévues seront acceptées.
- Ajouter des actions sécurisées pour appeler, remplacer ou retirer un article, avec recalcul du prix côté serveur et notification du client.
- Ajouter un suivi interne horodaté du règlement confirmé, de la remise au coursier et de la clôture par le salarié.
- Ajouter une action sécurisée « Espèces reçues » ou « Règlement reçu sur place » et faire respecter cette condition par le serveur.
- Conserver les transitions actuelles et les notifications clients, sans modifier les anciennes commandes.
- Vérifier les parcours avec des commandes fictives : rupture avec appel, remplacement et annulation d’article, puis livraison en espèces et retrait sur place.
- Vérifier qu’un client ne peut pas utiliser les actions du salarié et que la photo du ticket reste privée.
