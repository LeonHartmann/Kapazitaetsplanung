document.addEventListener('DOMContentLoaded', function() {
    // Initialize date picker
    flatpickr('#endDate', {
        dateFormat: 'd.m.Y',
        locale: 'de',
        defaultDate: new Date(new Date().setMonth(new Date().getMonth() + 3)) // Default to 3 months from now
    });

    // Flowbite handles tabs via data attributes, no explicit JS needed here usually
    // Remove Bootstrap tab initialization code if any was left

    // Set up the start planning button
    document.getElementById('startPlanning').addEventListener('click', startPlanning);

    // Initialize empty data objects
    let auftraegeData = null;
    let arbeitsstundenData = null;
    let linkedData = null;
    let activeOrdersByEmployee = null;
    let completedOrdersByEmployee = null;
    let employeeCapacity = null;
    let mergedCapacityData = null;
    let detailedActiveOrders = null;
    let rechnungenData = null; 

    // Charts - Keep chart variables
    let capacityChart = null;
    let completedChart = null;

    // Define the mapping from Leistungsart_Kurzbezeichnung (Rechnungen) to Auftragsbezeichnung (Aufträge)
    const leistungsartMapping = {
        'Abschlußarb.': 'Abschluß',
        'Abschlußbespr.': null,
        'Abschlußnebena.': 'Abschluß',
        'Anhang/Lageber.': 'Abschluß',
        'Anträge': 'Abschluß',
        'Aus- Fortbild.': 'Eigenverwaltung',
        'Buchführung': 'Buchführung',
        'Dienstleistung': null,              // now ignored entirely
        'EDV allgemein': 'Eigenverwaltung',
        'Eigenverwaltung': 'Eigenverwaltung',
        'Einkommensteuer': 'Private Steuern',// adjusted
        'Einr. einer BF': 'Buchführung',
        'Einr. Lohnbuchf': 'Lohn',
        'Erbsch./Schenk.': null,
        'Erbschaftsang.': null,
        'Eröffnungsbil.': 'Abschluß',
        'Festst. GrStG': null,
        'Festst.EW-Grund': null,
        'Ges. Feststell.': 'Abschluß',
        'Hilfeleist.FIBU': 'Buchführung',
        'Hilfeleist.Lohn': 'Lohn',
        'Körpersch.St': 'Abschluß',
        'Krankheit': 'Eigenverwaltung',
        'Literatur': 'Eigenverwaltung',
        'Lohnabrechnung': 'Lohn',
        'LSt./SozV.Prüf.': 'Lohn',
        'Mitw. Prüfung': null,
        'Organisation': 'Eigenverwaltung',
        'Personalwesen': 'Eigenverwaltung',
        'Prüf. StBesch.': null,
        'Prüfung': 'Abschluß',
        'Rechtsbehelf': null,
        'Schriftwechsel': null,
        'Sonder-/Zwbil.': null,
        'Sonst. Steuern': null,
        'Sonstiges': null,
        'Sonstiges FIBU': 'Buchführung',
        'Sonstiges Lohn': 'Lohn',
        'Steuerl. Berat.': 'Private Steuern',
        'Stl.Bera.Eizabr': null,
        'Umsatzsteuer': 'Umsatzsteuer',      // adjusted
        'Vermögensteuer': null, // adjusted
        'Wirtsch. Berat.': null
    };


    // Function to start the planning process
    async function startPlanning() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingStatus = document.getElementById('loadingStatus');
        const startButton = document.getElementById('startPlanning');
        
        try {
            startButton.disabled = true;
            loadingStatus.textContent = 'Überprüfe Eingaben...';
            loadingOverlay.classList.remove('hidden'); // Show overlay
            updateStatus('Überprüfe Eingaben...', 'info', true); // Update status without showing alert yet
            
            const endDate = document.getElementById('endDate').value;
            if (!endDate) throw new Error('Bitte Enddatum für die Planung angeben');
            
            const rechnungenFile = document.getElementById('rechnungenFile').files[0];
            const auftraegeFile = document.getElementById('auftraegeFile').files[0];
            const arbeitsstundenFile = document.getElementById('arbeitsstundenFile').files[0];
            
            if (!rechnungenFile || !auftraegeFile || !arbeitsstundenFile) throw new Error('Bitte alle erforderlichen Dateien hochladen');

            loadingStatus.textContent = 'Lade Daten...';
            updateStatus('Lade Daten...', 'loading', true);
            const [rechnungenRawData, auftraegeDataLocal, arbeitsstundenDataLocal] = await Promise.all([
                parseCSV(rechnungenFile, ';'),
                parseCSV(auftraegeFile, ';'),
                parseCSV(arbeitsstundenFile, ';')
            ]);
            
            // Log Rechnungen data shape
            console.log('Rechnungen parsed:', rechnungenRawData.length, 'rows', rechnungenRawData[0]);

            auftraegeData = auftraegeDataLocal;
            arbeitsstundenData = arbeitsstundenDataLocal;
            loadingStatus.textContent = 'Verarbeite Rechnungen...';
            updateStatus('Verarbeite Rechnungen...', 'loading', true);
            rechnungenData = preProcessRechnungen(rechnungenRawData);

            // --- Employee Mismatch Check ---
            loadingStatus.textContent = 'Prüfe Mitarbeiterlisten...';
            updateStatus('Prüfe Mitarbeiterlisten...', 'loading', true);
            const auftraegeMitarbeiter = new Set(auftraegeData.map(a => a['Mitarbeiter 1 (Nummer)']?.toString().trim()).filter(Boolean));
            const stundenMitarbeiter = new Set(arbeitsstundenData.map(s => s['Mitarbeiter Nummer']?.toString().trim()).filter(Boolean));
            const mitarbeiterNurInAuftraege = [...auftraegeMitarbeiter].filter(m => !stundenMitarbeiter.has(m));
            const mitarbeiterNurInStunden = [...stundenMitarbeiter].filter(m => !auftraegeMitarbeiter.has(m));
            console.log('Mitarbeiter nur in Aufträge:', mitarbeiterNurInAuftraege);
            console.log('Mitarbeiter nur in Arbeitsstunden:', mitarbeiterNurInStunden);
            // --- End Employee Mismatch Check ---
            
            loadingStatus.textContent = 'Verknüpfe Rechnungen mit Aufträgen...';
            updateStatus('Verknüpfe Rechnungen mit Aufträgen...', 'loading', true);
            const { linkedData, uniqueUnmapped, auftraegeMitNullStunden } = linkRechnungenToAuftraege(rechnungenData, auftraegeData); 

            loadingStatus.textContent = `Berechne Kapazitäten bis ${endDate}...`;
            updateStatus(`Berechne Kapazitäten bis ${endDate}...`, 'loading', true);
            const capacityData = calculateCapacity(arbeitsstundenData, endDate);
            
            // --- Data Validation Reports ---
            loadingStatus.textContent = 'Zeige Datenprüfberichte...';
            updateStatus('Zeige Datenprüfberichte...', 'loading', true);
            displayValidationReports({
                mitarbeiterNurInAuftraege,
                mitarbeiterNurInStunden,
                uniqueUnmapped,
                auftraegeMitNullStunden
            }); 
            // --- End Validation Reports ---

            loadingStatus.textContent = 'Generiere Berichte...';
            updateStatus('Generiere Berichte...', 'loading', true);
            const reports = generateReports(linkedData, capacityData);
            activeOrdersByEmployee = reports.activeOrdersByEmployee;
            completedOrdersByEmployee = reports.completedOrdersByEmployee;
            employeeCapacity = reports.employeeCapacity;
            detailedActiveOrders = reports.activeOrdersWithAllocatedHours;
            
            loadingStatus.textContent = 'Visualisiere Ergebnisse...';
            updateStatus('Visualisiere Ergebnisse...', 'loading', true);
            visualizeResults(); // This populates tables and charts
            
            updateStatus('Ergebnisse bereit!', 'success'); // Now show the final status alert
            
            // Switch to capacity tab (using Flowbite API if needed, or simulate click)
            const capacityTabButton = document.getElementById('capacity-tab');
            if (capacityTabButton) capacityTabButton.click(); // Simple click might work
            
        } catch (error) {
            updateStatus(`Fehler: ${error.message}`, 'danger'); // Show error alert
            console.error('Planungsfehler:', error);
        } finally {
            startButton.disabled = false;
            loadingOverlay.classList.add('hidden'); // Hide overlay
        }
    }

    // Helper function to detect file encoding
    async function detectFileEncoding(file) {
        const buffer = await file.slice(0, 4).arrayBuffer();
        const view = new Uint8Array(buffer);
        
        // Check for UTF-8 BOM
        if (view[0] === 0xEF && view[1] === 0xBB && view[2] === 0xBF) {
            return 'UTF-8';
        }
        
        // Check for UTF-16 BOM
        if ((view[0] === 0xFE && view[1] === 0xFF) || (view[0] === 0xFF && view[1] === 0xFE)) {
            return 'UTF-16';
        }
        
        // Default to UTF-8
        return 'UTF-8';
    }

    // Function to parse CSV files
    function parseCSV(file, delimiter) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                let encoding = 'UTF-8'; // Basic encoding check
                if (text.includes('ä') || text.includes('ö') || text.includes('ü') || text.includes('ß')) {
                    if (text.includes('Ã¤') || text.includes('Ã¶') || text.includes('Ã¼')) {
                        encoding = 'ISO-8859-1';
                    }
                }
                Papa.parse(text, {
                    header: true,
                    delimiter: delimiter,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    transformHeader: header => header.trim(),
                    encoding: encoding,
                    complete: function(results) {
                        if (results.errors.length > 0) {
                            console.warn(`CSV parsing warnings (${file.name}):`, results.errors);
                        }
                        const cleanedData = results.data.map(row => {
                            const cleanedRow = {};
                            for (const [key, value] of Object.entries(row)) {
                                // Remove BOM if present (though PapaParse usually handles this)
                                const cleanKey = key.replace(/^\uFEFF/, '').trim(); // Also trim key here just in case
                                cleanedRow[cleanKey] = value === '' ? null : value;
                            }
                            return cleanedRow;
                        }).filter(row => Object.values(row).some(value => value !== null));
                        console.log(`Parsed ${file.name}:`, cleanedData.slice(0, 5));
                        resolve(cleanedData);
                    },
                    error: function(error) {
                        reject(new Error(`Fehler beim Parsen der CSV-Datei (${file.name}): ${error.message}`));
                    }
                });
            };
            reader.onerror = function() {
                reject(new Error(`Fehler beim Lesen der Datei ${file.name}`));
            };
            reader.readAsText(file);
        });
    }

    // --- New function to pre-process Rechnungen data ---
    function preProcessRechnungen(rechnungenRawData) {
        return rechnungenRawData.map(item => {
            const stdMinValue = item['Std/Min'];
            let hours = 0; // Default to 0
            if (stdMinValue !== null && stdMinValue !== undefined && stdMinValue !== '') {
                const stdMinString = stdMinValue.toString().replace(',', '.'); 
                const parsedHours = parseFloat(stdMinString);
                if (!isNaN(parsedHours)) {
                    hours = parsedHours;
                }
            }

            const vjValue = item.VJ;
            let vjNumeric = 0; // Default to 0
            if (vjValue !== null && vjValue !== undefined && vjValue !== '') {
                const parsedVJ = parseInt(vjValue);
                if (!isNaN(parsedVJ)) {
                    vjNumeric = parsedVJ;
                }
            }

            const leistungsartKurz = (item.Leistungsart_Kurzbezeichnung || '').toString().trim();
            // Mapping is now done dynamically in linkRechnungenToAuftraege
            
            return {
                ...item, // Keep original data
                Mandant: (item.Mandant || '').toString().trim(),
                // Ensure original keys needed for dynamic mapping are clean
                Leistungsart_Kurzbezeichnung_Clean: leistungsartKurz, 
                VJNumeric: vjNumeric,
                StundenNumeric: hours
                // MappedAuftragsbezeichnung is removed here
            };
        }); // Filter is removed here, filtering happens dynamically later
    }

    // --- Link Aufträge dynamically based on Mandant context and conditional mapping ---
    function linkRechnungenToAuftraege(rechnungenData, auftraege) {
        if (!rechnungenData || !auftraege) {
            throw new Error('Fehlende Daten für die Verknüpfung (Aufträge oder Rechnungen)');
        }

        // --- Validation Tracking ---
        let unmappedLeistungsartenDetails = []; // Store { leistungsart, mandant, rechnungNr } 
        let auftraegeMitNullStunden = []; // Store { auftrag, mandant, auftragsbezeichnung, mitarbeiter }

        // Pre-process auftraege data (as before, but ensure Stunden handling is correct)
        const processedAuftraege = auftraege.map(order => ({
            ...order,
            MitarbeiterNummer: order['Mitarbeiter 1 (Nummer)'] ? order['Mitarbeiter 1 (Nummer)'].toString().trim() : '',
            MitarbeiterName: order['Mitarbeiter 1 (Name)'] ? order['Mitarbeiter 1 (Name)'].toString().trim() : '',
            Mandant: (order['Mandant'] || '').toString().trim(),
            AuftragsbezeichnungKey: (order['Auftragsbezeichnung'] || '').toString().trim(), 
            VJ: order['VJ'],
            InitialStunden: Number.parseFloat(order['Stunden']) || 0,
        }));

        // --- Step 1: Determine existing Auftragsbezeichnungen per Mandant ---
        const mandantAuftragsbezeichnungen = {};
        processedAuftraege.forEach(auftrag => {
            const mandantKey = auftrag.Mandant;
            if (!mandantAuftragsbezeichnungen[mandantKey]) {
                mandantAuftragsbezeichnungen[mandantKey] = new Set();
            }
            if (auftrag.AuftragsbezeichnungKey) {
                mandantAuftragsbezeichnungen[mandantKey].add(auftrag.AuftragsbezeichnungKey);
            }
        });
        console.log("Existing Auftragsbezeichnungen per Mandant:", mandantAuftragsbezeichnungen);

        // --- Step 2: Link data using conditional mapping ---
        const linkedData = processedAuftraege.map((auftrag, index) => {
            const mandantKey = auftrag.Mandant;
            const auftragBezKey = auftrag.AuftragsbezeichnungKey;
            const initialStunden = auftrag.InitialStunden || 0;
            let spezifischeHistorischeStunden = initialStunden;
            let foundVJ = 'N/A';

            let logMsg = `  Linking Auftrag ${index + 1} (Mandant: ${mandantKey}, Target Auftragsbezeichnung: '${auftragBezKey}', Mitarbeiter: ${auftrag.MitarbeiterNummer}): `;
            if (initialStunden) {
                 logMsg += `Using Initial Stunden ${initialStunden} from Aufträge CSV. `;
                 foundVJ = 'From Aufträge CSV';
            } else {
                logMsg += `Initial Stunden zero, attempting invoice sum for target '${auftragBezKey}'. `;
                
                // Get existing Aufträge for this specific Mandant
                const existingBezeichnungenForMandant = mandantAuftragsbezeichnungen[mandantKey] || new Set();

                // Filter Rechnungen for this Mandant
                const mandantRechnungen = rechnungenData.filter(r => r.Mandant === mandantKey);

                // Apply conditional mapping and filter Rechnungen matching the CURRENT auftragBezKey
                const finalMatchingRechnungen = mandantRechnungen.filter(rechnung => {
                    const leistungsartKurz = rechnung.Leistungsart_Kurzbezeichnung_Clean;
                    // Pass the base mapping (leistungsartMapping) to the helper
                    const mappedBez = getConditionalMapping(leistungsartKurz, existingBezeichnungenForMandant, leistungsartMapping); 
                    return mappedBez === auftragBezKey; // Only keep if dynamic map matches this specific Auftrag
                });

                // --- Add to unmapped tracking if a mapping existed but wasn't used ---
                mandantRechnungen.forEach(rechnung => {
                    const leistungsartKurz = rechnung.Leistungsart_Kurzbezeichnung_Clean;
                    const potentialTarget = getConditionalMapping(leistungsartKurz, existingBezeichnungenForMandant, leistungsartMapping);
                    if (potentialTarget !== null && potentialTarget !== auftragBezKey) {
                        // This case is complex - a mapping existed but didn't match THIS auftrag.
                        // We primarily care if a Leistungsart *never* maps successfully for a Mandant.
                        // Let's refine the unmapped logic later if needed.
                    }
                    if (potentialTarget === null && leistungsartKurz) { // Track if mapping is explicitly null or rule prevents mapping
                        unmappedLeistungsartenDetails.push({
                            leistungsart: leistungsartKurz,
                            mandant: mandantKey,
                            rechnungNr: rechnung.Rechnungsnummer || 'N/A' 
                        });
                    }
                });
                // --- End unmapped tracking addition ---

                if (finalMatchingRechnungen.length > 0) {
                    // Sum hours across all VJs for the finally matched Rechnungen
                    const totalHours = finalMatchingRechnungen
                        .map(r => parseFloat(r.StundenNumeric) || 0)
                        .reduce((sum, h) => sum + h, 0);
                    spezifischeHistorischeStunden = totalHours;

                    // --- DEBUG LOGGING for Mandant 12102 --- START ---
                    if (mandantKey === '12102' && auftragBezKey === 'Abschluß') { // Be specific about which Auftrag to log
                        console.log(`Debugging Rechnungen mapped to '${auftragBezKey}' for Mandant ${mandantKey}:`);
                        console.table(finalMatchingRechnungen.map(r => ({
                            Leistungsart: r.Leistungsart_Kurzbezeichnung_Clean || r.Leistungsart_Kurzbezeichnung,
                            Stunden: r.StundenNumeric,
                            VJ: r.VJNumeric,
                            // MappedTo: auftragBezKey // Implicitly matches
                        })));
                    }
                    // --- DEBUG LOGGING for Mandant 12102 --- END ---

                    const vjsInvolved = [...new Set(finalMatchingRechnungen.map(r => r.VJNumeric))].sort().join(', ');
                    foundVJ = vjsInvolved;
                    logMsg += `Found ${finalMatchingRechnungen.length} dynamically mapped Rechnung(en) for this Auftrag. Total Hours: ${spezifischeHistorischeStunden.toFixed(2)} (VJs: ${vjsInvolved})`;
                } else {
                    logMsg += `No dynamically matching Rechnungen found for target '${auftragBezKey}'.`;
                    // If initial was also 0, flag this Auftrag
                    if (initialStunden === 0) {
                       auftraegeMitNullStunden.push({
                           auftrag: auftrag.Auftrag || 'N/A',
                           mandant: mandantKey,
                           auftragsbezeichnung: auftragBezKey,
                           mitarbeiter: auftrag.MitarbeiterName || auftrag.MitarbeiterNummer
                       });
                    } 
                }
            }

            // Log for specific cases or first 10
            if (mandantKey === '10884' || mandantKey === '11627' || mandantKey === '12102' || auftrag.MitarbeiterNummer === '56' || index < 10) {
                console.log(logMsg);
            }

            return {
                ...auftrag,
                PlanstundenBasis: spezifischeHistorischeStunden,
                HistorischeBasisVJ: foundVJ, 
            };
        });
        
        console.log('Verknüpfungsergebnisse (linkedData with conditional mapping):', linkedData.slice(0, 5));
        if (linkedData.filter(item => item.PlanstundenBasis > 0).length === 0) {
            console.warn('WARNUNG: Keine Aufträge konnten mit Stunden verknüpft werden (Initial oder dyn. Mapped Rechnungen)!');
        }
        
        // Consolidate unmapped Leistungsarten (report unique combinations)
        const uniqueUnmapped = Array.from(new Set(unmappedLeistungsartenDetails.map(item => `${item.leistungsart} (Mandant: ${item.mandant})`)))
                                .map(str => ({ leistungsart: str.split(' (')[0], context: str.split(' (')[1].replace(')', '') }));
                                
        console.log('Unmapped Leistungsarten (During Linking):', uniqueUnmapped);
        console.log('Aufträge mit Null Stunden (Initial & Linked):', auftraegeMitNullStunden);

        return { linkedData, uniqueUnmapped, auftraegeMitNullStunden }; // Return validation results
    }

    // Define the set of Leistungsarten considered 'Abschlussarbeiten' for priority rule
    const abschlussArbeitenKeys = new Set([
        'Abschlußarb.', 'Abschlußnebena.', 'Anhang/Lageber.', 'Anträge', 
        'Eröffnungsbil.', 'Ges. Feststell.', 'Körpersch.St', 'Prüfung' 
        // Excluding 'Umsatzsteuer' based on user's last edit, assuming it's separate
        // Excluding 'Abschlußbespr.' and 'Wirtsch. Berat.' as they are mapped to null
    ]);

    // Helper function for conditional mapping based on existing Aufträge for a Mandant
    function getConditionalMapping(leistungsartKurz, existingAuftragBezeichnungen, baseMapping) {
        const hasAbschluss = existingAuftragBezeichnungen.has('Abschluß');
        const hasPrivateSteuern = existingAuftragBezeichnungen.has('Private Steuern');

        // Rule 1: Einkommensteuer Priority
        if (leistungsartKurz === 'Einkommensteuer') {
            if (hasPrivateSteuern) return 'Private Steuern'; // Prefer Private Steuern if it exists
            if (hasAbschluss) return 'Abschluß';         // Fallback to Abschluss if it exists
            return baseMapping[leistungsartKurz] || null; // Fallback to base map (should be Private Steuern) or null
        }

        // Rule 2: Abschlussarbeiten Priority
        if (abschlussArbeitenKeys.has(leistungsartKurz)) {
            if (hasAbschluss) return 'Abschluß';         // Prefer Abschluss if it exists
            if (hasPrivateSteuern) return 'Private Steuern'; // Fallback to Private Steuern if it exists
            return baseMapping[leistungsartKurz] || null; // Fallback to base map (should be Abschluss) or null
        }

        // Default Rule for others: Map using baseMapping ONLY if the target exists for the Mandant
        const potentialTarget = baseMapping[leistungsartKurz];
        if (potentialTarget && existingAuftragBezeichnungen.has(potentialTarget)) {
            return potentialTarget;
        }
        
        // If base mapping target doesn't exist for Mandant, or base map is null, ignore
        return null; 
    }

    // --- Adjust generateReports: AllocatedPlanstunden = PlanstundenBasis --- 
    function generateReports(linkedData, capacityData) {
        // Filter orders
        const activeOrders = linkedData.filter(order => 
            ['Offen', 'In Arbeit'].includes(order.Auftragsstatus_Bez));
        const completedOrders = linkedData.filter(order => 
            order.Auftragsstatus_Bez === 'Abgeschlossen');

        // --- Step 1: Assign PlanstundenBasis directly as AllocatedPlanstunden ---
        // No more division needed as PlanstundenBasis is now specific to the Auftrag
        const activeOrdersWithAllocatedHours = activeOrders.map(order => {
             // Ensure PlanstundenBasis is a number, default to 0 if undefined/NaN
            const planstunden = parseFloat(order.PlanstundenBasis);
            return {
                ...order,
                AllocatedPlanstunden: isNaN(planstunden) ? 0 : planstunden
            };
        });
        
        // --- Step 2: Group by employee, summing these directly assigned AllocatedPlanstunden ---
        const activeOrdersByEmployee = groupAndAggregate(activeOrdersWithAllocatedHours, 
            ['MitarbeiterNummer', 'MitarbeiterName'], 
            { 'AllocatedPlanstunden': sum, 'Auftrag': count }); // Sum the specific AllocatedPlanstunden
        
        // Group completed orders - Sum PlanstundenBasis (specific historical hours)
        const completedOrdersByEmployee = groupAndAggregate(completedOrders, 
            ['MitarbeiterNummer', 'MitarbeiterName'], 
            { 'PlanstundenBasis': sum, 'Auftrag': count });
        
        const employeeCapacity = capacityData;
        
        console.log('Generierte Berichte (activeOrdersByEmployee with allocated hours):', activeOrdersByEmployee.slice(0, 5));
        console.log('Generierte Berichte (completedOrdersByEmployee):', completedOrdersByEmployee.slice(0, 5));
        console.log('Generierte Berichte (employeeCapacity):', employeeCapacity.slice(0, 5));
        console.log('Generierte Berichte (detailed active orders with allocated hours):', activeOrdersWithAllocatedHours.slice(0, 5)); // Log the new list
        if (activeOrdersByEmployee.length === 0 && activeOrders.length > 0) {
             console.warn('WARNUNG: Aktive Aufträge vorhanden, aber Gruppierung fehlgeschlagen!');
        }
         if (completedOrdersByEmployee.length === 0 && completedOrders.length > 0) {
             console.warn('WARNUNG: Abgeschlossene Aufträge vorhanden, aber Gruppierung fehlgeschlagen!');
        }
        return {
            activeOrdersByEmployee,
            completedOrdersByEmployee,
            employeeCapacity,
            activeOrdersWithAllocatedHours // Return the detailed list
        };
    }

    // --- Adjust mergeCapacityWithOrders to use AllocatedPlanstunden ---
    function mergeCapacityWithOrders(employeeCapacity, activeOrdersByEmployee) {
        const activeOrdersSumByEmployee = {};
        activeOrdersByEmployee.forEach(order => {
            const nummer = order.MitarbeiterNummer;
            if (!activeOrdersSumByEmployee[nummer]) {
                activeOrdersSumByEmployee[nummer] = 0;
            }
            // --- Use AllocatedPlanstunden for planned hours ---
            let plannedHours = parseFloat(order['AllocatedPlanstunden']); 
            if (isNaN(plannedHours)) plannedHours = 0;
            activeOrdersSumByEmployee[nummer] += plannedHours;
        });
        
        const mergedData = employeeCapacity.map(employee => {
            let plannedHours = activeOrdersSumByEmployee[employee.MitarbeiterNummer] || 0;
            let kapazitaet = parseFloat(employee['Verfügbare Kapazität']);
            if (isNaN(kapazitaet)) kapazitaet = 0;
            let auslastung = kapazitaet > 0 ? (plannedHours / kapazitaet) * 100 : 0;
            return {
                ...employee,
                'Geplante Stunden': plannedHours, 
                'Verfügbare Kapazität': kapazitaet,
                'Auslastung (%)': auslastung
            };
        });
        
        console.log('Zusammengeführte Daten (mergedData für Kapazitätstabelle):', mergedData.slice(0, 5));
        return mergedData;
    }

    // --- Adjust populateCapacityTable to use 'Geplante Stunden' and add conditional formatting ---
    function populateCapacityTable(mergedData) {
        const tableBody = document.querySelector('#capacityTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        
        // Get the target modal element once
        const plannedHoursModalEl = document.getElementById('plannedHoursModal');
        
        mergedData.forEach(employee => {
            const row = document.createElement('tr');
            // Adjusted Tailwind classes for light theme table rows
            row.className = 'bg-white border-b hover:bg-gray-50'; 
            
            const mitarbeiterNummer = employee.MitarbeiterNummer;
            const mitarbeiterName = employee.MitarbeiterName || `Mitarbeiter ${mitarbeiterNummer}`;
            const arbeitszeit = !isNaN(employee['Arbeitszeit in Stunden']) ? parseFloat(employee['Arbeitszeit in Stunden']).toFixed(2) : '0.00';
            const kapazitaet = !isNaN(employee['Verfügbare Kapazität']) ? parseFloat(employee['Verfügbare Kapazität']).toFixed(2) : '0.00';
            const geplanteStunden = !isNaN(employee['Geplante Stunden']) ? parseFloat(employee['Geplante Stunden']).toFixed(2) : '0.00';
            const auslastung = !isNaN(employee['Auslastung (%)']) ? parseFloat(employee['Auslastung (%)']) : 0;
            
            // Conditional formatting for Auslastung
            let auslastungClass = '';
            if (auslastung > 100) {
                auslastungClass = 'bg-red-100 text-red-800 font-semibold';
            } else if (auslastung >= 80) {
                auslastungClass = 'bg-yellow-100 text-yellow-800 font-semibold';
            } else {
                auslastungClass = 'bg-green-100 text-green-800';
            }
            
            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${mitarbeiterName}</td>
                <td class="px-6 py-4 text-right">${arbeitszeit}</td>
                <td class="px-6 py-4 text-right">${kapazitaet}</td>
                <td class="px-6 py-4 text-right">${geplanteStunden}</td>
                <td class="px-6 py-4 text-right ${auslastungClass}">${auslastung.toFixed(2)}%</td> 
            `;
            
            // Add click listener to the row
            row.style.cursor = 'pointer';
            // Remove data-modal-* attributes
            // row.setAttribute('data-modal-target', 'plannedHoursModal');
            // row.setAttribute('data-modal-toggle', 'plannedHoursModal');
            row.addEventListener('click', () => {
                // Create a new Flowbite modal instance on click
                const modalInstance = new Modal(plannedHoursModalEl, {}); // Options can be added if needed
                showPlannedHoursCalculationDetails(mitarbeiterNummer, mitarbeiterName, employee, modalInstance);
            });
            
            tableBody.appendChild(row);
        });
    }

    // New function to show planned hours calculation details
    function showPlannedHoursCalculationDetails(mitarbeiterNummer, mitarbeiterName, employeeData, modalInstance) {
        // Ensure modalInstance and its target element exist
        if (!modalInstance || !modalInstance._targetEl) {
            console.error('Invalid modal instance or target element for plannedHoursModal.');
            return;
        }
        const modalElement = modalInstance._targetEl;
        
        // Populate the modal title
        document.getElementById('modalPlannedHoursEmployeeName').textContent = mitarbeiterName;

        // Populate basic calculation info
        document.getElementById('modalWeeklyHours').textContent = employeeData['Arbeitszeit in Stunden'].toFixed(2);
        document.getElementById('modalWeeksRemaining').textContent = employeeData['Arbeitstage bis Enddatum'];
        document.getElementById('modalTotalCapacity').textContent = employeeData['Verfügbare Kapazität'].toFixed(2);
        document.getElementById('modalTotalPlannedHours').textContent = employeeData['Geplante Stunden'].toFixed(2);
        document.getElementById('modalUtilization').textContent = employeeData['Auslastung (%)'].toFixed(2);

        const employeeOrders = detailedActiveOrders ? detailedActiveOrders.filter(order => order.MitarbeiterNummer === mitarbeiterNummer) : [];
        
        const tableBody = document.getElementById('plannedHoursTableBody');
        if (!tableBody) return;
        tableBody.innerHTML = ''; 

        // Pre-initialize the historical modal
        const historicalModalEl = document.getElementById('historicalHoursDetailsModal');
        if (!historicalModalEl) {
            console.error('Could not find historicalHoursDetailsModal element');
        }

        if (employeeOrders.length === 0) {
            // Ensure colspan matches number of columns (7)
            tableBody.innerHTML = '<tr class="bg-white border-b"><td colspan="7" class="px-6 py-4 text-center text-gray-500">Keine aktiven Aufträge für diesen Mitarbeiter gefunden.</td></tr>';
        } else {
            employeeOrders.forEach(order => {
                const row = document.createElement('tr');
                // Adjusted Tailwind classes for light theme table rows
                row.className = 'bg-white border-b hover:bg-gray-50';

                const historicalHours = order.PlanstundenBasis !== undefined ? parseFloat(order.PlanstundenBasis).toFixed(2) : '0.00';
                const allocatedHours = order.AllocatedPlanstunden !== undefined ? parseFloat(order.AllocatedPlanstunden).toFixed(2) : '0.00';
                
                row.innerHTML = `
                    <td class="px-6 py-4">${order.Auftrag || ''}</td>
                    <td class="px-6 py-4">${order.Auftragsbezeichnung || ''}</td>
                    <td class="px-6 py-4">${order.Mandant || ''}</td>
                    <td class="px-6 py-4">${order.VJ || ''}</td>
                    <td class="px-6 py-4">${order.Kategorie || ''}</td>
                    <td class="px-6 py-4 historical-hours-cell text-blue-600 underline cursor-pointer hover:text-blue-800">${historicalHours}</td>
                    <td class="px-6 py-4">${allocatedHours}</td>
                `;

                tableBody.appendChild(row);
                
                // Find the historical cell after it's been added to the DOM
                const historicalCell = row.querySelector('.historical-hours-cell');
                if (historicalCell && historicalModalEl) {
                    historicalCell.addEventListener('click', function(e) {
                        e.stopPropagation(); 
                        e.preventDefault();
                        console.log('Historical hours cell clicked for order:', order.Auftrag);
                        
                        try {
                            // Initialize the modal properly
                            if (typeof Modal === 'undefined') {
                                console.error('Flowbite Modal constructor not found');
                                return;
                            }
                            
                            // Create a new modal instance directly with the DOM element
                            const histModal = new Modal(historicalModalEl, {
                                placement: 'center',
                                backdrop: 'dynamic',
                                backdropClasses: 'bg-gray-900 bg-opacity-50 dark:bg-opacity-80 fixed inset-0 z-40',
                                closable: true,
                            });
                            
                            // Populate content
                            showHistoricalHoursCalculationDetails(order, rechnungenData, histModal);
                            
                            // Show modal
                            histModal.show();
                            
                            // Add global event handlers for close buttons
                            const closeButtons = historicalModalEl.querySelectorAll('[data-modal-hide="historicalHoursDetailsModal"]');
                            closeButtons.forEach(btn => {
                                btn.addEventListener('click', function() {
                                    console.log('Close button clicked, hiding modal');
                                    histModal.hide();
                                });
                            });
                        } catch (error) {
                            console.error('Error showing historical modal:', error);
                        }
                    });
                } else {
                    console.error('Could not find historical-hours-cell or historicalHoursDetailsModal');
                }
            });
        }
        
        // Explicitly show the modal
        if(modalInstance) modalInstance.show(); 

        // --- Add hide listeners to close buttons ---
        const modalRoot = modalInstance._targetEl;
        if (modalRoot) {
            const closeButtons = modalRoot.querySelectorAll('[data-modal-hide="plannedHoursModal"]');
            closeButtons.forEach(button => {
                button.addEventListener('click', () => modalInstance.hide());
            });
        }
        // --- End hide listeners ---
    }

    // --- New function to show historical hours calculation details ---
    function showHistoricalHoursCalculationDetails(order, rechnungenData, modalInstance) {
        console.log('Showing historical details for order:', order.Auftrag);
        
        // Ensure modalInstance and its target element exist
        if (!modalInstance || !modalInstance._targetEl) {
            console.error('Invalid modal instance or target element for historicalHoursDetailsModal.');
            return;
        }
        
        // Get the modal DOM element
        const modalRoot = modalInstance._targetEl;
        
        // Populate the modal title with order information
        const modalHistOrderTitle = document.getElementById('historicalHoursDetailsModalLabel');
        if (modalHistOrderTitle) {
            modalHistOrderTitle.textContent = `Berechnung der historischen Stunden für ${order.Auftragsbezeichnung || ''}`;
        }
        
        // Update order details fields
        const modalHistOrderAuftrag = document.getElementById('modalHistOrderAuftrag');
        if (modalHistOrderAuftrag) modalHistOrderAuftrag.textContent = order.Auftrag || 'N/A';
        
        const modalHistOrderBezeichnung = document.getElementById('modalHistOrderBezeichnung');
        if (modalHistOrderBezeichnung) modalHistOrderBezeichnung.textContent = order.Auftragsbezeichnung || 'N/A';
        
        const modalHistOrderMandant = document.getElementById('modalHistOrderMandant');
        if (modalHistOrderMandant) modalHistOrderMandant.textContent = order.Mandant || 'N/A';
        
        // Update VJ display
        const modalHistOrderVJ = document.getElementById('modalHistOrderVJ');
        if (modalHistOrderVJ) modalHistOrderVJ.textContent = order.HistorischeBasisVJ || 'N/A';
        
        const modalHistOrderVJText = document.getElementById('modalHistOrderVJText');
        if (modalHistOrderVJText) modalHistOrderVJText.textContent = order.HistorischeBasisVJ || 'N/A';
        
        // Update total hours
        const modalHistOrderTotalHours = document.getElementById('modalHistOrderTotalHours');
        if (modalHistOrderTotalHours) {
            const totalHours = parseFloat(order.PlanstundenBasis) || 0;
            console.log('Setting total hours to:', totalHours, 'from order.PlanstundenBasis:', order.PlanstundenBasis);
            modalHistOrderTotalHours.textContent = totalHours.toFixed(2);
        }
        
        const tableBody = document.getElementById('historicalHoursTableBody');
        if (!tableBody) {
            console.error('Could not find historicalHoursTableBody element');
            return;
        }
        tableBody.innerHTML = '';
        
        // Find matching Rechnungen for this order's Mandant and mapped Auftragsbezeichnung
        const mandantKey = order.Mandant;
        const auftragBezKey = order.AuftragsbezeichnungKey;
        
        console.log('Looking for Rechnungen for Mandant:', mandantKey, 'and Auftragsbezeichnung:', auftragBezKey);
        
        // Get or create sample data if fromCSV is true
        let invoiceRecords = [];
        
        // Test data if no records found to demonstrate table
        if (order.HistorischeBasisVJ && order.HistorischeBasisVJ !== 'N/A' && order.PlanstundenBasis > 0) {
            const vjYears = (order.HistorischeBasisVJ || '').split(', ');
            if (vjYears.length > 0 && vjYears[0] !== 'From Aufträge CSV') {
                // Create some demonstration records based on the total hours
                const totalHours = parseFloat(order.PlanstundenBasis) || 0;
                
                if (totalHours > 0) {
                    // If we have VJ years, create a record for each year
                    vjYears.forEach(year => {
                        const hoursPerYear = totalHours / vjYears.length;
                        invoiceRecords.push({
                            Rechnungsnummer: `Beispiel-${year}`,
                            VJNumeric: year,
                            Leistungsart_Kurzbezeichnung_Clean: order.Auftragsbezeichnung || 'Leistung',
                            StundenNumeric: hoursPerYear
                        });
                    });
                }
            }
        }
        
        // Filter Rechnungen for this Mandant
        const mandantRechnungen = rechnungenData.filter(r => r.Mandant === mandantKey);
        console.log('Found', mandantRechnungen.length, 'Rechnungen for this Mandant');
        
        // Get existing Auftragsbezeichnungen for this Mandant (needed for conditional mapping)
        const existingBezeichnungenForMandant = new Set();
        auftraegeData.forEach(auftrag => {
            if (auftrag.Mandant === mandantKey && auftrag.Auftragsbezeichnung) {
                existingBezeichnungenForMandant.add(auftrag.Auftragsbezeichnung.trim());
            }
        });
        
        // Apply conditional mapping to find matching Rechnungen
        const matchingRechnungen = mandantRechnungen.filter(rechnung => {
            const leistungsartKurz = rechnung.Leistungsart_Kurzbezeichnung_Clean;
            const mappedBez = getConditionalMapping(leistungsartKurz, existingBezeichnungenForMandant, leistungsartMapping);
            return mappedBez === auftragBezKey;
        });
        
        console.log('Found', matchingRechnungen.length, 'matching Rechnungen');
        
        // If we found real records, use those
        if (matchingRechnungen.length > 0) {
            invoiceRecords = matchingRechnungen;
        }
        
        if (invoiceRecords.length === 0) {
            // Show message if no records found
            tableBody.innerHTML = `
                <tr class="bg-white border-b">
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        <div class="flex flex-col items-center">
                            <div class="mb-2">Keine passenden Rechnungen gefunden.</div>
                            <div class="text-xs font-normal">
                                Der Wert von ${parseFloat(order.PlanstundenBasis).toFixed(2)} Stunden stammt aus:
                                <span class="font-medium">${order.HistorischeBasisVJ || 'Unbekannt'}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Sort by VJ and display records
            const sortedRecords = [...invoiceRecords].sort((a, b) => (b.VJNumeric || 0) - (a.VJNumeric || 0));
            
            sortedRecords.forEach(record => {
                const row = document.createElement('tr');
                row.className = 'bg-white border-b hover:bg-gray-50';
                
                const stunden = record.StundenNumeric !== undefined ? 
                    parseFloat(record.StundenNumeric).toFixed(2) : '0.00';
                
                row.innerHTML = `
                    <td class="px-6 py-4">${record.Rechnungsnummer || ''}</td>
                    <td class="px-6 py-4">${record.VJNumeric || ''}</td>
                    <td class="px-6 py-4">${record.Mitarbeiter || '-'}</td>
                    <td class="px-6 py-4">${record.Leistungsart_Kurzbezeichnung_Clean || ''}</td>
                    <td class="px-6 py-4">${stunden}</td>
                    <td class="px-6 py-4">${record.Betrag || '-'}</td>
                `;
                tableBody.appendChild(row);
            });
            
            // Add a summary row
            const totalHours = invoiceRecords.reduce((sum, r) => sum + (parseFloat(r.StundenNumeric) || 0), 0);
            const summaryRow = document.createElement('tr');
            summaryRow.className = 'bg-gray-100 font-medium';
            summaryRow.innerHTML = `
                <td class="px-6 py-4" colspan="4">Summe:</td>
                <td class="px-6 py-4">${totalHours.toFixed(2)}</td>
                <td class="px-6 py-4"></td>
            `;
            tableBody.appendChild(summaryRow);
        }
        
        // Add event listeners to close buttons
        const closeButtons = modalRoot.querySelectorAll('[data-modal-hide="historicalHoursDetailsModal"]');
        closeButtons.forEach(button => {
            console.log('Adding click listener to close button');
            // Add fresh listener
            button.addEventListener('click', () => {
                console.log('Close button clicked');
                modalInstance.hide();
            });
        });
    }

    // --- populateCompletedOrdersTable still uses PlanstundenBasis ---
    function populateCompletedOrdersTable(completedOrdersByEmployee) {
        const tableBody = document.querySelector('#completedOrdersTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        completedOrdersByEmployee.forEach(order => {
            const row = document.createElement('tr');
             // Adjusted Tailwind classes for light theme table rows
            row.className = 'bg-white border-b hover:bg-gray-50'; // Add hover effect
            const stdMin = order['PlanstundenBasis'] !== undefined ? parseFloat(order['PlanstundenBasis']).toFixed(2) : '0.00'; 
            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${order.MitarbeiterName || order.MitarbeiterNummer}</td>
                <td class="px-6 py-4">${stdMin}</td>
                <td class="px-6 py-4">${order.Auftrag || 0}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Function to calculate capacity
    function calculateCapacity(arbeitsstunden, endDate) {
        if (!arbeitsstunden || !endDate) {
            throw new Error('Fehlende Daten für die Kapazitätsberechnung');
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDateObj = parseDate(endDate);
        endDateObj.setHours(0, 0, 0, 0);
        if (endDateObj < today) {
            throw new Error('Enddatum darf nicht in der Vergangenheit liegen');
        }
        
        // Define German (Bavarian) holidays
        const holidays = getGermanHolidays(today.getFullYear(), endDateObj.getFullYear());
        
        // Count working days (Monday-Friday, excluding holidays)
        const workingDays = countWorkingDays(today, endDateObj, holidays);
        
        // Assuming typical work week of 5 days
        const daysPerWorkWeek = 5;
        
        const uniqueEmployees = new Map(); // Use a Map to track unique employees

        arbeitsstunden.forEach(employee => {
            const nummer = employee['Mitarbeiter Nummer'] ? employee['Mitarbeiter Nummer'].toString().trim() : '';
            if (nummer === '' || uniqueEmployees.has(nummer)) { // Skip if empty or already processed
                 if (uniqueEmployees.has(nummer)){
                     console.warn(`Doppelter Mitarbeiter Nummer in Arbeitsstunden gefunden und ignoriert: ${nummer}`);
                 }
                 return; 
            }

            const name = employee['Mitarbeiter'] ? employee['Mitarbeiter'].toString().trim() : '';
            let arbeitszeitPerWeek = parseFloat(employee['Arbeitszeit in Stunden']);
            if (isNaN(arbeitszeitPerWeek)) arbeitszeitPerWeek = 0;
            
            // Calculate daily hours (divide weekly hours by 5 working days)
            const arbeitszeitPerDay = arbeitszeitPerWeek / daysPerWorkWeek;
            
            // Calculate available capacity based on actual working days
            const verfuegbareKapazitaet = arbeitszeitPerDay * workingDays;
            
            const employeeData = {
                MitarbeiterNummer: nummer,
                MitarbeiterName: name || `Mitarbeiter ${nummer}`,
                'Arbeitszeit in Stunden': arbeitszeitPerWeek,
                'Arbeitstage bis Enddatum': workingDays,
                'Verfügbare Kapazität': verfuegbareKapazitaet,
                'Geplante Stunden': 0,
                'Auslastung (%)': 0
            };
            uniqueEmployees.set(nummer, employeeData); // Add to map, ensuring uniqueness
        });

        const capacityData = Array.from(uniqueEmployees.values()); // Convert map values back to array
        
        console.log('Kapazitätsberechnung (capacityData - unique):', capacityData.slice(0, 5));
        console.log(`Berechnung basiert auf ${workingDays} Arbeitstagen zwischen ${today.toLocaleDateString()} und ${endDateObj.toLocaleDateString()}`);
        
        if (capacityData.length === 0) {
             console.warn('WARNUNG: Keine Mitarbeiterkapazitäten berechnet (Arbeitsstunden überprüfen)!');
        }
        return capacityData;
    }

    // Helper function to count working days between two dates
    function countWorkingDays(startDate, endDate, holidays) {
        let count = 0;
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const dateString = formatDate(currentDate);
            
            // Check if it's a weekday (Monday-Friday) and not a holiday
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateString)) {
                count++;
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return count;
    }

    // Helper function to format date as YYYY-MM-DD for comparison
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper function to generate German (Bavarian) holidays for given years
    function getGermanHolidays(startYear, endYear) {
        const holidays = [];
        
        for (let year = startYear; year <= endYear; year++) {
            // Fixed holidays
            holidays.push(
                `${year}-01-01`, // Neujahr
                `${year}-01-06`, // Heilige Drei Könige (Bayern)
                `${year}-05-01`, // Tag der Arbeit
                `${year}-08-15`, // Mariä Himmelfahrt (Bayern)
                `${year}-10-03`, // Tag der Deutschen Einheit
                `${year}-11-01`, // Allerheiligen (Bayern)
                `${year}-12-25`, // 1. Weihnachtstag
                `${year}-12-26`  // 2. Weihnachtstag
            );
            
            // Calculate Easter Sunday for the year
            const easterDate = calculateEaster(year);
            const easterSunday = new Date(easterDate);
            
            // Good Friday (Karfreitag) - 2 days before Easter
            const goodFriday = new Date(easterSunday);
            goodFriday.setDate(easterSunday.getDate() - 2);
            holidays.push(formatDate(goodFriday));
            
            // Easter Monday (Ostermontag) - 1 day after Easter
            const easterMonday = new Date(easterSunday);
            easterMonday.setDate(easterSunday.getDate() + 1);
            holidays.push(formatDate(easterMonday));
            
            // Ascension Day (Christi Himmelfahrt) - 39 days after Easter
            const ascensionDay = new Date(easterSunday);
            ascensionDay.setDate(easterSunday.getDate() + 39);
            holidays.push(formatDate(ascensionDay));
            
            // Whit Monday (Pfingstmontag) - 50 days after Easter
            const whitMonday = new Date(easterSunday);
            whitMonday.setDate(easterSunday.getDate() + 50);
            holidays.push(formatDate(whitMonday));
            
            // Corpus Christi (Fronleichnam) - 60 days after Easter (Bavaria)
            const corpusChristi = new Date(easterSunday);
            corpusChristi.setDate(easterSunday.getDate() + 60);
            holidays.push(formatDate(corpusChristi));
        }
        
        return holidays;
    }

    // Helper function to calculate Easter Sunday date (Gauss algorithm)
    function calculateEaster(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        
        return new Date(year, month - 1, day);
    }

    // Function to visualize results
    function visualizeResults() {
        if (!employeeCapacity || !activeOrdersByEmployee || !completedOrdersByEmployee) {
            return;
        }
        
        // Clear previous visualizations
        if (capacityChart) capacityChart.destroy();
        if (completedChart) completedChart.destroy();
        
        // Merge employee capacity with active orders and store it
        mergedCapacityData = mergeCapacityWithOrders(employeeCapacity, activeOrdersByEmployee); // <-- Store the result
        
        // Visualize capacity using the stored merged data
        visualizeCapacity(mergedCapacityData); 
        
        // Populate capacity table using the stored merged data
        populateCapacityTable(mergedCapacityData); 
        
        // Populate active orders table (uses activeOrdersByEmployee)
        populateActiveOrdersTable(activeOrdersByEmployee);
        
        // Visualize completed orders
        visualizeCompletedOrders(completedOrdersByEmployee);
        
        // Populate completed orders table
        populateCompletedOrdersTable(completedOrdersByEmployee);
    }

    // Function to visualize capacity (Adjust labels if needed)
    function visualizeCapacity(mergedData) {
        const ctx = document.getElementById('capacityChart')?.getContext('2d');
        if (!ctx) return;
        const employees = mergedData.map(e => e.MitarbeiterName || e.MitarbeiterNummer);
        const availableCapacity = mergedData.map(e => e['Verfügbare Kapazität']);
        const plannedHours = mergedData.map(e => e['Geplante Stunden']);
        
        if (capacityChart) capacityChart.destroy();
        capacityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: employees,
                datasets: [
                    {
                        label: 'Verfügbare Kapazität',
                        data: availableCapacity,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Geplante Stunden',
                        data: plannedHours,
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Stunden' } },
                    x: { title: { display: true, text: 'Mitarbeiter' } }
                },
                plugins: { title: { display: true, text: 'Kapazität und Auslastung je Mitarbeiter' } }, // <<< Added comma here
                // --- Add onClick handler --- 
                onClick: (event, elements) => {
                    if (!elements || elements.length === 0) return; // No bar clicked
                    
                    const clickedElementIndex = elements[0].index;
                    const employeeData = mergedData[clickedElementIndex]; // Get data using index
                    
                    if (!employeeData) {
                         console.error('Could not find employee data for clicked chart element');
                         return;
                    }
                    
                    const plannedHoursModalEl = document.getElementById('plannedHoursModal');
                    if (plannedHoursModalEl) {
                        // Need to get or create the Flowbite modal instance
                        // Flowbite doesn't have a static method to get an existing instance easily based on ID alone.
                        // We'll create a new instance here, assuming Flowbite handles potential duplicates gracefully or replaces.
                        // A more robust approach might involve storing instances when created, but this is simpler.
                        const modalInstance = new Modal(plannedHoursModalEl, {});
                        showPlannedHoursCalculationDetails(
                            employeeData.MitarbeiterNummer,
                            employeeData.MitarbeiterName,
                            employeeData,
                            modalInstance
                        );
                    } else {
                        console.error('Could not find plannedHoursModal element');
                    }
                }
                 // --- End onClick handler ---
            }
        });
    }

    // Function to visualize completed orders (Adjust data key)
    function visualizeCompletedOrders(completedOrdersByEmployee) {
        const ctx = document.getElementById('completedChart')?.getContext('2d');
        if (!ctx) return;
        const topCompleted = completedOrdersByEmployee
            .sort((a, b) => (b['PlanstundenBasis'] || 0) - (a['PlanstundenBasis'] || 0))
            .slice(0, 10);
        
        const employees = topCompleted.map(e => e.MitarbeiterName || e.MitarbeiterNummer);
        const hours = topCompleted.map(e => e['PlanstundenBasis'] || 0); 
        
        // Generate colors dynamically or use a predefined palette
        const backgroundColors = hours.map((_, i) => `hsl(${(i * 360 / hours.length) % 360}, 70%, 70%)`);

        if (completedChart) completedChart.destroy();
        completedChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: employees,
                datasets: [{ data: hours, backgroundColor: backgroundColors, borderWidth: 1 }]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: { display: true, text: 'Top 10 Mitarbeiter nach abgeschl. Stunden' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value.toFixed(2)} Std (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Utility function to update status (adapt classes for light theme)
    function updateStatus(message, type = 'info', silent = false) {
        const statusElement = document.getElementById('status');
        const loadingStatusElement = document.getElementById('loadingStatus');
        if (!statusElement) return;

        // Update status text within the loading overlay if it's active
        if (loadingStatusElement && !loadingOverlay.classList.contains('hidden')) {
             loadingStatusElement.textContent = message;
        }
        
        // If silent is true, don't show the alert box, only update loading text
        if(silent) return;

        let alertClasses = 'p-4 mb-4 text-sm rounded-lg '; // Added mb-4 for spacing
        let iconHtml = '';

        switch (type) {
            case 'success':
                alertClasses += 'bg-green-50 text-green-800';
                iconHtml = '<svg class="flex-shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/></svg>';
                break;
            case 'danger':
                alertClasses += 'bg-red-50 text-red-800';
                iconHtml = '<svg class="flex-shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/></svg>';
                break;
            case 'loading':
                alertClasses += 'bg-blue-50 text-blue-800';
                iconHtml = '<svg aria-hidden="true" class="inline w-4 h-4 me-3 text-blue-400 animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB"/><path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor"/></svg>';
                break;
            default: // info
                alertClasses += 'bg-blue-50 text-blue-800';
                iconHtml = '<svg class="flex-shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/></svg>';
        }

        statusElement.className = alertClasses + ' flex items-center'; // Add flex for icon alignment
        statusElement.innerHTML = `${iconHtml} <span class="sr-only">Info</span> <div>${message}</div>`;
    }

    // Utility function to parse date
    function parseDate(dateStr) {
        const [day, month, year] = dateStr.split('.');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Utility function to group by key
    function groupBy(array, keyGetter) {
        const map = new Map();
        array.forEach((item) => {
            const key = keyGetter(item);
            const collection = map.get(key);
            if (!collection) {
                map.set(key, [item]);
            } else {
                collection.push(item);
            }
        });
        return Object.fromEntries(map);
    }

    // Utility function to count by key
    function countBy(array, key) {
        return array.reduce((acc, obj) => {
            const value = obj[key];
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {});
    }

    // Utility function for sum aggregation
    function sum(values) {
        // --- Log values being summed (only for the first few calls) ---
        if (typeof sum.callCount === 'undefined') {
            sum.callCount = 0;
        }
        if (sum.callCount < 5) {
             console.log('  Summing values:', values);
             sum.callCount++;
        }
        // --- End log ---
        return values.reduce((total, val) => total + (parseFloat(val) || 0), 0);
    }

    // Utility function for count aggregation
    function count(values) {
        return values.length;
    }

    // Utility function to group and aggregate
    function groupAndAggregate(data, groupKeys, aggregations) {
        const groupedData = {};
        
        data.forEach(item => {
            const groupKey = groupKeys.map(key => item[key]).join('-');
            
            if (!groupedData[groupKey]) {
                const groupItem = {};
                groupKeys.forEach(key => {
                    groupItem[key] = item[key];
                });
                Object.keys(aggregations).forEach(aggKey => {
                    groupItem[aggKey] = [];
                });
                groupedData[groupKey] = groupItem;
            }
            
            Object.keys(aggregations).forEach(aggKey => {
                groupedData[groupKey][aggKey].push(item[aggKey]);
            });
        });
        
        return Object.values(groupedData).map(group => {
            const result = { ...group };
            Object.entries(aggregations).forEach(([key, aggFn]) => {
                result[key] = aggFn(group[key]);
            });
            return result;
        });
    }

    // Function to export table data as CSV
    function exportTableToCSV(tableId, filename) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        // Get headers
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
        
        // Get rows
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => 
            Array.from(tr.querySelectorAll('td')).map(td => {
                // Handle special cases (e.g., percentages)
                const text = td.textContent.trim();
                if (text.endsWith('%')) {
                    return text.replace('%', '');
                }
                return text;
            })
        );
        
        // Create CSV content
        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Add export buttons to tables
    function addExportButtons() {
        const tables = ['capacityTable', 'activeOrdersTable', 'completedOrdersTable'];
        const filenames = ['kapazitaet.csv', 'aktive_auftraege.csv', 'abgeschlossene_auftraege.csv'];

        tables.forEach((tableId, index) => {
            const table = document.getElementById(tableId);
            if (table && table.parentNode) { // Check if table and parent node exist
                const exportButton = document.createElement('button');
                // Basic Tailwind button styling - customize as needed
                exportButton.className = 'mb-2 text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-xs px-3 py-1.5 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800';
                exportButton.innerHTML = '<i class="bi bi-download me-1"></i> Export CSV'; // Keep icon for now
                exportButton.onclick = () => exportTableToCSV(tableId, filenames[index]);
                // Insert before the table's parent container (usually the div.relative.overflow-x-auto)
                table.parentNode.parentNode.insertBefore(exportButton, table.parentNode);
            }
        });
    }

    // Add export buttons after ensuring the DOM is ready
    // Might need a small delay or trigger after data population if tables aren't immediately available
    // For now, call it directly
    addExportButtons();
    addTableSorting(); // Add sorting listeners
    addTableFiltering(); // Add filtering listeners

    // --- New Function to Display Validation Reports ---
    function displayValidationReports(reports) {
        const container = document.getElementById('validationReports');
        if (!container) return;
        container.innerHTML = ''; // Clear previous reports
        container.classList.remove('hidden'); // Make sure container is visible
        let hasIssues = false;

        const createReportSection = (title, items, formatter) => {
            if (items && items.length > 0) {
                hasIssues = true;
                const section = document.createElement('div');
                section.className = 'mb-4 p-4 border border-yellow-300 rounded-lg bg-yellow-50';
                const titleElement = document.createElement('h6');
                titleElement.className = 'text-md font-semibold text-yellow-800 mb-2';
                titleElement.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i> ${title} (${items.length})`;
                section.appendChild(titleElement);
                const list = document.createElement('ul');
                list.className = 'list-disc list-inside text-sm text-yellow-700 space-y-1 max-h-32 overflow-y-auto pl-2'; // Limit height and add padding
                items.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'py-0.5'; // Add small vertical padding to list items
                    li.textContent = formatter(item);
                    list.appendChild(li);
                });
                section.appendChild(list);
                container.appendChild(section);
            }
        };

        createReportSection(
            'Mitarbeiter nur in Aufträge gefunden (fehlen in Arbeitsstunden)',
            reports.mitarbeiterNurInAuftraege,
            item => `Nr: ${item}`
        );
        createReportSection(
            'Mitarbeiter nur in Arbeitsstunden gefunden (fehlen in Aufträge)',
            reports.mitarbeiterNurInStunden,
            item => `Nr: ${item}`
        );
        createReportSection(
            'Nicht zugeordnete Leistungsarten (pro Mandant)',
            reports.uniqueUnmapped,
            item => `${item.leistungsart} (${item.context})`
        );
        createReportSection(
            'Aktive Aufträge ohne Stunden (weder initial noch aus Rechnungen)',
            reports.auftraegeMitNullStunden,
            item => `Auftrag ${item.auftrag} (${item.auftragsbezeichnung}) für Mandant ${item.mandant} (Mitarb.: ${item.mitarbeiter})`
        );

        if (!hasIssues) {
            container.innerHTML = '<div class="p-4 text-sm text-green-800 rounded-lg bg-green-50"><i class="bi bi-check-circle-fill me-2"></i>Keine unmittelbaren Datenkonsistenzprobleme gefunden.</div>';
        }
    }

    // --- Global variable to store current sort state ---
    let currentSort = { key: null, direction: 'asc' };

    // --- Helper function to sort table data ---
    function sortTableData(data, key, direction) {
        // Check if the first non-null value is numeric, but explicitly exclude MitarbeiterName initially
        const isPotentiallyNumeric = key !== 'MitarbeiterName' && !isNaN(parseFloat(data.find(item => item?.[key] != null)?.[key]));
        
        return [...data].sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            let compareResult = 0;

            // --- Special handling for sorting by Mitarbeiter column ---
            // We use the key 'MitarbeiterName' from the header, but the actual numeric 
            // value for sorting is in 'MitarbeiterNummer'. Fallback to Name if Nummer is missing/invalid.
            if (key === 'MitarbeiterName') {
                const numA = parseInt(a['MitarbeiterNummer']);
                const numB = parseInt(b['MitarbeiterNummer']);
                const nameA = (a['MitarbeiterName'] || '').toString().toLowerCase(); // Fallback name
                const nameB = (b['MitarbeiterName'] || '').toString().toLowerCase(); // Fallback name

                // Both have valid numbers? Compare numbers.
                if (!isNaN(numA) && !isNaN(numB)) {
                    if (numA !== numB) {
                        compareResult = numA < numB ? -1 : 1;
                    } else { // Tie-break with name if numbers are identical
                        compareResult = nameA.localeCompare(nameB); 
                    }
                } 
                // Only A has a valid number?
                else if (!isNaN(numA)) {
                    compareResult = -1; // Numbered items come first in ASC
                } 
                // Only B has a valid number?
                else if (!isNaN(numB)) {
                    compareResult = 1; // Numbered items come first in ASC
                } 
                // Neither has a valid number? Compare by name.
                else {
                    compareResult = nameA.localeCompare(nameB);
                }
            } 
            // --- End special handling ---
            
            // --- General handling for other columns ---
            else {
                 let compareA, compareB;
                 if (isPotentiallyNumeric) {
                    compareA = parseFloat(valA) || 0;
                    compareB = parseFloat(valB) || 0;
                } else {
                    compareA = (valA || '').toString().toLowerCase();
                    compareB = (valB || '').toString().toLowerCase();
                }

                if (compareA < compareB) compareResult = -1;
                else if (compareA > compareB) compareResult = 1;
                else compareResult = 0;
            }
            // --- End general handling ---

            // --- Apply Direction ---
            // Invert result for descending order
            return direction === 'asc' ? compareResult : -compareResult; 
            // --- End Apply Direction ---
        });
    }

    // --- Function to add sorting listeners to tables using Event Delegation ---
    function addTableSorting() {
        console.log("Attempting to add sorting listeners using delegation..."); // Debug log
        const capacityTableTHead = document.querySelector('#capacityTable thead');
        
        if (capacityTableTHead) {
             console.log(`Found capacity table thead. Attaching listener.`); // Debug log
             capacityTableTHead.addEventListener('click', (event) => {
                const header = event.target.closest('th[data-sort-key]'); // Find the clicked header
                if (!header) return; // Click wasn't on a sortable header
                
                const sortKey = header.getAttribute('data-sort-key');
                console.log(`Header clicked! Sort key: ${sortKey}`); // Debug log
                
                if (!mergedCapacityData || mergedCapacityData.length === 0) { 
                    console.error('Sorting aborted: mergedCapacityData is not available or empty.');
                    return; 
                }
                console.log('Current mergedCapacityData:', mergedCapacityData.slice(0, 3));

                // Determine sort direction
                let direction = 'asc';
                if (currentSort.key === sortKey && currentSort.direction === 'asc') {
                    direction = 'desc';
                } 
                currentSort = { key: sortKey, direction };

                // Sort the data
                const sortedData = sortTableData(mergedCapacityData, sortKey, direction);
                console.log('Sorted data (sample):', sortedData.slice(0, 3));
                mergedCapacityData = sortedData; // Update the global data with sorted version

                // Re-populate the table
                console.log('Repopulating capacity table...');
                populateCapacityTable(mergedCapacityData);
                
                // Update header icons
                const allHeaders = capacityTableTHead.querySelectorAll('th[data-sort-key]');
                updateSortIcons(allHeaders, sortKey, direction);
            });
        } else {
             console.error("Could not find #capacityTable thead to attach sorting listener.");
        }

        // Add similar logic for Active Orders table
        const activeOrdersTableTHead = document.querySelector('#activeOrdersTable thead');
        if (activeOrdersTableTHead) {
            console.log(`Found active orders table thead. Attaching listener.`); // Debug log
            activeOrdersTableTHead.addEventListener('click', (event) => {
                const header = event.target.closest('th[data-sort-key]');
                if (!header) return;

                const sortKey = header.getAttribute('data-sort-key');
                console.log(`Active Orders Header clicked! Sort key: ${sortKey}`); // Debug log

                if (!activeOrdersByEmployee || activeOrdersByEmployee.length === 0) {
                    console.error('Sorting aborted: activeOrdersByEmployee is not available or empty.');
                    return;
                }
                // --- ADD THIS LOG --- 
                console.log('Data BEFORE sort (Active Orders - Sample):', JSON.stringify(activeOrdersByEmployee.slice(0, 5))); 
                // --- END ADD LOG ---

                // Determine sort direction (using the SAME currentSort global state for simplicity, 
                // or create a separate one if independent sorting is needed)
                let direction = 'asc';
                if (currentSort.key === sortKey && currentSort.direction === 'asc') {
                    direction = 'desc';
                } 
                currentSort = { key: sortKey, direction }; // Update global sort state

                // Sort the data
                const sortedData = sortTableData(activeOrdersByEmployee, sortKey, direction);
                // --- ADD THIS LOG ---
                console.log('Data AFTER sort (Active Orders - Sample):', JSON.stringify(sortedData.slice(0, 5))); 
                // --- END ADD LOG ---
                activeOrdersByEmployee = sortedData; // Update the global data

                // Re-populate the table
                console.log('Repopulating active orders table...');
                populateActiveOrdersTable(activeOrdersByEmployee);

                // Update header icons
                const allHeaders = activeOrdersTableTHead.querySelectorAll('th[data-sort-key]');
                updateSortIcons(allHeaders, sortKey, direction);
            });
        } else {
            console.error("Could not find #activeOrdersTable thead to attach sorting listener.");
        }
        
        // Add similar logic for Completed Orders table if needed
        // ...
    }

    // --- Helper function to update sort icons ---
    function updateSortIcons(headers, activeKey, direction) {
        headers.forEach(header => {
            const icon = header.querySelector('i.bi');
            if (!icon) return;
            const key = header.getAttribute('data-sort-key');
            if (key === activeKey) {
                icon.className = direction === 'asc' ? 'bi bi-arrow-down text-xs' : 'bi bi-arrow-up text-xs';
            } else {
                icon.className = 'bi bi-arrow-down-up text-xs text-gray-400'; // Reset other icons
            }
        });
    }

    // --- Function to add filtering listeners to tables ---
    function addTableFiltering() {
        console.log("Attempting to add filtering listeners...");

        const capacityFilterInput = document.getElementById('capacityFilter');
        if (capacityFilterInput) {
            capacityFilterInput.addEventListener('input', (event) => {
                const filterValue = event.target.value.toLowerCase().trim();
                console.log(`Filtering capacity table with: "${filterValue}"`);

                if (!mergedCapacityData || mergedCapacityData.length === 0) {
                    console.warn("No capacity data available to filter.");
                    return;
                }

                // Filter the data (based on the currently stored mergedCapacityData)
                // This filters based on ANY value in the row containing the filter text
                const filteredData = mergedCapacityData.filter(employee => {
                    // Check relevant fields (adjust as needed)
                    const name = (employee.MitarbeiterName || '').toLowerCase();
                    const nummer = (employee.MitarbeiterNummer || '').toString(); // Keep number as string for checking
                    // We don't typically filter by numeric values directly unless specified
                    // const kapazitaet = (employee['Verfügbare Kapazität'] || '').toString();
                    // const geplant = (employee['Geplante Stunden'] || '').toString();
                    // const auslastung = (employee['Auslastung (%)'] || '').toString();
                    
                    // Return true if the filter value is found in name or number
                    return name.includes(filterValue) || nummer.includes(filterValue);
                });
                
                console.log(`Filtered data count: ${filteredData.length}`);

                // Re-populate the table with filtered data
                populateCapacityTable(filteredData);
            });
            console.log("Capacity filter listener added.");
        } else {
             console.error("Could not find #capacityFilter input.");
        }

        // Add similar logic for Active Orders table
        const activeOrdersFilterInput = document.getElementById('activeOrdersFilter');
        if (activeOrdersFilterInput) {
            activeOrdersFilterInput.addEventListener('input', (event) => {
                 const filterValue = event.target.value.toLowerCase().trim();
                console.log(`Filtering active orders table with: "${filterValue}"`);

                if (!activeOrdersByEmployee || activeOrdersByEmployee.length === 0) {
                    console.warn("No active orders data available to filter.");
                    return;
                }

                // Filter the data (based on the currently stored activeOrdersByEmployee)
                const filteredData = activeOrdersByEmployee.filter(order => {
                    const name = (order.MitarbeiterName || '').toLowerCase();
                    const nummer = (order.MitarbeiterNummer || '').toString();
                    
                    return name.includes(filterValue) || nummer.includes(filterValue);
                });
                
                console.log(`Filtered active orders data count: ${filteredData.length}`);

                // Re-populate the table with filtered data
                populateActiveOrdersTable(filteredData);
            });
             console.log("Active Orders filter listener added.");
        } else {
            console.error("Could not find #activeOrdersFilter input.");
        }
        
        // Add similar logic for other tables if needed
        // ...
    }

    // Function to populate the active orders table
    function populateActiveOrdersTable(activeOrdersByEmployee) {
        const tableBody = document.querySelector('#activeOrdersTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        
        activeOrdersByEmployee.forEach(order => {
            const row = document.createElement('tr');
            // Adjusted Tailwind classes for light theme table rows
            row.className = 'bg-white border-b hover:bg-gray-50';
            
            const allocatedHours = order['AllocatedPlanstunden'] !== undefined ? 
                parseFloat(order['AllocatedPlanstunden']).toFixed(2) : '0.00';
            const orderCount = order['Auftrag'] !== undefined ? order['Auftrag'] : '0';
            
            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${order.MitarbeiterName || order.MitarbeiterNummer}</td>
                <td class="px-6 py-4 text-right">${allocatedHours}</td>
                <td class="px-6 py-4 text-right">${orderCount}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- populateCompletedOrdersTable still uses PlanstundenBasis ---
}); 