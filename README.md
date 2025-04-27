# Kapazitätsplanung Web App

Eine moderne Web-Anwendung zur Kapazitätsplanung, die es ermöglicht, Mitarbeiterkapazitäten zu analysieren und Aufträge effizient zu verwalten.

## Funktionen

- Übersicht über Mitarbeiterkapazitäten und Auslastung
- Anzeige von aktiven Aufträgen je Mitarbeiter und Mandant
- Anzeige von abgeschlossenen Aufträgen je Mitarbeiter
- Visualisierung der Daten durch interaktive Diagramme
- Responsive Design für Desktop und mobile Geräte
- Filterfunktionen für alle Tabellen
- Detailansichten zu Aufträgen und Mitarbeitern
- Sortierbare Tabellen nach beliebigen Spalten
- Validierung der CSV-Daten mit detaillierten Fehlerberichten
- Benutzerfreundliche Oberfläche mit Tailwind CSS und Flowbite
- Interaktive Modals für detaillierte Ansichten

## Verwendung

1. **Dateien vorbereiten:** Stellen Sie sicher, dass Sie die folgenden CSV-Dateien haben:
   - `Aufträge.csv` (Trennzeichen: `;`)
   - `Rechnungen.csv` (Trennzeichen: `;`)
   - `Arbeitsstunden.csv` (Trennzeichen: `;`)

2. **App starten:** Öffnen Sie die `index.html` Datei in Ihrem Browser oder verwenden Sie einen lokalen Webserver.

3. **Enddatum auswählen:** Wählen Sie ein Enddatum für die Kapazitätsplanung aus dem Datepicker.

4. **Dateien hochladen:** Laden Sie die drei erforderlichen CSV-Dateien hoch.

5. **Planung starten:** Klicken Sie auf "Kapazitätsplanung starten", um den Prozess zu beginnen.

6. **Ergebnisse einsehen:** Nach der Verarbeitung werden Sie automatisch zum Tab "Mitarbeiterkapazität" weitergeleitet, wo Sie die Ergebnisse sehen können. Sie können zwischen den Tabs wechseln, um verschiedene Aspekte der Planung einzusehen.

7. **Daten filtern:** Nutzen Sie die Filterfelder über den Tabellen, um die Anzeige auf bestimmte Mitarbeiter oder Daten einzuschränken.

8. **Detailansichten öffnen:** Klicken Sie auf Einträge in den Tabellen, um detaillierte Informationen in Modals anzuzeigen.

## CSV-Datenformate

Für die korrekte Funktionsweise der Anwendung müssen die CSV-Dateien folgende Daten enthalten:

### Aufträge.csv (Trennzeichen: `;`)
- Mandant
- VJ
- Auftrag
- Auftragsstatus_Bez (mit Werten wie "Offen", "In Arbeit", "Abgeschlossen")
- Mitarbeiter 1 (Nummer)

### Rechnungen.csv (Trennzeichen: `;`)
- Rechnungsnummer
- Mandant
- VJ
- Std/Min (numerisch)
- Leistungsart_Kurzbezeichnung (wird für die Zuordnung zu Auftragsarten verwendet)
- Mitarbeiter

### Arbeitsstunden.csv (Trennzeichen: `;`)
- Mitarbeiter Nummer
- Arbeitszeit in Stunden (numerisch)

## Technische Details

Die Anwendung nutzt folgende Technologien:

- HTML5, CSS3 und JavaScript
- Tailwind CSS für das responsive Design
- Flowbite für UI-Komponenten wie Modals und Tabs
- Chart.js für Diagramme und Visualisierungen
- Flatpickr für die Datumauswahl
- PapaParse für die CSV-Verarbeitung
- Bootstrap Icons für die Benutzeroberfläche

## Datenverarbeitung

Die App verarbeitet die CSV-Dateien wie folgt:

1. **Arbeitsstunden:** Berechnung der verfügbaren Kapazitäten pro Mitarbeiter bis zum gewählten Enddatum
2. **Rechnungen:** Analyse der abgeschlossenen Aufträge und deren Stunden
3. **Aufträge:** Identifizierung aktiver Aufträge und Zuordnung geplanter Stunden
4. **Validierung:** Prüfung auf Inkonsistenzen wie fehlende Mitarbeiter oder nicht zugeordnete Leistungsarten

## Fehlerbehebung

Bei Problemen prüfen Sie bitte:
1. Ob die CSV-Dateien das korrekte Format haben und die richtigen Trennzeichen verwenden (`;`)
2. Ob alle erforderlichen Daten in den Dateien enthalten sind
3. Ob Sie einen modernen Browser verwenden (Chrome, Firefox, Edge)
4. Ob die Datumsformate im deutschen Format (TT.MM.JJJJ) vorliegen
5. Ob die Anzeige von Popups in Ihrem Browser erlaubt ist (für Modals) 