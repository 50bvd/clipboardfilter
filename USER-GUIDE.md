# ClipboardFilter - Guide Utilisateur

## 📋 Vue d'ensemble

ClipboardFilter est une application qui filtre automatiquement le contenu de votre presse-papiers en temps réel. Elle détecte et masque les informations sensibles comme les numéros de carte bancaire, emails, numéros de sécurité sociale, etc.

## 🚀 Installation

1. Téléchargez l'installateur depuis les releases
2. Exécutez `ClipboardFilter-Setup.exe`
3. Suivez les instructions d'installation
4. L'application démarre automatiquement

## ⚡ Démarrage Rapide

### Premier lancement
Au premier lancement, ClipboardFilter :
- Détecte automatiquement votre langue système
- Applique le thème de votre système (clair/sombre)
- Charge 112 filtres par défaut dans 7 catégories

### Utilisation basique
1. Copiez du texte contenant des informations sensibles
2. Appuyez sur **Ctrl+Shift+V** pour coller
3. Le texte est automatiquement filtré !

**Exemple :**
```
Avant : Ma carte bancaire 4532-1234-5678-9010
Après : Ma carte bancaire ****-****-****-****
```

## 📑 Onglets

### 🔍 Filtres
Gérez vos filtres de remplacement.

#### Catégories par défaut :
- **💻 Developer** (33 filtres) : API keys, tokens, secrets
- **💰 Finance** (20 filtres) : Cartes bancaires, IBAN, crypto
- **👤 Personal** (12 filtres) : Emails, téléphones, adresses
- **🏥 Health** (3 filtres) : Numéros de sécurité sociale
- **👔 HR** (5 filtres) : Numéros d'employé, badges
- **⚙️ System** (31 filtres) : IPs, chemins système, UUIDs
- **💬 Communication** (8 filtres) : URLs Slack, Discord, Teams

#### Actions :
- **☑ Checkbox de catégorie** : Active/désactive tous les filtres
- **▼ Flèche** : Déploie/réduit la catégorie
- **+ Ajouter un filtre** : Crée un nouveau filtre personnalisé
- **📁 Nouveau dossier** : Organise vos filtres

### 🧪 Test
Testez vos filtres avant de les utiliser.

1. Collez du texte dans la zone "Entrée"
2. Cliquez sur "Appliquer les filtres"
3. Voyez le résultat dans la zone "Sortie"

### 📦 Templates
Importez/exportez des packs de filtres.

#### Exporter :
1. Créez vos filtres personnalisés
2. Cliquez sur "Exporter JSON"
3. Nommez votre template
4. Sauvegardez le fichier .json

#### Importer :
1. Cliquez sur "Importer JSON"
2. Sélectionnez un fichier template
3. Confirmez l'importation

**Note :** Les filtres par défaut ne sont jamais exportés.

### ⚙️ Paramètres

#### Général
- **Langue** : Français, English, Deutsch, Español, Italiano
- **Thème** : Auto, Clair, Sombre
- **Notifications** : Afficher les notifications système
- **Démarrage auto** : Lancer au démarrage de Windows

#### Raccourcis
- **Coller** : Ctrl+Shift+V (par défaut)
- Cliquez sur "🎙 Modifier" pour changer

#### Gestion des données
- **↻ Réinitialiser tous les filtres par défaut** : Réactive tous les filtres désactivés
- **🗑 Supprimer toutes les catégories/filtres personnalisés** : Efface vos créations

## 🎯 Cas d'usage

### Pour les développeurs
- Masquez vos API keys avant de partager du code
- Filtrez les tokens d'authentification dans les logs
- Cachez les secrets AWS/GCP/Azure

### Pour la finance
- Protégez les numéros de carte bancaire
- Masquez les IBAN dans les emails
- Cachez les adresses de crypto-monnaie

### Pour les RH
- Filtrez les numéros de sécurité sociale
- Masquez les identifiants d'employés
- Protégez les données personnelles

### Pour le support technique
- Cachez les adresses IP dans les logs
- Masquez les chemins système sensibles
- Filtrez les UUIDs de session

## 🔧 Créer un filtre personnalisé

1. Cliquez sur "+ Ajouter un filtre"
2. Remplissez :
   - **Description** : Nom du filtre
   - **Catégorie** : Classement
   - **Pattern** : Texte ou regex à détecter
   - **Remplacement** : Texte de substitution
   - **☑ Utiliser Regex** : Si pattern est une expression régulière
   - **☑ Activé** : Actif dès la création
3. Cliquez sur "Enregistrer"

**Exemple de filtre simple :**
- Description : Mon nom
- Pattern : Jean Dupont
- Remplacement : [NOM REDACTÉ]

**Exemple de filtre regex :**
- Description : Numéro de badge
- Pattern : `BADGE-\d{6}`
- Remplacement : BADGE-******
- ☑ Utiliser Regex

## 📁 Organiser avec des dossiers

1. Cliquez sur "📁 Nouveau dossier"
2. Nommez le dossier (ex: "Projet X")
3. Choisissez un emoji (ex: 🚀)
4. Sur un filtre, cliquez sur 📋 pour le copier dans le dossier

**Avantages :**
- Organisez par projet/client
- Activez/désactivez tout un dossier d'un coup
- Partagez des collections de filtres

## 🌍 Support multilingue

ClipboardFilter détecte automatiquement votre langue système et bascule entre :
- 🇬🇧 English
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇪🇸 Español
- 🇮🇹 Italiano

Changez la langue dans Paramètres > Langue.

## 🎨 Personnalisation

### Thèmes
- **Auto** : Suit le thème système Windows
- **Clair** : Interface claire
- **Sombre** : Interface sombre (recommandé)

### Raccourcis
Par défaut : **Ctrl+Shift+V**

Pour changer :
1. Paramètres > Raccourcis
2. Cliquez sur "🎙 Modifier"
3. Appuyez sur votre combinaison de touches
4. Validez

## ❓ FAQ

### L'application ne filtre pas mon texte
- Vérifiez que les filtres sont activés (✓)
- Testez dans l'onglet Test
- Vérifiez le raccourci (Paramètres > Raccourcis)

### Comment désactiver temporairement un filtre ?
- Décochez la case à côté du filtre
- Ou décochez toute la catégorie

### Puis-je partager mes filtres ?
- Oui ! Onglet Templates > Exporter JSON
- Envoyez le fichier .json à vos collègues
- Ils peuvent l'importer via Templates > Importer JSON

### Les filtres ralentissent mon système ?
- Non, le filtrage est quasi-instantané (<100ms)
- L'app utilise <100MB de RAM

### Comment désinstaller ?
- Paramètres Windows > Applications
- Cherchez "ClipboardFilter"
- Cliquez sur Désinstaller

## 🆘 Support

- **GitHub Issues** : https://github.com/votre-repo/issues
- **Email** : support@clipboardfilter.com
- **Documentation** : https://docs.clipboardfilter.com

## 📄 Licence

ClipboardFilter est un logiciel open-source sous licence MIT.

---

**Version :** 1.0.0  
**Dernière mise à jour :** Décembre 2024
