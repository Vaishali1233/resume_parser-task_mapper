function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Candidate Data')
    .addItem('Run Resume Parser', 'callProcessResumes')
    .addSubMenu(ui.createMenu('Upload Sheet')
      .addItem('Upload CSV', 'promptUploadLink')
      .addItem('Upload Google Sheet', 'promptUploadLink'))
    .addToUi();

  if(shouldRunAutomatically()){
    callProcessResumes();
  }
}

function promptUploadLink() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Upload Sheet', 'Enter the link of the sheet to be uploaded:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() == ui.Button.OK) {
    const sheetLink = response.getResponseText();
    if (isValidURL(sheetLink)) {
      ui.alert('Sheet link uploaded successfully');
      processUploadedSheet(sheetLink);
    } else {
      ui.alert('Invalid URL. Please enter a valid link.');
    }
  }
}

function processUploadedSheet(sheetLink) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const uploadedSheet = SpreadsheetApp.openByUrl(sheetLink).getSheets()[0];
    const candidateSheet = ss.getSheetByName("Candidate");

    if (!uploadedSheet || !candidateSheet) {
      SpreadsheetApp.getUi().alert("Could not access sheets.");
      return;
    }

    let uploadedDataSheet = ss.getSheetByName("Uploaded Candidate Data");
    if (!uploadedDataSheet) {
      uploadedDataSheet = ss.insertSheet("Uploaded Candidate Data");
    } else {
      uploadedDataSheet.clear();
    }

    const allData = uploadedSheet.getDataRange().getValues();
    const headers = allData[0];  
    const dataRows = allData.slice(1); 

    uploadedDataSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (dataRows.length > 0) {
      uploadedDataSheet.getRange(2, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
    }

    console.log("Uploaded Sheet Headers: ", headers);

  } catch (error) {
    SpreadsheetApp.getUi().alert("Error processing uploaded sheet: " + error.message);
  }
}

function assignCandidateID(sheet, row) {
    var registrySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Candidate ID Registry");
    if (!registrySheet) {
        registrySheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Candidate ID Registry");
        registrySheet.appendRow(["Candidate Name", "Candidate ID"]); 
    }

    var name = sheet.getRange(row, 2).getValue().toString().trim().toLowerCase(); 
    if (!name) return;
    var candidateData = sheet.getRange("A2:A" + sheet.getLastRow()).getValues().flat(); 
    var registryData = registrySheet.getDataRange().getValues();
    
    var nameToIdMap = {};
    var existingIds = candidateData.filter(id => !isNaN(id) && id !== "").map(id => parseInt(id, 10));

    for (var i = 1; i < registryData.length; i++) { 
        var regName = registryData[i][0].toString().trim().toLowerCase();
        var regId = parseInt(registryData[i][1], 10);
        if (regName) {
            nameToIdMap[regName] = regId;
            existingIds.push(regId);
        }
    }

    var maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0; 

    if (name in nameToIdMap) {
        sheet.getRange(row, 1).setValue(nameToIdMap[name]);
        Logger.log("Retained Candidate ID: " + nameToIdMap[name] + " for " + name);
    } else {
        var newId = maxId + 1;
        sheet.getRange(row, 1).setValue(newId);
        registrySheet.appendRow([name, newId]);
        Logger.log("Assigned New Candidate ID: " + newId + " to " + name);
    }
}

function shouldRunAutomatically() {
  var configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
  var userChoice = configSheet.getRange("B2").getValue();
  return userChoice.toString().trim().toLowerCase() === "automatic";
}

function runResumeParser() {
  callProcessResumes();
}

function onEdit(e) {
  if (!e || !e.source) return;
  var sheet = e.source.getActiveSheet();
  var range = e.range;

  if (sheet.getName() === "Config") return;
  if (sheet.getName() !== "Candidate") return;

  var resumeColIndex = getColumnIndex("Resume", sheet);
  if (resumeColIndex === -1) return;
  if (range.getColumn() !== resumeColIndex) return;

  var newValue = range.getValue();
  if (!isValidURL(newValue)) return;

  var configSheet = e.source.getSheetByName("Config");
  if (!configSheet) return;

  var mode = configSheet.getRange("B2").getValue().toString().trim().toLowerCase();
  if (mode === "automatic") {
    callProcessResumes();
  }
}

function isValidURL(str) {
  var pattern = /^(https?:\/\/[^\s]+)/;
  return pattern.test(str);
}

function callProcessResumes() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log("Another instance is running. Exiting.");
    return;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Candidate");
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");

    if (!sheet || !configSheet) return;

    var resumeColIndex = getColumnIndex("Resume", sheet);
    if (resumeColIndex === -1) return;

    var lastParsedRow = configSheet.getRange("B3").getValue();
    if (!lastParsedRow || isNaN(lastParsedRow)) lastParsedRow = 1;

    var data = sheet.getDataRange().getValues();
    var newLastParsedRow = lastParsedRow;

    const resumeParserUrl = "https://dash.infinityfree.com/accounts/if0_38324794/domains/ngrokpersonal.free.nf";

    const options = {
      method: 'post',
      muteHttpExceptions: true
    };

    for (var i = lastParsedRow; i < data.length; i++) {
      var resumeURL = data[i][resumeColIndex - 1];
      if (isValidURL(resumeURL)) {
        const response = UrlFetchApp.fetch(resumeParserUrl, options);
        if (response.getResponseCode() === 200) {
          const jsonResponse = JSON.parse(response.getContentText());
          const successCount = jsonResponse.success_count || 0;
          const failureCount = jsonResponse.failure_count || 0;

          newLastParsedRow = i + 1;

          SpreadsheetApp.getUi().alert(`Resume parsing completed successfully!\n\nSuccess: ${successCount}\nFailures: ${failureCount}`);
        } else {
          const jsonResponse = JSON.parse(response.getContentText());
          SpreadsheetApp.getUi().alert(`Failed to run the resume parser.\nError: ${jsonResponse.error || "Unknown error"}`);
        }
      }
    }
    configSheet.getRange("B3").setValue(newLastParsedRow);
  } catch (error) {
    SpreadsheetApp.getUi().alert(`An error occurred: ${error.message}`);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
    try {
        var content = generateReport();
        var fileName = "Candidate_Report.txt";
        
        var file = DriveApp.createFile(fileName, content, MimeType.PLAIN_TEXT);
        var fileUrl = file.getDownloadUrl();
        
        return HtmlService.createHtmlOutput(`
            <html>
            <head>
                <script>
                    window.onload = function() {
                        window.location.href = "${fileUrl}";
                    };
                </script>
            </head>
            <body>
                <p>Your download should start automatically. If not, <a href="${fileUrl}">click here</a>.</p>
            </body>
            </html>
        `);
    } catch (e) {
        return HtmlService.createHtmlOutput("Error: " + e.message);
    }
}

function generateReport() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mainSheet = ss.getSheetByName("Candidate");
    if (!mainSheet) return "Error: 'Candidate' sheet not found.";

    var headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
    var ratingColumns = ["Name", "Rating 1", "Rating 2", "Rating 3", "Rating 4", "Rating 5", "Remarks"];
    var columnIndexes = ratingColumns.map(name => headers.indexOf(name) + 1).filter(index => index > 0);
    
    if (columnIndexes.length === 0) return "No rating/remarks columns found.";

    var data = mainSheet.getDataRange().getValues();
    var reportContent = "Candidate Report\n\n";

    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var candidateData = columnIndexes.map(idx => row[idx - 1] || "-");
        if (candidateData.some(cell => cell !== "-")) {
            reportContent += `Candidate ${i}:\n`;
            ratingColumns.forEach((colName, index) => {
                reportContent += `${colName}: ${candidateData[index]}\n`;
            });
            reportContent += "\n-----------------------\n";
        }
    }
    Logger.log(reportContent);
    return reportContent;
}


function openDownloadPage() {
  var url = "https://script.google.com/macros/s/AKfycbzNzh6ynIpylK4TO8jGiIXqAJDym-n4p_xrJA4HkPn4EDEtL-8AMXJiZWLbMavb8zaZ/exec"; 
  var html = `<script>window.open('${url}', '_blank');</script>`;
  return HtmlService.createHtmlOutput(html);
}

