document.addEventListener('DOMContentLoaded', function() {
    // Initialize date picker
    flatpickr('#endDate', {
        dateFormat: 'd.m.Y',
        locale: 'de',
        defaultDate: new Date(new Date().setMonth(new Date().getMonth() + 3)) // Default to 3 months from now
    });

    // Initialize Flowbite modals
    initializeFlowbiteModals();

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

    // Function to update status message 
    function updateStatus(message, type = 'info', hideAlert = false) {
        const statusElement = document.getElementById('status');
        if (!statusElement) return;
        
        // Set the message
        statusElement.textContent = message;
        
        // Remove all existing status classes
        statusElement.classList.remove(
            'text-blue-800', 'bg-blue-50',    // info
            'text-green-800', 'bg-green-50',  // success
            'text-red-800', 'bg-red-50',      // danger
            'text-yellow-800', 'bg-yellow-50' // loading/warning
        );
        
        // Add appropriate styling based on type
        switch (type) {
            case 'success':
                statusElement.classList.add('text-green-800', 'bg-green-50');
                break;
            case 'danger':
                statusElement.classList.add('text-red-800', 'bg-red-50');
                break;
            case 'loading':
                statusElement.classList.add('text-yellow-800', 'bg-yellow-50');
                break;
            case 'info':
            default:
                statusElement.classList.add('text-blue-800', 'bg-blue-50');
                break;
        }
        
        // Show or hide the alert
        if (hideAlert) {
            statusElement.classList.add('hidden');
        } else {
            statusElement.classList.remove('hidden');
        }
    }

    // Function to display validation reports in the UI
    function displayValidationReports(validationData) {
        const { 
            mitarbeiterNurInAuftraege = [], 
            mitarbeiterNurInStunden = [], 
            uniqueUnmapped = [], 
            auftraegeMitNullStunden = [] 
        } = validationData;
        
        const validationReportsContainer = document.getElementById('validationReports');
        if (!validationReportsContainer) return;
        
        // Clear previous content
        validationReportsContainer.innerHTML = '';
        
        // Build the validation report
        const reports = [];
        
        // Add employee mismatches warning
        if (mitarbeiterNurInAuftraege.length > 0 || mitarbeiterNurInStunden.length > 0) {
            reports.push(`
                <div class="p-4 mb-2 text-sm text-yellow-800 rounded-lg bg-yellow-50">
                    <div class="font-medium mb-2">Mitarbeiter-Abgleich:</div>
                    <ul class="list-disc pl-5">
                        ${mitarbeiterNurInAuftraege.length > 0 ? 
                            `<li>${mitarbeiterNurInAuftraege.length} Mitarbeiter nur in Aufträgen vorhanden</li>` : ''}
                        ${mitarbeiterNurInStunden.length > 0 ? 
                            `<li>${mitarbeiterNurInStunden.length} Mitarbeiter nur in Arbeitsstunden vorhanden</li>` : ''}
                    </ul>
                </div>
            `);
        }
        
        // Add unmapped Leistungsarten warning
        if (uniqueUnmapped && uniqueUnmapped.length > 0) {
            reports.push(`
                <div class="p-4 mb-2 text-sm text-yellow-800 rounded-lg bg-yellow-50">
                    <div class="font-medium mb-2">Nicht zugeordnete Leistungsarten:</div>
                    <p>${uniqueUnmapped.length} Leistungsarten konnten keiner Auftragsbezeichnung zugeordnet werden.</p>
                </div>
            `);
        }
        
        // Add orders with zero hours warning
        if (auftraegeMitNullStunden && auftraegeMitNullStunden.length > 0) {
            reports.push(`
                <div class="p-4 mb-2 text-sm text-yellow-800 rounded-lg bg-yellow-50">
                    <div class="font-medium mb-2">Aufträge ohne Stunden:</div>
                    <p>${auftraegeMitNullStunden.length} Aufträge haben 0 Stunden (keine historischen Daten oder keine Initial-Stunden).</p>
                </div>
            `);
        }
        
        // Add the reports to the container
        if (reports.length > 0) {
            validationReportsContainer.innerHTML = reports.join('');
            validationReportsContainer.classList.remove('hidden');
        } else {
            validationReportsContainer.classList.add('hidden');
        }
    }

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

    // Function to group and aggregate data
    function groupAndAggregate(data, groupByKey, aggregationConfig) {
        const grouped = {};
        
        // Group the data
        data.forEach(item => {
            const key = item[groupByKey];
            if (!key) return; // Skip items without the key
            
            if (!grouped[key]) {
                grouped[key] = {
                    count: 0,
                    items: [],
                    sums: {}
                };
                
                // Initialize sums for all configured metrics
                if (aggregationConfig.sum) {
                    aggregationConfig.sum.forEach(field => {
                        grouped[key].sums[field] = 0;
                    });
                }
            }
            
            grouped[key].count++;
            grouped[key].items.push(item);
            
            // Sum up the configured metrics
            if (aggregationConfig.sum) {
                aggregationConfig.sum.forEach(field => {
                    const value = parseFloat(item[field]) || 0;
                    grouped[key].sums[field] += value;
                });
            }
        });
        
        return grouped;
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
        if (!tableBody) {
            console.error('Could not find plannedHoursTableBody element');
            return;
        }
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
            // Create table content first
            let tableHTML = '';
            
            // Generate table HTML
            employeeOrders.forEach(order => {
                const historicalHours = order.PlanstundenBasis !== undefined ? parseFloat(order.PlanstundenBasis).toFixed(2) : '0.00';
                const allocatedHours = order.AllocatedPlanstunden !== undefined ? parseFloat(order.AllocatedPlanstunden).toFixed(2) : '0.00';
                
                tableHTML += `
                    <tr class="bg-white border-b hover:bg-gray-50">
                        <td class="px-6 py-4">${order.Auftrag || ''}</td>
                        <td class="px-6 py-4">${order.Auftragsbezeichnung || ''}</td>
                        <td class="px-6 py-4">${order.Mandant || ''}</td>
                        <td class="px-6 py-4">${order.VJ || ''}</td>
                        <td class="px-6 py-4">${order.Kategorie || ''}</td>
                        <td class="px-6 py-4 historical-hours-cell text-blue-600 underline cursor-pointer hover:text-blue-800" 
                            data-order-id="${order.Auftrag || ''}"
                            data-order-name="${order.Auftragsbezeichnung || ''}"
                            data-order-mandant="${order.Mandant || ''}"
                            data-order-hours="${historicalHours}"
                            data-order-vj="${order.HistorischeBasisVJ || 'N/A'}">${historicalHours}</td>
                        <td class="px-6 py-4">${allocatedHours}</td>
                    </tr>
                `;
            });
            
            // Set table content
            tableBody.innerHTML = tableHTML;
            
            // Now attach click handlers after DOM elements exist
            const historicalCells = tableBody.querySelectorAll('.historical-hours-cell');
            console.log(`Found ${historicalCells.length} historical hours cells to bind events to`);
            
            historicalCells.forEach(cell => {
                cell.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // Find the order by ID
                    const orderId = this.getAttribute('data-order-id');
                    const orderName = this.getAttribute('data-order-name');
                    const orderMandant = this.getAttribute('data-order-mandant');
                    const orderHours = this.getAttribute('data-order-hours');
                    const orderVJ = this.getAttribute('data-order-vj');
                    
                    console.log(`Historical hours cell clicked for order: ${orderId}, ${orderName}, ${orderMandant}, Hours: ${orderHours}`);
                    
                    // Find the real order object
                    const clickedOrder = employeeOrders.find(o => o.Auftrag === orderId);
                    if (!clickedOrder) {
                        console.error('Order not found:', orderId);
                        return;
                    }
                    
                    // Show the historical hours details
                    showHistoricalHoursModal(clickedOrder, rechnungenData);
                });
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

    // Function to show historical hours calculation details
    function showHistoricalHoursModal(order, rechnungenData) {
        // Get the modal element
        const modalEl = document.getElementById('historicalHoursDetailsModal');
        if (!modalEl) {
            console.error('Historical hours modal element not found');
            return;
        }
        
        // Create a new modal instance
        const modalInstance = new Modal(modalEl, {});
        
        // Populate modal content
        showHistoricalHoursCalculationDetails(order, rechnungenData, modalInstance);
        
        // Explicitly show the modal
        modalInstance.show();
    }

    // Function to populate the historical hours modal content
    function showHistoricalHoursCalculationDetails(order, rechnungenData, modalInstance) {
        if (!modalInstance || !modalInstance._targetEl) {
            console.error('Invalid modal instance for historical hours modal');
            return;
        }
        
        const modalElement = modalInstance._targetEl;
        
        // Ensure we have a valid order object
        if (!order || !order.Auftrag) {
            console.error('Invalid order data for historical hours calculation', order);
            return;
        }
        
        // Populate the modal title
        const modalTitle = document.getElementById('modalHistoricalHoursTitle');
        if (modalTitle) {
            modalTitle.textContent = `${order.Auftrag} - ${order.Auftragsbezeichnung || 'Unbekannt'}`;
        }
        
        // Get the calculation source year
        const sourceYear = order.HistorischeBasisVJ || 'N/A';
        const sourceYearEl = document.getElementById('modalHistoricalSourceYear');
        if (sourceYearEl) {
            sourceYearEl.textContent = sourceYear;
        }
        
        // Populate the rest of the basic info
        const orderNumberEl = document.getElementById('modalHistoricalOrderNumber');
        if (orderNumberEl) orderNumberEl.textContent = order.Auftrag || 'N/A';
        
        const orderNameEl = document.getElementById('modalHistoricalOrderName');
        if (orderNameEl) orderNameEl.textContent = order.Auftragsbezeichnung || 'N/A';
        
        const mandantEl = document.getElementById('modalHistoricalMandant');
        if (mandantEl) mandantEl.textContent = order.Mandant || 'N/A';
        
        const totalHoursEl = document.getElementById('modalHistoricalTotalHours');
        if (totalHoursEl) totalHoursEl.textContent = parseFloat(order.PlanstundenBasis || 0).toFixed(2);
        
        // Populate the detailed calculation table
        const tableBody = document.getElementById('historicalHoursDetailsTableBody');
        if (!tableBody) {
            console.error('Could not find historicalHoursDetailsTableBody element');
            return;
        }
        
        tableBody.innerHTML = '';
        
        // Filter rechnungen for this order and source year
        let relevantRechnungen = [];
        if (rechnungenData && Array.isArray(rechnungenData)) {
            relevantRechnungen = rechnungenData.filter(rechnung => 
                rechnung.Auftrag === order.Auftrag && 
                rechnung.VJ === sourceYear
            );
        }
        
        if (relevantRechnungen.length === 0) {
            // No calculations found
            tableBody.innerHTML = '<tr class="bg-white border-b"><td colspan="6" class="px-6 py-4 text-center text-gray-500">Keine historischen Stundenberechnungen gefunden.</td></tr>';
        } else {
            // Create table rows for each rechnung
            let totalHours = 0;
            
            relevantRechnungen.forEach(rechnung => {
                const stunden = parseFloat(rechnung.Stunden || 0);
                totalHours += stunden;
                
                const row = document.createElement('tr');
                row.className = 'bg-white border-b hover:bg-gray-50';
                
                row.innerHTML = `
                    <td class="px-6 py-4">${rechnung.Rechnungsnummer || 'N/A'}</td>
                    <td class="px-6 py-4">${rechnung.Datum || 'N/A'}</td>
                    <td class="px-6 py-4">${rechnung.Leistungszeitraum || 'N/A'}</td>
                    <td class="px-6 py-4">${rechnung.Leistungsart || 'N/A'}</td>
                    <td class="px-6 py-4">${rechnung.Beschreibung || 'N/A'}</td>
                    <td class="px-6 py-4 text-right font-medium">${stunden.toFixed(2)}</td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Add a totals row
            const totalsRow = document.createElement('tr');
            totalsRow.className = 'bg-gray-100 font-semibold';
            totalsRow.innerHTML = `
                <td colspan="5" class="px-6 py-4 text-right">Gesamtstunden:</td>
                <td class="px-6 py-4 text-right">${totalHours.toFixed(2)}</td>
            `;
            tableBody.appendChild(totalsRow);
        }
        
        // Add event listeners to close buttons
        const closeButtons = modalElement.querySelectorAll('[data-modal-hide="historicalHoursDetailsModal"]');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => modalInstance.hide());
        });
    }

    // Function to calculate employee work capacity until a specified end date
    function calculateCapacity(arbeitsstundenData, endDateStr) {
        if (!arbeitsstundenData || !endDateStr) {
            throw new Error('Fehlende Daten für die Kapazitätsberechnung');
        }
        
        // Parse the end date
        const dateParts = endDateStr.split('.');
        if (dateParts.length !== 3) {
            throw new Error('Ungültiges Datumsformat. Bitte TT.MM.JJJJ verwenden.');
        }
        
        const endDate = new Date(
            parseInt(dateParts[2]), // Year
            parseInt(dateParts[1]) - 1, // Month (0-based)
            parseInt(dateParts[0]) // Day
        );
        
        if (isNaN(endDate.getTime())) {
            throw new Error('Ungültiges Datum für die Kapazitätsberechnung');
        }
        
        // Get current date
        const today = new Date();
        
        // Calculate months difference (for planning horizon)
        const monthsDiff = (endDate.getFullYear() - today.getFullYear()) * 12 + 
                            (endDate.getMonth() - today.getMonth());
        
        if (monthsDiff < 0) {
            throw new Error('Das Enddatum muss in der Zukunft liegen');
        }
        
        // Process capacity data for each employee
        const employeeCapacity = {};
        
        arbeitsstundenData.forEach(record => {
            const mitarbeiterNr = record['Mitarbeiter Nummer'] ? record['Mitarbeiter Nummer'].toString().trim() : '';
            const mitarbeiterName = record['Mitarbeiter Name'] ? record['Mitarbeiter Name'].toString().trim() : 'Unbekannt';
            const wochenstunden = parseFloat(record['Wochenstunden'] ? record['Wochenstunden'].toString().replace(',', '.') : '0') || 0;
            
            if (!mitarbeiterNr) return; // Skip records without employee number
            
            // Calculate monthly hours (approximate: weeks per month * weekly hours)
            const monthlyHours = (wochenstunden * 4.33); // 52 weeks / 12 months ≈ 4.33 weeks per month
            
            // Calculate total available capacity until end date
            const availableCapacity = monthlyHours * (monthsDiff + 1); // Include current month
            
            employeeCapacity[mitarbeiterNr] = {
                MitarbeiterNummer: mitarbeiterNr,
                MitarbeiterName: mitarbeiterName,
                Wochenstunden: wochenstunden,
                MonatlicheStunden: monthlyHours,
                'Verfügbare Kapazität': availableCapacity,
                'Arbeitszeit in Stunden': availableCapacity, // Total work time (same as capacity before allocations)
                'Geplante Stunden': 0, // This will be filled in by allocation logic later
                'Auslastung (%)': 0,   // This will be calculated later
                PlanungszeitraumMonate: monthsDiff + 1
            };
        });
        
        return employeeCapacity;
    }

    // Initialize Flowbite modals
    function initializeFlowbiteModals() {
        try {
            // Get all the modal elements
            const modalIds = [
                'employeeDetailsModal',
                'plannedHoursModal',
                'historicalHoursDetailsModal'
            ];
            
            // Initialize each modal
            modalIds.forEach(id => {
                const modalElement = document.getElementById(id);
                if (modalElement) {
                    // Initialize the modal with Flowbite
                    const modalOptions = {
                        backdrop: 'dynamic',
                        closable: true,
                        onShow: () => console.log(`Modal ${id} shown`),
                        onHide: () => console.log(`Modal ${id} hidden`)
                    };
                    
                    try {
                        // Create the modal instance
                        const modal = new Modal(modalElement, modalOptions);
                        console.log(`Modal ${id} initialized successfully`);
                    } catch (e) {
                        console.error(`Error initializing modal ${id}:`, e);
                    }
                } else {
                    console.warn(`Modal element with ID '${id}' not found`);
                }
            });
        } catch (error) {
            console.error("Error initializing Flowbite modals:", error);
        }
    }

    // Function to visualize results
    function visualizeResults() {
        // Implementation of visualizeResults function
    }

    // Helper function to sum values
    function sum(array, propertyName = null) {
        if (!array || !Array.isArray(array)) return 0;
        
        if (propertyName) {
            // Sum of a property across all objects in the array
            return array.reduce((total, item) => {
                const value = item[propertyName];
                return total + (parseFloat(value) || 0);
            }, 0);
        } else {
            // Sum of all numbers in the array
            return array.reduce((total, value) => total + (parseFloat(value) || 0), 0);
        }
    }

    // Initialize the application
    initializeApplication();
}); // End of DOMContentLoaded event listener