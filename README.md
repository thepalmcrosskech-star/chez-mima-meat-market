# Boucherie Chez Mima Application 

# PROMPT LOVABLE — CHEZ MIMA (Application Boucherie)

---

## INSTRUCTIONS GÉNÉRALES

Act as a Senior Full-Stack Developer and UI/UX Designer.
Build a mobile-first web application for a modern butcher shop named **"CHEZ MIMA"**. The app will be deployed on the domain **chezmima.app**.

Tech stack: **React + TypeScript + Tailwind CSS + Supabase (backend/auth/database) + Leaflet / OpenStreetMap (cartes sans clé)**.

---

## 1. BRANDING & UI/UX DESIGN

- **Theme**: True Dark Mode sur toute l'application.
- **Colors**:
  - Background principal : noir pur `#000000`
  - Surfaces/Cards : `#0A0A0A` et `#111111`
  - Bordures : `#1A1A1A` / `#222222`
  - Texte principal : blanc pur `#FFFFFF`
  - Texte secondaire : `#B0B0B0` (gray-300), `#707070` (gray-500)
  - Couleur d'accent / boutons primaires : rouge vif `#D3111A` (rappelant le taureau rouge du logo)
  - Hover rouge : `#E8222B`
  - Succès : `#22C55E`
  - Warning : `#F59E0B`
  - Info : `#3B82F6`
- **Typography**: Police moderne sans-serif **Sora** (Google Fonts) — Bold/ExtraBold pour les titres, Regular/Medium pour le corps.
- **Vibe**: Premium, appétissant, simple et intuitif. Pas de design "AI générique". Le style doit être épuré, sombre, avec des accents rouges vifs.
- **Logo**: Placeholder en haut de l'app — un cercle avec gradient rouge contenant un emoji taureau 🐂, texte "CHEZ MIMA" avec "MIMA" en rouge, et 3 étoiles bleu/blanc/rouge en dessous.
- **Animations**: Fade-in sur les pages, bounce-in sur les badges, transitions fluides sur les boutons et les cartes. Pas d'animations excessives.
- **Border-radius**: Arrondi généreux — 14px à 20px sur les cartes et boutons.

---

## 2. ARCHITECTURE & RÔLES

L'application a **deux interfaces distinctes** :

| Interface | Cible | Optimisation |
|-----------|-------|-------------|
| **Client (User App)** | Clients finaux | Mobile-first (max-width 480px centré) |
| **Admin Dashboard** | Gérant de la boucherie | Desktop/Tablet (sidebar + contenu) |

**Authentification** obligatoire pour les deux côtés via **Supabase Auth** (email + password).

Champ `role` dans la table `profiles` : `"user"` ou `"admin"`.
Après login, rediriger automatiquement vers l'interface correspondante au rôle.

---

## 3. CLIENT INTERFACE (USER APP)

### 3.1 — Page d'accueil (Home)

- **Header** : "Bienvenue 👋" + nom de l'utilisateur à gauche, logo CHEZ MIMA à droite.
- **Bannière promotionnelle dynamique** : Un encadré avec gradient rouge subtil, contrôlé par l'admin (titre + sous-titre + toggle visible/masqué). Si désactivée par l'admin, ne rien afficher.
- **Grille des catégories** : Affichage en grid 2 colonnes. Chaque carte de catégorie affiche : emoji, nom de la catégorie, nombre de produits. Au clic → page listing des produits de cette catégorie.
- **Carrousel "Populaires"** : Scroll horizontal des 6 premiers produits en stock. Chaque mini-carte montre : emoji, nom, prix. Au clic → fiche produit.

### 3.2 — Listing produits par catégorie

- **Bouton retour** vers l'accueil.
- **En-tête** : emoji + nom de la catégorie + nombre de produits.
- **Liste des produits** sous forme de cartes horizontales :
  - Image (emoji), Nom, Description (tronquée 1 ligne), Prix, Flèche →
  - **Produits en rupture de stock** (stock_quantity = 0) : carte grisée (opacity 0.4), badge "Épuisé", non cliquable.

### 3.3 — Fiche produit (Product Detail)

- Grande image (emoji sur fond dégradé).
- Nom, description complète, prix.
- **FONCTIONNALITÉ CRUCIALE — Sélecteur de quantité selon le type d'unité** :
  - **Type "weight" (au poids)** : 4 boutons de sélection → `100g`, `250g`, `500g`, `1kg`. Un seul sélectionnable à la fois. Le prix se recalcule dynamiquement (prix = prix_au_kg × poids_sélectionné / 1000).
  - **Type "piece" (à la pièce)** : Compteur avec boutons `−` et `+` (minimum 1). Le prix se recalcule dynamiquement (prix = prix_unitaire × quantité).
- Affichage du **Total** en gros et en rouge.
- Bouton "Ajouter au panier" (rouge, pleine largeur, icône caddie).

### 3.4 — Panier (Cart)

- Liste de tous les articles ajoutés avec : image, nom, quantité choisie (ex: "500g" ou "2 pièces"), prix ligne, boutons +/− pour ajuster, bouton supprimer.
- **Sous-total** + **Frais de livraison** (calculés selon la zone — voir section 6) + **Total**.
- Afficher un message info si le minimum de commande pour la zone n'est pas atteint : encadré orange "Le minimum de commande pour votre zone est de XX MAD. Il vous manque YY MAD."
- Si le montant atteint le seuil de livraison gratuite : afficher un badge vert "🎉 Livraison gratuite !"
- Sinon : afficher une barre de progression vers la livraison gratuite : "Plus que XX MAD pour la livraison gratuite !" avec une progress bar rouge.

### 3.5 — Adresse de livraison (Leaflet / OpenStreetMap)

- **Avant la validation de la commande**, l'utilisateur DOIT renseigner son adresse de livraison.
- Écran/modal "Adresse de livraison" avec :
  - **Champ de recherche d'adresse** utilisant la recherche d'adresse (autocomplete). L'utilisateur tape son adresse et sélectionne une suggestion.
  - **Carte Leaflet / OpenStreetMap** affichant :
    - Un **marker draggable** sur la position sélectionnée. L'utilisateur peut ajuster manuellement en déplaçant le marker.
    - Les **zones de livraison** affichées en overlay coloré (polygones/cercles) sur la carte pour que l'utilisateur voie dans quelle zone il se trouve.
  - **Bouton "Utiliser ma position actuelle"** (Geolocation API du navigateur) pour pré-remplir automatiquement.
  - **Champs complémentaires** : Numéro d'appartement/étage (optionnel), Instructions de livraison (optionnel, textarea).
  - **Détection automatique de la zone** : Dès que l'adresse est sélectionnée ou le marker déplacé, le système détecte automatiquement dans quelle zone de livraison se trouve le point (point-in-polygon check) et affiche :
    - Nom de la zone (ex: "Zone Centre — Guéliz")
    - Frais de livraison pour cette zone
    - Minimum de commande pour cette zone
    - Si hors de toutes les zones → message d'erreur : "Désolé, nous ne livrons pas encore dans votre secteur. 😔"
  - L'adresse validée est sauvegardée dans le profil utilisateur pour les prochaines commandes (pré-remplie au prochain passage).

### 3.6 — Validation de commande (Checkout)

- Récapitulatif : articles, adresse de livraison (résumé avec mini-carte statique), frais, total.
- **⚠️ IMPORTANT : AUCUNE passerelle de paiement.** C'est un modèle **Click & Collect / Commande à la livraison**.
- Bouton **"Confirmer ma commande"**.
- Le mode de paiement est **"Paiement à la livraison"** (affiché clairement).
- À la soumission :
  - Créer l'order en base avec statut `"pending"`.
  - Afficher un écran de succès avec animation check vert + message "Commande envoyée ! Nous préparons votre commande avec soin." + badge "En attente".
  - Vider le panier.

### 3.7 — Profil utilisateur

- Avatar (initiale du nom sur fond rouge), nom, email, téléphone.
- **Adresses enregistrées** : liste des adresses sauvegardées avec possibilité d'en ajouter, modifier, supprimer, et définir une adresse par défaut.
- **Mes commandes** : historique avec statut coloré (En attente/orange, En préparation/bleu, En livraison/violet, Livrée/vert, Terminée/gris).
- Bouton déconnexion.

### 3.8 — Messagerie (Inbox)

- Liste des messages reçus de l'admin, triés du plus récent au plus ancien.
- Chaque message montre : avatar CHEZ MIMA, contenu, date/heure.
- Les messages non lus ont un indicateur visuel (bordure rouge).
- À l'ouverture de la page, tous les messages passent en `is_read = true`.

### 3.9 — Barre de navigation bottom (Mobile)

- 4 onglets fixes en bas : Accueil (🏠), Panier (🛒 + badge compteur), Messages (💬 + badge non lus), Profil (👤).
- Indicateur rouge sur l'onglet actif (trait en haut + icône/texte en rouge).
- Background semi-transparent avec backdrop-filter blur.

---

## 4. ADMIN DASHBOARD (Zone sécurisée)

Layout : **Sidebar à gauche** (rétractable) + **Contenu principal à droite**.

### 4.1 — Sidebar

- Logo CHEZ MIMA en haut.
- Bouton collapse (← / →).
- Menu : Commandes (📦), Catalogue (📋), Stock (📊), Zones de livraison (🗺️), Marketing (📢), CRM (👥), Messagerie (💬).
- Badge rouge sur "Commandes" indiquant le nombre de commandes en attente.
- Bouton déconnexion en bas.

### 4.2 — Gestion des commandes (Kanban Board)

- **Vue Kanban** avec 5 colonnes drag-and-drop :
  - **Nouvelles** (pending) — couleur orange
  - **En préparation** (preparing) — couleur bleue
  - **En livraison** (delivering) — couleur violette
  - **Livrée** (delivered) — couleur verte
  - **Terminée** (completed) — couleur grise
- Chaque carte de commande affiche : nom client, montant total, date/heure, liste des articles, adresse de livraison (résumé court), bouton pour avancer au statut suivant.
- L'admin peut cliquer pour avancer la commande d'un statut au suivant.

### 4.3 — Gestion du catalogue (CRUD)

Deux onglets : **Produits** | **Catégories**

**Produits** :
- Grid de cartes produit avec : emoji, nom, catégorie, prix, type (Poids/Pièce), stock, boutons Modifier/Supprimer.
- Bouton "+ Ajouter un produit" ouvre un formulaire avec les champs :
  - Nom (text)
  - Description (textarea)
  - Image (emoji picker ou upload — pour la V1, utiliser un champ texte emoji)
  - Prix (number, en MAD) — avec label dynamique "/kg" ou "/pièce" selon le type
  - Type d'unité (select : "Au poids (kg)" ou "À la pièce")
  - Stock (number)
  - Catégorie (select parmi les catégories existantes)
- Formulaire de modification identique, pré-rempli.

**Catégories** :
- Grid de cartes catégorie : emoji, nom, nombre de produits liés, boutons Modifier/Supprimer.
- Formulaire simple : Nom + Emoji.

### 4.4 — Gestion du stock quotidien

- **Interface de saisie rapide** sous forme de tableau :
  - Colonnes : Produit (emoji + nom), Catégorie, Type, Prix, Stock actuel, Actions (+/−/input direct).
  - Filtres par catégorie en haut (boutons toggle).
  - Stock affiché en gros : vert si > 0, rouge si = 0.
  - Boutons +10 / −10 et champ input pour saisie directe.

### 4.5 — Gestion des zones de livraison (CRUD avec Leaflet) 🗺️

- **carte Leaflet / OpenStreetMap plein écran** affichant toutes les zones de livraison en overlay (polygones colorés).
- **Liste des zones** à côté de la carte (ou en dessous sur tablette) avec pour chaque zone :
  - Nom de la zone (ex: "Zone 1 — Guéliz Centre")
  - Couleur de la zone sur la carte
  - **Frais de livraison** (en MAD, ex: 15 MAD)
  - **Minimum de commande** (en MAD, ex: 80 MAD)
  - **Seuil de livraison gratuite** (en MAD, ex: 200 MAD — si le client commande 200 MAD ou plus, livraison = 0 MAD)
  - **Statut actif/inactif** (toggle)
  - Boutons Modifier / Supprimer

- **Formulaire de création/modification de zone** :
  - Nom de la zone (text)
  - Couleur (color picker)
  - Frais de livraison (number, MAD)
  - Minimum de commande (number, MAD)
  - Seuil de livraison gratuite (number, MAD)
  - Toggle actif/inactif
  - Bouton Sauvegarder

- **Données de démo à insérer** :
  - Zone 1 — "Guéliz" : Frais 10 MAD, Minimum 50 MAD, Gratuit dès 200 MAD, couleur rouge
  - Zone 2 — "Hivernage & Ménara" : Frais 15 MAD, Minimum 80 MAD, Gratuit dès 250 MAD, couleur bleu
  - Zone 3 — "Targa & Agdal" : Frais 25 MAD, Minimum 100 MAD, Gratuit dès 300 MAD, couleur vert
  - Zone 4 — "Palmeraie" : Frais 35 MAD, Minimum 150 MAD, Gratuit dès 400 MAD, couleur orange

### 4.6 — Marketing (Bannière)

- Formulaire pour modifier la bannière de la page d'accueil client : Titre, Sous-titre, Toggle visible/masqué.
- **Aperçu mobile en temps réel** à côté du formulaire (preview dans un cadre style smartphone 320px).

### 4.7 — CRM (Clients)

- Tableau de tous les clients enregistrés : Avatar initiale, Nom, Email, Téléphone, Nombre de commandes, Total dépensé (calculé), Adresse(s) de livraison.

### 4.8 — Messagerie admin

- **Liste des clients** à gauche (panneau scrollable). Chaque entrée montre : initiale, nom, aperçu dernier message, badge non lus.
- **Zone de chat** à droite : Historique des messages envoyés à ce client. Champ texte + bouton Envoyer.
- Messages affichés style chat (bulles rouges alignées à droite pour l'admin), avec horodatage et indicateur lu/non lu (✓ / ✓✓).

---

## 5. DATA MODEL (Supabase)

```sql
-- Profiles (extension de auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🥩',
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL, -- Prix au kg OU prix à la pièce
  unit_type TEXT NOT NULL CHECK (unit_type IN ('weight', 'piece')),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery Zones
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Ex: "Guéliz Centre"
  color TEXT DEFAULT '#D3111A', -- Couleur hex pour l'affichage carte
  delivery_fee DECIMAL(10,2) NOT NULL, -- Frais de livraison en MAD
  minimum_order DECIMAL(10,2) NOT NULL, -- Minimum de commande en MAD
  free_delivery_threshold DECIMAL(10,2), -- Livraison gratuite à partir de X MAD (nullable = jamais gratuit)
  polygon JSONB NOT NULL, -- GeoJSON polygon coordinates
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Addresses
CREATE TABLE user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Maison', -- Ex: "Maison", "Bureau"
  full_address TEXT NOT NULL, -- Adresse complète retournée par la carte
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  apartment TEXT, -- Numéro apt/étage
  instructions TEXT, -- Instructions de livraison
  delivery_zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'delivering', 'delivered', 'completed', 'cancelled')),
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  delivery_address_id UUID REFERENCES user_addresses(id),
  delivery_zone_id UUID REFERENCES delivery_zones(id),
  delivery_address_snapshot JSONB, -- Snapshot de l'adresse au moment de la commande
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, -- Snapshot du nom au moment de la commande
  quantity TEXT NOT NULL, -- "500g" ou "3" selon le type
  quantity_value DECIMAL(10,3) NOT NULL, -- Valeur numérique (0.5 pour 500g, 3 pour 3 pièces)
  unit_price DECIMAL(10,2) NOT NULL, -- Prix unitaire au moment de la commande
  line_total DECIMAL(10,2) NOT NULL, -- Total de la ligne
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id),
  receiver_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Settings (bannière etc.)
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Insert default banner setting:
-- INSERT INTO app_settings (key, value) VALUES ('home_banner', '{"title": "🔥 PROMO DE LA SEMAINE", "subtitle": "Entrecôte maturée 21 jours — 29.90 MAD/kg au lieu de 32.90 MAD", "active": true}');
```

### Row Level Security (RLS) — Règles importantes :

- **profiles** : Users can read/update their own profile. Admins can read all.
- **categories, products** : Everyone can read. Only admins can insert/update/delete.
- **delivery_zones** : Everyone can read active zones. Only admins can CRUD.
- **user_addresses** : Users can CRUD their own addresses only.
- **orders** : Users can read their own orders and create new ones. Admins can read/update all.
- **order_items** : Users can read their own order items. Admins can read all.
- **messages** : Users can read messages where they are the receiver. Admins can read all and create.
- **app_settings** : Everyone can read. Only admins can update.

---

## 6. LOGIQUE DES ZONES DE LIVRAISON (Détails)

### Côté Client — Algorithme :

1. L'utilisateur sélectionne/saisit une adresse → on obtient `[longitude, latitude]` via la carte.
2. On charge toutes les `delivery_zones` actives depuis Supabase.
3. On effectue un **point-in-polygon test** (utiliser la librairie `@turf/boolean-point-in-polygon` de Turf.js) pour chaque zone.
4. **Si le point est dans une zone** :
   - Stocker la `delivery_zone_id` associée à l'adresse.
   - Afficher le nom de la zone, les frais de livraison, et le minimum de commande.
   - Dans le panier, calculer :
     - Si `subtotal < minimum_order` → bloquer la commande, afficher message.
     - Si `subtotal >= free_delivery_threshold` → `delivery_fee = 0`, afficher "Livraison gratuite 🎉".
     - Sinon → appliquer `delivery_fee` de la zone.
     - `total = subtotal + delivery_fee`.
5. **Si le point n'est dans aucune zone** :
   - Afficher un message d'erreur : "Désolé, nous ne livrons pas encore dans votre secteur."
   - Bloquer la validation de la commande.

### Côté Admin — Dessin de zones :

- Sauvegarder les coordonnées en format GeoJSON dans la colonne `polygon` (JSONB).
- Permettre la modification du polygone (re-dessiner).
- Afficher toutes les zones existantes avec leur couleur respective en overlay sur la carte.

---

## 7. CARTES
- Leaflet + tuiles OpenStreetMap, sans clé ni jeton.

- **Centre par défaut** : Marrakech, Maroc → `[-8.0083, 31.6295]`, zoom 12.
- **Langue de la carte** : Français.
- **Librairies à installer** :
  - `@mapbox/mapbox-gl-geocoder` — Barre de recherche d'adresses
  - `@turf/boolean-point-in-polygon` — Test point-in-polygon
  - `@turf/helpers` — Helpers GeoJSON

---

## 8. MONNAIE & LOCALISATION

- **Monnaie** : MAD (Dirham marocain). Afficher les prix avec le format `XX.XX MAD`.
- **Langue** : Français pour toute l'interface.
- **Localisation géographique** : Marrakech, Maroc.

---

## 9. DONNÉES DE DÉMONSTRATION (Seed Data)

Insérer ces données de démo pour pouvoir tester l'application immédiatement :

### Comptes de démo :
- **Admin** : admin@chezmima.app / mot de passe: Admin123!
- **Client 1** : yassine@mail.com / mot de passe: Test1234!
- **Client 2** : sarah@mail.com / mot de passe: Test1234!
- **Client 3** : karim@mail.com / mot de passe: Test1234!

### Catégories :
1. 🐂 Bœuf
2. 🐄 Veau
3. 🐔 Volailles
4. 🐑 Agneau
5. 🐷 Charcuterie
6. 🌶️ Sauces & Épicerie

### Produits (exemples, au moins 3 par catégorie) :

**Bœuf :**
- Entrecôte — 329 MAD/kg — weight — stock 50
- Faux-filet — 285 MAD/kg — weight — stock 40
- Steak haché pur bœuf — 35 MAD/pièce — piece — stock 100
- Côte de bœuf — 380 MAD/kg — weight — stock 0 (RUPTURE)

**Veau :**
- Escalope de veau — 299 MAD/kg — weight — stock 30
- Blanquette de veau — 189 MAD/kg — weight — stock 25
- Osso Buco — 165 MAD/kg — weight — stock 15

**Volailles :**
- Poulet fermier entier — 129 MAD/pièce — piece — stock 20
- Cuisses de poulet (lot de 4) — 85 MAD/pièce — piece — stock 35
- Filets de dinde — 149 MAD/kg — weight — stock 40

**Agneau :**
- Gigot d'agneau — 229 MAD/kg — weight — stock 10
- Côtelettes d'agneau — 349 MAD/kg — weight — stock 20

**Charcuterie :**
- Merguez artisanale — 25 MAD/pièce — piece — stock 200
- Saucisson sec — 69 MAD/pièce — piece — stock 50

**Sauces & Épicerie :**
- Sauce BBQ maison — 45 MAD/pièce — piece — stock 60
- Épices Ras el Hanout — 59 MAD/pièce — piece — stock 45

### Zones de livraison (polygones centrés sur Marrakech) :
- Zone 1 — "Guéliz" : 10 MAD, min 50 MAD, gratuit dès 200 MAD, couleur #D3111A
- Zone 2 — "Hivernage & Ménara" : 15 MAD, min 80 MAD, gratuit dès 250 MAD, couleur #3B82F6
- Zone 3 — "Targa & Agdal" : 25 MAD, min 100 MAD, gratuit dès 300 MAD, couleur #22C55E
- Zone 4 — "Palmeraie" : 35 MAD, min 150 MAD, gratuit dès 400 MAD, couleur #F59E0B

### Commandes de démo :
- 2–3 commandes avec différents statuts (pending, preparing, delivered).

### Messages de démo :
- "Bonjour Yassine ! Votre commande est prête. 🥩"
- "Il manque du faux-filet aujourd'hui. On remplace par de l'entrecôte au même prix ?"
- "Bienvenue chez MIMA ! Profitez de -10% sur votre première commande. 🎉"

### Bannière de démo :
- Titre: "🔥 PROMO DE LA SEMAINE"
- Sous-titre: "Entrecôte maturée 21 jours — 289 MAD/kg au lieu de 329 MAD"
- Active: true

---

## 10. PAGES & ROUTING

```
/ → Redirection selon le rôle (home ou admin)
/login → Page de connexion/inscription
/register → Page d'inscription

--- CLIENT ---
/home → Accueil client
/category/:id → Listing produits d'une catégorie
/product/:id → Fiche produit
/cart → Panier
/checkout → Sélection adresse + récapitulatif + validation
/checkout/address → Sélection/ajout adresse de livraison (Mapbox)
/order-success → Écran de confirmation
/orders → Historique des commandes
/messages → Inbox messages
/profile → Profil utilisateur
/profile/addresses → Gestion des adresses

--- ADMIN ---
/admin/orders → Kanban commandes
/admin/catalog → Gestion catalogue (produits + catégories)
/admin/stock → Gestion stock quotidien
/admin/zones → Gestion zones de livraison (carte Leaflet / OpenStreetMap + CRUD)
/admin/marketing → Gestion bannière
/admin/crm → Liste clients
/admin/messages → Messagerie directe
```

---

## 11. RÈGLES DE DÉVELOPPEMENT IMPORTANTES

1. **Mobile-first** : L'interface client DOIT être parfaite sur mobile (iPhone SE à iPhone 15 Pro Max). Max-width 480px, centré.
2. **Dark mode exclusif** : Pas de mode clair. Tout est sombre.
3. **Aucun paiement en ligne** : Paiement à la livraison uniquement. Aucune intégration Stripe/PayPal.
4. **Supabase** : Utiliser Supabase pour l'auth, la base de données, et le storage (images futures). Activer RLS sur toutes les tables.
6. **Performance** : Lazy loading des images, pagination si > 50 produits, optimistic UI updates.
7. **Toasts** : Utiliser des toasts pour les actions (ajout panier, commande envoyée, message envoyé, etc.).
8. **Responsive Admin** : Le dashboard admin doit être utilisable sur tablette (sidebar rétractable).
9. **Monnaie** : Tout en MAD. Format : `XXX MAD` ou `XXX.XX MAD`.
10. **Accessibilité** : Contraste suffisant, tailles de touch targets ≥ 44px, labels sur les inputs.

---

## 12. PRIORITÉ DE DÉVELOPPEMENT (Ordre suggéré)

1. ✅ Setup Supabase (tables + RLS + seed data)
2. ✅ Auth (login/register/redirect par rôle)
3. ✅ Client : Home + Catégories + Produits + Fiche produit
4. ✅ Client : Panier + logique quantités
5. ✅ Admin : Catalogue CRUD + Stock
6. ✅ Admin : Commandes Kanban
7. ✅ Mapbox : Intégration adresse client + zones de livraison
8. ✅ Admin : CRUD zones de livraison avec dessin de polygones
9. ✅ Client : Checkout avec calcul frais de livraison
10. ✅ Messagerie (client + admin)
11. ✅ Marketing (bannière)
12. ✅ CRM
13. ✅ Polish final (animations, edge cases, responsive)

---

Commence par le setup Supabase et l'authentification, puis construis l'interface client page par page.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chez-mima-meat-market.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a33f70fb-fbe4-4673-a23b-e6fb80d6d7fa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
